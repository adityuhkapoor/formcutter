import { NextResponse } from 'next/server'
import type { Tool, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { anthropic, MODEL, DEFAULTS } from '@/lib/anthropic'
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'
import { FIELD_META } from '@/lib/i864-schema'
import { flattenPaths, mergeExtractionIntoState } from '@/lib/field-paths'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are Formcutter's fill-in-the-blanks assistant for the U.S. I-864 Affidavit of Support.

You help a sponsor complete their I-864 by asking for ONE missing field at a time in plain, friendly English. You do NOT give legal advice.

Your inputs each turn:
- The current form state (what we've extracted from documents and previously discussed).
- A list of still-missing fields with their plain-English labels.
- The user's latest message.

Your outputs via the \`respond\` tool:
- \`message\`: a short reply to the user. If you are asking for the next field, phrase it as a single friendly question. If the user volunteered something, acknowledge and record it. Keep it under 3 sentences.
- \`updates\`: a flat map of dotted field paths → values, populated ONLY with values the user explicitly stated in this turn. Never invent values. Ask follow-ups for anything unclear.
- \`needs_rep_review\`: set true if the user asked a legal-strategy question (joint sponsor eligibility, domicile, assets vs income, public charge, naturalization consequences, whether they qualify). In that case, your \`message\` should say you'll flag it for their reviewer.

Hard rules:
- Never advise whether they qualify, should use a joint sponsor, or any strategic question. Redirect to "I'll flag this for your reviewer."
- Dates → YYYY-MM-DD. Money → plain numbers, no commas/$.
- If the user's answer is ambiguous (e.g. "about 95k") ask one clarifying question before committing it.
- If a field they mention isn't in the missing list, still record it if it fits a known schema path.
- If the missing list is empty, confirm the form is complete and tell them to hit Generate PDF.`

const TOOL_DEFINITION: Tool = {
  name: 'respond',
  description: 'Emit the next assistant turn and any field updates the user volunteered.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Text shown to the user. Under 3 sentences unless summarizing.',
      },
      updates: {
        type: 'object',
        description: 'Flat map of dotted I-864 field paths → values to persist. Empty if no new facts.',
        additionalProperties: true,
      },
      needs_rep_review: {
        type: 'boolean',
        description: 'True if the user asked a legal/strategic question that should be escalated.',
      },
      review_reason: {
        type: 'string',
        description: 'Short description of what to flag for the reviewer. Required when needs_rep_review is true.',
      },
    },
    required: ['message', 'updates', 'needs_rep_review'],
  },
}

type TurnInput = {
  state: Record<string, unknown>
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

type ToolOutput = {
  message: string
  updates: Record<string, unknown>
  needs_rep_review: boolean
  review_reason?: string
}

export async function POST(req: Request) {
  const ip = ipFromRequest(req)
  const rl = rateLimit({ key: `chat:${ip}`, limit: 120, windowMs: 60 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 })
  }

  let body: TurnInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const state = body.state ?? {}
  const messages = body.messages ?? []

  if (messages.length === 0 || messages.length > 50) {
    return NextResponse.json({ error: 'invalid_message_count' }, { status: 400 })
  }

  // Build the still-missing list by comparing schema meta against state.
  const flatState = flattenPaths(state as Record<string, unknown>)
  const missing = Object.entries(FIELD_META)
    .filter(([path]) => flatState[path] === undefined || flatState[path] === '')
    .map(([path, meta]) => ({
      path,
      label: meta.label,
      askIfMissing: meta.askIfMissing,
    }))

  const contextMessage = [
    `Current form state (filled values):`,
    '```json',
    JSON.stringify(flatState, null, 2),
    '```',
    '',
    `Still missing fields (${missing.length} of ${Object.keys(FIELD_META).length}):`,
    '```json',
    JSON.stringify(missing, null, 2),
    '```',
  ].join('\n')

  const conversation: MessageParam[] = [
    // Seed with current form context as the first user message so the LLM
    // sees it every turn without us having to resend history we don't have.
    { role: 'user', content: contextMessage },
    { role: 'assistant', content: "Understood. I'll ask for one missing field at a time." },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: DEFAULTS.maxTokens,
      temperature: 0.2,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [TOOL_DEFINITION],
      tool_choice: { type: 'tool', name: 'respond' },
      messages: conversation,
    })

    const toolUse = response.content.find(
      (b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use'
    )
    if (!toolUse) {
      return NextResponse.json({ error: 'no_tool_use_returned' }, { status: 502 })
    }

    const out = toolUse.input as ToolOutput
    const nextState = mergeExtractionIntoState(state as Record<string, unknown>, out.updates ?? {})

    return NextResponse.json({
      ok: true,
      message: out.message,
      state: nextState,
      needsRepReview: out.needs_rep_review,
      reviewReason: out.review_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    })
  } catch (err) {
    console.error('chat error', err)
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: 'chat_failed', message }, { status: 500 })
  }
}
