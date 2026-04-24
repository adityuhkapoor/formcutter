import { NextResponse } from 'next/server'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { anthropic, MODEL, DEFAULTS } from '@/lib/anthropic'
import type { FormId } from '@/lib/forms'
import type { WizardResult } from '@/lib/eligibility-types'
import {
  checkRedFlags,
  type TriageFacts,
  type TriageMessage,
  type TriageOutcome,
} from '@/lib/triage-types'

export const runtime = 'nodejs'
export const maxDuration = 30

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  zh: 'Simplified Chinese',
  vi: 'Vietnamese',
  tl: 'Tagalog',
  ru: 'Russian',
  uk: 'Ukrainian',
  ar: 'Arabic',
  ht: 'Haitian Creole',
  pt: 'Brazilian Portuguese',
}

const SUPPORTED_FORM_IDS = ['i-864', 'i-130', 'i-485', 'n-400', 'i-589', 'i-765', 'i-821', 'i-102']

const SYSTEM_PROMPT = `You are the front-door triage agent for Formcutter, an AI-assisted USCIS form filler. A person just arrived at the landing page and is typing free text about their situation. Your job: classify what they need and emit exactly one of four outcomes.

You are NOT a lawyer. You are NOT giving legal advice. You are deciding which of these paths to send them down:

1. **route** — they named a specific form OR their situation clearly requires exactly one of our supported forms. Supported form IDs: ${SUPPORTED_FORM_IDS.join(', ')}. Only emit this when confidence is high — if in doubt, emit "recommend" instead.
2. **recommend** — the situation is clear enough to rank 1-3 reasonable relief options. Emit the same structured WizardResult shape the existing /api/eligibility endpoint uses.
3. **ask** — you need ONE more discriminating fact before you can commit. Ask the single most informative question. Optionally emit 3-6 short quick-reply chips for the UI to render.
4. **escalate** — the person should talk to a human BEFORE filling anything. Use this when you detect: complex strategic choices you shouldn't make for them, facts outside our scope, unresolvable ambiguity after multiple turns, or the user explicitly asks for legal strategy.

Ranked information to collect (ask about what's unknown and most discriminating):
1. Immigration status (citizen / green card holder / TPS / parole / asylee / student visa / work visa / visitor / overstay / uninspected / unsure)
2. Inside US or abroad
3. Family relationships to USCs or LPRs (spouse, parent, child, sibling)
4. Entry method + date
5. Goal (stay / work / green card / citizen / bring family / asylum)
6. Fear of return to home country (gates I-589)

Rules:
- One question per turn. Never ask two.
- Hard cap: after 4 turns of "ask", the next turn MUST commit (route, recommend, or escalate).
- Respond in whatever language the assistantMessage should appear in (see language directive below). Keep USCIS form numbers in Latin script regardless.
- Be humble about uncertainty. "possibly" verdicts beat forced "likely" ones.
- When recommending, prefer fewer higher-quality options (1-3). Order by verdict strength + relevance to goal.
- If the user names a form we don't support, escalate (don't fake-route).
- Accumulate facts across turns — "facts" is carried back to you each call. Only emit facts you're confident about.

Output: call the emit_triage tool exactly once.`

