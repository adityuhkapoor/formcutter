import { NextResponse } from 'next/server'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { anthropic, MODEL, DEFAULTS, type DocHint } from '@/lib/anthropic'
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are a document-extraction assistant for U.S. immigration form filling (I-864 Affidavit of Support).

You receive one document at a time — a photo or scan of an identification card, passport, tax return, tax transcript, or pay stub. Your only job is to read the document and emit structured data via the \`extract_fields\` tool.

FIELD PATHS — you MUST use exactly these dotted paths (no abbreviations, no renaming). Any field not in this list must be omitted, not renamed:

Sponsor identity (Part 4):
- part4.name.familyName            (sponsor last name)
- part4.name.givenName             (sponsor first name)
- part4.name.middleName            (sponsor middle name, if shown)
- part4.dateOfBirth                (ISO YYYY-MM-DD)
- part4.ssn                        (###-##-#### if visible)
- part4.placeOfBirth.cityOrTown
- part4.placeOfBirth.state
- part4.placeOfBirth.country
- part4.mailingAddress.streetNumberAndName
- part4.mailingAddress.aptSteFlrNumber
- part4.mailingAddress.cityOrTown
- part4.mailingAddress.state       (2-letter code, e.g. "TX")
- part4.mailingAddress.zipCode
- part4.mailingAddress.country
- part4.citizenshipStatus          (one of: "us-citizen", "us-national", "lpr")
- part4.aNumber                    (A-Number from green card, format "A123456789")

Immigrant identity (Part 2, only if extracting from immigrant's documents):
- part2.name.familyName
- part2.name.givenName
- part2.name.middleName
- part2.dateOfBirth
- part2.ssn
- part2.aNumber
- part2.countryOfCitizenship
- part2.mailingAddress.streetNumberAndName
- part2.mailingAddress.cityOrTown
- part2.mailingAddress.state
- part2.mailingAddress.zipCode

Employment and income (Part 6):
- part6.employerOrBusinessName
- part6.occupation
- part6.currentIndividualAnnualIncome  (number)
- part6.taxReturnIncome.mostRecentYear.taxYear        (integer)
- part6.taxReturnIncome.mostRecentYear.totalIncome    (number, 1040 line 9 "Total income")

Contact (Part 8):
- part8.sponsorDaytimePhone
- part8.sponsorMobilePhone
- part8.sponsorEmail

HARD RULES:
- Use ONLY the field paths listed above. Do NOT invent new paths like "name.firstName" or "address.street". If a value on the document doesn't fit one of these paths, omit it.
- Only extract what you can actually read. If a field is partially occluded, illegible, or absent, OMIT it (do not guess).
- Dates: ISO 8601 YYYY-MM-DD.
- Money: plain numbers only, no currency symbols or commas (95000, not "$95,000").
- If the document is a license/green card/passport: assume it belongs to the SPONSOR unless context clearly says otherwise — use part4.* paths.
- Pay stubs and tax returns: use part6.* paths, and set \`taxYear\`/\`totalIncome\`/\`grossYTD\` top-level fields too.
- Do NOT invent fields not present on the document. Returning an empty \`fields\` object is better than hallucinating.
- Do NOT ask the user questions — another component handles that.

DOC VETTING RULES (critical for reviewer):
- ALWAYS set \`docType\` to what you actually see, even if the user's hint says something different. If your detected type differs from the user's hint, set \`mismatchReason\` to a short sentence like "User said 'license' but the document is clearly an IRS Form 1040."
- For tax returns: if the 1040 visible but W-2(s), 1099(s), or any Schedule referenced (A/B/C/D/E) are NOT present in what you can see, list them in \`missingComponents\`. USCIS rejects for missing schedules more than any other reason.
- Always populate \`docDate\` with the most relevant date: pay-stub pay-period-end for paystubs; Dec 31 of the tax year for 1040s; issue date for licenses/passports/green cards.
- If watermarked "SAMPLE" / "SPECIMEN" / "NOT REAL", note in \`warnings\`. Don't reject — this is a dev/test document.
- If the document is older than expected for its type (pay stub > 6 months, tax return > 2 years), mention in \`warnings\`.`

