import { NextResponse } from 'next/server'
import type { Tool, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { anthropic, MODEL, DEFAULTS } from '@/lib/anthropic'
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'
import { FIELD_META as I864_FIELD_META, SENSITIVE_PATHS, type FieldMeta } from '@/lib/i864-schema'
import { flattenPaths, mergeExtractionIntoState } from '@/lib/field-paths'
import { FORM_REGISTRY, type FormId } from '@/lib/forms'
import { getFieldMeta } from '@/lib/forms/per-form-meta'

/** Replace SSN / A-Number-shaped values with last-4 masks before sending to
 * the LLM or returning to the client. */
function maskSensitive(state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(state)) {
    if (SENSITIVE_PATHS.has(k) && typeof v === 'string') {
      const digits = v.replace(/\D/g, '')
      out[k] = digits.length >= 4 ? `xxx-xx-${digits.slice(-4)}` : 'xxx-xx-xxxx'
    } else {
      out[k] = v
    }
  }
  return out
}

/** Redact SSN/A-Number patterns in a free-text message in case the LLM
 * echoes one despite being told not to. Belt-and-suspenders. */
function redactMessage(text: string): string {
  return text
    .replace(/\b(\d{3})-?(\d{2})-?(\d{4})\b/g, (_, _a, _b, c) => `xxx-xx-${c}`)
    .replace(/\bA-?(\d{3})(\d{3})(\d{2,3})\b/g, (_, _a, _b, c) => `A-xxxxxx${c}`)
}

export const runtime = 'nodejs'
export const maxDuration = 60

function getFieldMetaForForm(formId: FormId): Record<string, FieldMeta> {
  if (formId === 'i-864') return I864_FIELD_META
  // Auto-mapped forms have a slim FIELD_META in per-form-meta.ts. We fall
  // back to I-864's set if a form somehow isn't covered — that just means
  // the chat will ask I-864 questions for an unsupported form, which is the
  // pre-refactor behavior.
  return getFieldMeta(formId) ?? I864_FIELD_META
}

function buildSystemPrompt(formId: FormId): string {
  const meta = FORM_REGISTRY[formId]
  const formName = meta?.name ?? `USCIS Form ${formId.toUpperCase()}`
  const formShort = formId.toUpperCase()
  return `You are Formcutter's assistant for the U.S. ${formName} (${formShort}).

You guide an applicant through completing their ${formShort}. Your job is to gather missing fields conversationally after an initial document extraction has already pulled what it can.

# Style

- Warm, concise, 2-4 sentences per turn. Never walls of text.
- When you ask for a field, include a one-line "USCIS needs this because..." so the user understands why.
- When the user volunteers new info, acknowledge it briefly, then move on to the next missing required field.
- When extracted data is reflected back to the user for confirmation, cite the source document (e.g. "From your tax return, line 9, I got $95,120 for most-recent-year total income.").
- Mask SSNs in your replies: show only last 4 digits as "xxx-xx-7102". Mask A-Numbers as "A-xxxxxx7890". Do not echo full SSN or A-Number in any message.
- Infer liberally, but confirm before recording. If the user is clearly a married U.S. citizen and the tax return is joint-filed, it's fine to say "Based on the 1040 being married-filing-jointly, I'm assuming you have a spouse — that count is 1?" rather than making them re-state it from scratch.

# Priority order for asking

Each turn you see a MISSING list with a tier for each field. Ask in this order:
1. tier="required" fields first — these gate USCIS submission.
2. tier="conditional" fields only when their trigger is satisfied (you'll see the resolved list).
3. tier="optional" fields last, and only if the user wants to strengthen the case.

Ask ONE field per turn unless the user bundles multiple answers ("I'm married, no kids, employed"). In that case, record ALL the fields they gave you.

# Tappable option chips

When a question has a small set of valid answers, populate the \`options\` array with them so the UI can render tappable buttons. Good candidates:
- Citizenship status: ["U.S. citizen", "U.S. national", "Green card holder (LPR)"]
- Employment status: ["Employed", "Self-employed", "Retired", "Unemployed"]
- Yes/no questions: ["Yes", "No"]
- Marital status: ["Married", "Single", "Divorced", "Widowed"]
- Skip: ["Skip for now"] (always include as an additional option on non-obvious required fields)

DO NOT provide \`options\` for:
- Free-text fields (name, email, address)
- Dates
- Numbers (SSN, phone, income amounts, household counts)
- Any question where the answer space is open-ended

When the user taps an option, their next message will be that exact string. Record the corresponding field from it.

# Handling "skip" / "I don't know"

Users MUST be able to move past fields. If they say "skip," "I don't know," "unsure," "come back to it," etc.:
- Record nothing for that field.
- Move to the next field.
- At session end, the unanswered-required fields will be surfaced to their accredited-rep reviewer. That's the safety net.

Never loop on a field. Never refuse to continue because something is missing.

# Outputs (via \`respond\` tool)

- \`message\`: your reply to the user. Short. Include source citation OR why-USCIS-needs-it when appropriate.
- \`updates\`: flat map of dotted schema paths → values. Include ONLY facts the user explicitly stated or confirmed in this turn. Never guess.
- \`needs_rep_review\`: true when the user asked a legal-strategy question.
- \`review_reason\`: short description of what to flag, required when \`needs_rep_review\` is true.

# Hard rules

- Never give legal advice. Do not tell the user whether they qualify, whether they need a particular kind of help, how to argue a discretionary issue, or whether their evidence is "enough." For any such question: set \`needs_rep_review: true\` and reply with something like "I'll flag this for your accredited-rep reviewer — they'll give you a straight answer. For reference, here's what the instructions say: [quote]." Then move on to the next unrelated missing field.
- Topics that are ALWAYS legal-strategy (flag on any form):
  - Whether the user qualifies at all
  - Any criminal history or immigration violation
  - Past fraud or misrepresentation
  - Active or prior removal proceedings
  - "What should I do" / "is this enough" / strategic-choice questions
- Form-specific legal-strategy topics (always flag for the relevant form):
  - I-864: joint sponsor eligibility, asset substitution, domicile, public charge
  - N-400: good moral character, tax compliance disputes, selective service issues
  - I-485: bars to adjustment, inspection-and-admission disputes
  - I-589: nexus to a protected ground, particular social group analysis, one-year bar exceptions, persecution narrative wording (the user's statement is theirs — don't shape it)
- Dates → YYYY-MM-DD. Money → plain numbers, no commas/$.
- If the MISSING list is empty (all required filled), congratulate and tell them to hit Generate PDF.
- Do not fabricate field paths — use only the paths shown in MISSING or already in state.`
}

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
        description: 'Flat map of dotted USCIS form field paths → values to persist. Empty if no new facts.',
        additionalProperties: true,
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional tappable answer choices. Provide 2-6 options ONLY when the question is yes/no or a small enum (citizenship status, employment status, marital status). Do NOT provide options for free-text questions (SSN, email, name). When provided, the UI renders each as a button; the user taps one, which sends that exact string as their next message.',
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
  language?: string
  formId?: FormId
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Español)',
  zh: 'Simplified Chinese (中文)',
  vi: 'Vietnamese (Tiếng Việt)',
  tl: 'Tagalog',
  ru: 'Russian (Русский)',
  uk: 'Ukrainian (Українська)',
  ar: 'Modern Standard Arabic (العربية)',
  ht: 'Haitian Creole (Kreyòl Ayisyen)',
  pt: 'Brazilian Portuguese (Português)',
}