const TOOL_DEFINITION: Tool = {
  name: 'emit_triage',
  description: 'Emit the triage classification and the assistant-facing message to show the user.',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['route', 'recommend', 'ask', 'escalate'],
        description: 'Which of the four outcomes.',
      },
      assistantMessage: {
        type: 'string',
        description: 'The message to display in the chat bubble to the user. Always required.',
      },
      facts: {
        type: 'object',
        description: 'Updated accumulation of what you know about the user. Carry forward what was passed in; add new facts you extracted from this turn.',
        properties: {
          status: { type: 'string' },
          insideUS: { type: 'boolean' },
          family: { type: 'array', items: { type: 'string' } },
          entryMethod: { type: 'string' },
          entryDate: { type: 'string', description: 'ISO yyyy-MM-dd' },
          goal: { type: 'string' },
          fearOfReturn: { type: 'boolean' },
          namedForm: { type: 'string', enum: SUPPORTED_FORM_IDS },
          notes: { type: 'string' },
        },
      },
      // route-only
      formId: {
        type: 'string',
        enum: SUPPORTED_FORM_IDS,
        description: "Only for type=route. The form the user should fill.",
      },
      // ask-only
      question: { type: 'string', description: 'Only for type=ask. The follow-up question.' },
      chips: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only for type=ask. Optional 3-6 short quick-reply choices.',
      },
      // recommend-only
      result: {
        type: 'object',
        description: 'Only for type=recommend. Same shape as /api/eligibility emit_recommendations output.',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                relief: { type: 'string' },
                summary: { type: 'string' },
                verdict: { type: 'string', enum: ['likely', 'possibly', 'unlikely', 'not-eligible'] },
                forms: { type: 'array', items: { type: 'string' } },
                deadlines: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      byDate: { type: 'string' },
                      daysRemaining: { type: 'integer' },
                      severity: { type: 'string', enum: ['critical', 'warn', 'info'] },
                    },
                    required: ['label', 'severity'],
                  },
                },
                evidenceNeeded: { type: 'array', items: { type: 'string' } },
                reasoning: { type: 'string' },
                nextStep: { type: 'string' },
              },
              required: ['id', 'relief', 'summary', 'verdict', 'forms', 'evidenceNeeded', 'reasoning', 'nextStep'],
            },
          },
          urgentDeadlines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                byDate: { type: 'string' },
                daysRemaining: { type: 'integer' },
              },
              required: ['label', 'byDate', 'daysRemaining'],
            },
          },
          disclaimer: { type: 'string' },
        },
        required: ['recommendations', 'disclaimer'],
      },
      // escalate-only
      reason: { type: 'string', description: 'Only for type=escalate. Short user-facing explanation.' },
      severity: {
        type: 'string',
        enum: ['red-flag', 'judgment', 'self-requested', 'turn-cap'],
        description: 'Only for type=escalate.',
      },
    },
    required: ['type', 'assistantMessage'],
  },
}

/** Body shape sent by the TriageChat client. */
type TriageRequest = {
  messages: TriageMessage[]
  facts?: TriageFacts
  language?: string
  /** User clicked the "Speak to a rep" button — short-circuit to escalate. */
  selfRequested?: boolean
}