const TOOL_DEFINITION: Tool = {
  name: 'extract_fields',
  description: 'Emit structured fields extracted from the submitted document.',
  input_schema: {
    type: 'object',
    properties: {
      docType: {
        type: 'string',
        enum: [
          'license',
          'passport',
          'green-card',
          'tax-return',
          'tax-transcript',
          'paystub',
          'other',
        ],
      },
      fields: {
        type: 'object',
        description: 'I-864 field paths to extracted values. Paths use dot notation, e.g. "part4.name.familyName".',
        additionalProperties: true,
      },
      taxYear: {
        type: 'integer',
        description: 'Tax year this document covers, if applicable.',
      },
      totalIncome: {
        type: 'number',
        description: 'For tax returns: 1040 line 9 "Total income". For paystubs: YTD gross × annualization.',
      },
      grossYTD: {
        type: 'number',
        description: 'For paystubs: gross year-to-date earnings as printed.',
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Anything unusual about the document (expired, unreadable, apparent tampering).',
      },
      missingComponents: {
        type: 'array',
        items: { type: 'string' },
        description:
          'For tax returns: list any commonly-attached components that are NOT present (e.g. "W-2", "Schedule C", "1099"). USCIS requires every schedule filed.',
      },
      docDate: {
        type: 'string',
        description:
          'Key date on the document in YYYY-MM-DD form. For pay stubs: the pay period end or pay date. For tax returns: December 31 of the tax year. Omit if not determinable.',
      },
      mismatchReason: {
        type: 'string',
        description:
          'If docType differs from user-provided hint, explain why in one short sentence. Omit if they match.',
      },
    },
    required: ['docType', 'fields'],
  },
}

type ExtractionResult = {
  docType: string
  fields: Record<string, unknown>
  taxYear?: number
  totalIncome?: number
  grossYTD?: number
  warnings?: string[]
  missingComponents?: string[]
  docDate?: string
  mismatchReason?: string
}

export async function POST(req: Request) {
  // Rate limit first so we don't pay for abuse.
  const ip = ipFromRequest(req)
  const rl = rateLimit({ key: `extract:${ip}`, limit: 30, windowMs: 60 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', resetAt: rl.resetAt },
      { status: 429 }
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_multipart' }, { status: 400 })
  }

  const file = formData.get('file')
  const hint = (formData.get('hint') as DocHint | null) ?? 'other'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'file_too_large', maxBytes: 10 * 1024 * 1024 }, { status: 413 })
  }

  const mediaType = file.type || inferMediaType(file.name)
  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')

  const isPdf = mediaType === 'application/pdf'
  const isImage = mediaType.startsWith('image/')
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: 'unsupported_media_type', got: mediaType }, { status: 415 })
  }

  const userContent = [
    {
      type: isPdf ? ('document' as const) : ('image' as const),
      source: {
        type: 'base64' as const,
        media_type: mediaType,
        data: base64,
      },
    },
    {
      type: 'text' as const,
      text: `Document hint from user: ${hint}. Extract all legibly present I-864-relevant fields via the extract_fields tool.`,
    },
  ]

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: DEFAULTS.maxTokens,
      temperature: DEFAULTS.temperature,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [TOOL_DEFINITION],
      tool_choice: { type: 'tool', name: 'extract_fields' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: userContent as any }],
    })

    const toolUse = response.content.find(
      (b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use'
    )
    if (!toolUse) {
      return NextResponse.json({ error: 'no_tool_use_returned' }, { status: 502 })
    }

    const result = toolUse.input as ExtractionResult

    return NextResponse.json({
      ok: true,
      extraction: result,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    })
  } catch (err) {
    console.error('extract error', err)
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: 'extraction_failed', message }, { status: 500 })
  }
}

function inferMediaType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'application/octet-stream'
}
