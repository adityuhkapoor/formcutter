import { NextResponse } from 'next/server'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { anthropic, MODEL, DEFAULTS, type DocHint } from '@/lib/anthropic'
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'
import { FORM_REGISTRY, type FormId } from '@/lib/forms'
import { getDocFieldPaths } from '@/lib/forms/per-form-meta'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Build the system prompt for a vision-extraction call. The list of allowed
 * field paths varies per form — I-864's are split across part2/part4/part6,
 * the others use the simpler petitioner/applicant/beneficiary tree.
 */
function buildSystemPrompt(formId: FormId): string {
  const meta = FORM_REGISTRY[formId]
  const formName = meta?.name ?? `USCIS Form ${formId.toUpperCase()}`
  const formShort = formId.toUpperCase()
  const docPaths = getDocFieldPaths(formId)

  return `You are a document-extraction assistant for U.S. immigration form filling (${formName}).

You receive one document at a time — a photo or scan of an identification card, passport, tax return, tax transcript, or pay stub. Your only job is to read the document and emit structured data via the \`extract_fields\` tool.

The extracted fields will populate ${formShort}. Use exactly these dotted paths (no abbreviations, no renaming). Any field not in this list must be omitted, not renamed:

${docPaths.map((p) => `- ${p}`).join('\n')}

HARD RULES:
- Use ONLY the field paths listed above. Do NOT invent new paths. If a value on the document doesn't fit one of these paths, omit it.
- Only extract what you can actually read. If a field is partially occluded, illegible, or absent, OMIT it (do not guess).
- Dates: ISO 8601 YYYY-MM-DD.
- Money: plain numbers only, no currency symbols or commas (95000, not "$95,000").
- Pay stubs and tax returns: also set top-level \`taxYear\` / \`totalIncome\` / \`grossYTD\` when applicable.
- Returning an empty \`fields\` object is better than hallucinating.
- Do NOT ask the user questions — another component handles that.

DOC VETTING RULES (critical for reviewer):
- ALWAYS set \`docType\` to what you actually see, even if the user's hint says something different. If your detected type differs from the user's hint, set \`mismatchReason\` to a short sentence like "User said 'license' but the document is clearly an IRS Form 1040."
- For tax returns: if the 1040 is visible but W-2(s), 1099(s), or any Schedule referenced (A/B/C/D/E) are NOT present in what you can see, list them in \`missingComponents\`. USCIS rejects for missing schedules more than any other reason.
- Always populate \`docDate\` with the most relevant date: pay-stub pay-period-end for paystubs; Dec 31 of the tax year for 1040s; issue date for licenses/passports/green cards.
- If watermarked "SAMPLE" / "SPECIMEN" / "NOT REAL", note in \`warnings\`. Don't reject — this is a dev/test document.
- If the document is older than expected for its type (pay stub > 6 months, tax return > 2 years), mention in \`warnings\`.`
}


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
  const rawFormId = formData.get('formId')
  const formId: FormId =
    typeof rawFormId === 'string' && rawFormId in FORM_REGISTRY
      ? (rawFormId as FormId)
      : 'i-864'

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
      text: `Document hint from user: ${hint}. Extract all legibly present ${formId.toUpperCase()}-relevant fields via the extract_fields tool.`,
    },
  ]

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: DEFAULTS.maxTokens,
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(formId),
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