export async function POST(req: Request) {
  let body: TriageRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const messages = body.messages ?? []
  const incomingFacts: TriageFacts = body.facts ?? {}
  const language = body.language && LANGUAGE_NAMES[body.language] ? body.language : 'en'
  const languageName = LANGUAGE_NAMES[language]

  // Self-requested escalation: skip the LLM entirely.
  if (body.selfRequested) {
    const outcome: TriageOutcome = {
      type: 'escalate',
      reason: 'You asked to speak with a representative.',
      severity: 'self-requested',
      facts: incomingFacts,
      assistantMessage:
        'Got it — flagging this for an accredited representative. Share your contact info below and they\'ll reach out within 48 hours.',
    }
    return NextResponse.json({ ok: true, outcome })
  }

  // Red-flag pre-filter: check the LATEST user message only. Short-circuits
  // to escalate without burning an LLM call. Intentionally over-broad — see
  // RED_FLAG_PATTERNS for reasoning.
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (lastUser) {
    const flag = checkRedFlags(lastUser.content)
    if (flag.hit) {
      console.log(`[triage] RED_FLAG_HIT: ${flag.reason.slice(0, 80)}…`)
      const outcome: TriageOutcome = {
        type: 'escalate',
        reason: flag.reason,
        severity: 'red-flag',
        facts: incomingFacts,
        assistantMessage:
          'Based on what you shared, this needs a human — an accredited representative should review your situation before any form is filed. Share your contact info and they\'ll be in touch within 48 hours.',
      }
      return NextResponse.json({ ok: true, outcome })
    }
  }

  // Count prior "ask" turns. If we've already asked 4+ times, force commit.
  const askCount = messages.filter((m) => m.role === 'assistant' && m.chips !== undefined).length
  const forceCommit = askCount >= 4

  // Build the user payload. Include accumulated facts so the LLM doesn't
  // re-derive and can focus on what's missing.
  const payload = [
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Facts known so far:`,
    '```json',
    JSON.stringify(incomingFacts, null, 2),
    '```',
    '',
    `Turn count: ${askCount} of 4 ask-turns used.` +
      (forceCommit ? ' **You must commit this turn — do not emit type=ask.**' : ''),
    '',
    `Conversation:`,
    ...messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`),
    '',
    'Now emit exactly one triage outcome via the emit_triage tool.',
  ].join('\n')

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: DEFAULTS.maxTokens,
      temperature: DEFAULTS.temperature,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text:
            language === 'en'
              ? 'Respond in clear English at a 5th-grade reading level. Keep USCIS form numbers in English.'
              : `The assistantMessage, question, chips, and all recommendation text fields (relief, summary, reasoning, nextStep, evidenceNeeded, deadline labels, disclaimer, reason) MUST be in ${languageName} at a 5th-grade reading level. Keep USCIS form numbers (e.g. "I-864") in Latin script.`,
        },
      ],
      tools: [TOOL_DEFINITION],
      tool_choice: { type: 'tool', name: 'emit_triage' },
      messages: [{ role: 'user', content: payload }],
    })

    const toolUse = response.content.find(
      (b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use'
    )
    if (!toolUse) {
      return NextResponse.json({ error: 'no_tool_use' }, { status: 502 })
    }

    const raw = toolUse.input as {
      type: TriageOutcome['type']
      assistantMessage: string
      facts?: TriageFacts
      formId?: FormId
      question?: string
      chips?: string[]
      result?: WizardResult
      reason?: string
      severity?: 'red-flag' | 'judgment' | 'self-requested' | 'turn-cap'
    }

    const outgoingFacts = { ...incomingFacts, ...(raw.facts ?? {}) }

    const outcome = buildOutcome(raw, outgoingFacts)
    if (!outcome) {
      return NextResponse.json({ error: 'malformed_tool_output' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, outcome })
  } catch (err) {
    console.error('triage error', err)
    return NextResponse.json(
      { error: 'triage_failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}

/** Validates the raw tool output and narrows it into a discriminated TriageOutcome. */
function buildOutcome(
  raw: {
    type: TriageOutcome['type']
    assistantMessage: string
    formId?: FormId
    question?: string
    chips?: string[]
    result?: WizardResult
    reason?: string
    severity?: 'red-flag' | 'judgment' | 'self-requested' | 'turn-cap'
  },
  facts: TriageFacts
): TriageOutcome | null {
  switch (raw.type) {
    case 'route':
      if (!raw.formId || !SUPPORTED_FORM_IDS.includes(raw.formId)) return null
      return {
        type: 'route',
        formId: raw.formId,
        facts,
        assistantMessage: raw.assistantMessage,
      }
    case 'recommend':
      if (!raw.result) return null
      return {
        type: 'recommend',
        result: raw.result,
        facts,
        assistantMessage: raw.assistantMessage,
      }
    case 'ask':
      if (!raw.question) return null
      return {
        type: 'ask',
        question: raw.question,
        chips: raw.chips,
        facts,
        assistantMessage: raw.assistantMessage,
      }
    case 'escalate':
      return {
        type: 'escalate',
        reason: raw.reason ?? 'This situation needs an accredited representative.',
        severity: raw.severity ?? 'judgment',
        facts,
        assistantMessage: raw.assistantMessage,
      }
    default:
      return null
  }
}