type ToolOutput = {
  message: string
  updates: Record<string, unknown>
  options?: string[]
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
  const language = body.language && LANGUAGE_NAMES[body.language] ? body.language : 'en'
  const languageName = LANGUAGE_NAMES[language]
  const formId: FormId =
    body.formId && FORM_REGISTRY[body.formId] ? body.formId : 'i-864'
  const fieldMetaForForm = getFieldMetaForForm(formId)

  if (messages.length === 0 || messages.length > 50) {
    return NextResponse.json({ error: 'invalid_message_count' }, { status: 400 })
  }

  // Build the still-missing list, sorted by tier priority, filtered against
  // conditional triggers. The LLM uses tier + why to prioritize.
  const flatState = flattenPaths(state as Record<string, unknown>)
  const tierRank = { required: 0, conditional: 1, optional: 2 } as const

  const missing = Object.entries(fieldMetaForForm)
    .filter(([path, meta]) => {
      const filled = flatState[path] !== undefined && flatState[path] !== ''
      if (filled) return false
      if (meta.tier === 'conditional' && meta.conditionOn) {
        const trigger = flatState[meta.conditionOn]
        if (!trigger) return false
      }
      return true
    })
    .map(([path, meta]) => ({
      path,
      label: meta.label,
      tier: meta.tier,
      why: meta.why,
      docSource: meta.docSource,
      askIfMissing: meta.askIfMissing,
    }))
    .sort((a, b) => tierRank[a.tier] - tierRank[b.tier])

  // Mask sensitive values in what we echo back to the LLM — it never needs
  // to see full SSNs to ask follow-up questions.
  const maskedState = maskSensitive(flatState)

  const contextMessage = [
    `Current form state (values; sensitive fields shown masked):`,
    '```json',
    JSON.stringify(maskedState, null, 2),
    '```',
    '',
    `Still missing fields (${missing.length}, ordered by priority):`,
    '```json',
    JSON.stringify(missing, null, 2),
    '```',
    '',
    missing.length === 0
      ? 'All required fields are filled. Tell the user the form is ready to generate.'
      : `Ask for the highest-priority required field next, unless the user's latest message already gave you something specific to record.`,
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
          text: buildSystemPrompt(formId),
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text:
            language === 'en'
              ? 'Respond in clear, natural English at a 5th-grade reading level.'
              : `Respond in ${languageName}. Use warm, natural, 5th-grade-reading-level phrasing. Keep USCIS form names (like "I-864"), the acronym "USCIS", and the word "SSN" in English/Latin script. Translate everything else, including option-chip labels in \`options\`. When echoing field values the user provided, keep names/addresses/numbers as-is.`,
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
      message: redactMessage(out.message),
      state: nextState,
      options: out.options ?? [],
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
