import { NextResponse } from 'next/server'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { anthropic, MODEL, DEFAULTS, type DocHint } from '@/lib/anthropic'
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are a document-extraction assistant for U.S. immigration form filling (I-864 Affidavit of Support).

You receive one document at a time — a photo or scan of an identification card, passport, tax return, tax transcript, or pay stub. Your only job is to read the document and emit structured data via the \`extract_fields\` tool.

Rules:
- Only extract what you can actually read. If a field is partially occluded, illegible, or absent, OMIT it from the output (do not guess).
- Return dates in ISO 8601 form: YYYY-MM-DD.
- Return money as plain numbers, no currency symbols or commas (e.g. 95000, not "$95,000").
- If the document is not one of the listed types, set \`docType\` to "other" and extract whatever IDs/names/dates/amounts are legibly present.
- Do NOT invent fields not present on the document. Better to return \`{}\` than a hallucination.
- Do NOT ask the user questions — that is handled by a different component.
- If you notice something unusual about the document (expired, redacted, handwritten over print) note it in \`warnings\`.`

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
