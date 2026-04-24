import { NextResponse } from 'next/server'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { anthropic, MODEL, DEFAULTS } from '@/lib/anthropic'
import type { WizardAnswers, WizardResult } from '@/lib/eligibility-types'

export const runtime = 'nodejs'
export const maxDuration = 45

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

const SYSTEM_PROMPT = `You are an immigration-triage analyst helping a non-lawyer who just took a short intake screener. Your only job is to map their answers to a RANKED list of immigration relief options they may be eligible for.

You are NOT a lawyer. You are NOT giving legal advice. You are helping them narrow down what to research or ask a lawyer about.

Produce a prioritized list of relief pathways. For each:
- Name the relief (e.g. "Family-based green card through U.S. citizen spouse", "Asylum", "Naturalization (N-400)")
- Verdict: "likely" / "possibly" / "unlikely" / "not-eligible"
- USCIS form(s) required: use official form numbers (I-130, I-864, I-485, N-400, I-589, I-821, I-765, etc.)
- Evidence they'll need to collect
- Key deadlines (especially parole → 1-year asylum window, LPR → 5-year naturalization eligibility, visa overstays, TPS re-registration periods)
- One-sentence plain-language reasoning
- One-sentence concrete next step

Also surface any URGENT deadlines separately so the UI can highlight them.

Rules:
- Parole entrants have a 1-year asylum filing deadline from last entry. Compute days remaining if entryDate given.
- LPRs need 5 years post-green-card to file N-400 (3 years if married to a U.S. citizen).
- Active removal proceedings change everything — always flag "see an attorney immediately" when removal is yes-active.
- U.S. citizens generally don't need immigration relief for themselves — redirect to family-based petitioning.
- Be humble about uncertainty; "possibly" is better than "likely" if the facts are ambiguous.
- Never list more than 5 relief options. Prefer fewer, higher-quality.
- Order by relevance to their stated goal + verdict strength.

End with a disclaimer (one sentence) reminding them this is not legal advice and an accredited rep / attorney should confirm.`

const TOOL_DEFINITION: Tool = {
  name: 'emit_recommendations',
  description: 'Emit ranked relief recommendations for the user.',
  input_schema: {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Short kebab-case identifier, e.g. "family-i130-spouse-usc"' },
            relief: { type: 'string', description: 'Full name of the relief pathway.' },
            summary: { type: 'string', description: 'One-sentence plain-language description.' },
            verdict: { type: 'string', enum: ['likely', 'possibly', 'unlikely', 'not-eligible'] },
            forms: {
              type: 'array',
              items: { type: 'string' },
              description: 'USCIS form numbers, e.g. ["I-130", "I-864", "I-485"]',
            },
            deadlines: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  byDate: { type: 'string', description: 'ISO yyyy-MM-dd' },
                  daysRemaining: { type: 'integer' },
                  severity: { type: 'string', enum: ['critical', 'warn', 'info'] },
                },
                required: ['label', 'severity'],
              },
            },
            evidenceNeeded: {
              type: 'array',
              items: { type: 'string' },
              description: 'Plain-language list of documents required.',
            },
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
}

export async function POST(req: Request) {
  let body: { answers?: WizardAnswers; language?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const answers = body.answers
  if (!answers) return NextResponse.json({ error: 'missing_answers' }, { status: 400 })

  const language = body.language && LANGUAGE_NAMES[body.language] ? body.language : 'en'
  const languageName = LANGUAGE_NAMES[language]

  const payload = [
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    '',
    `User's answers:`,
    '```json',
    JSON.stringify(answers, null, 2),
    '```',
    '',
    `Produce a ranked list of relief options with USCIS forms + evidence + deadlines. Highlight urgent deadlines.`,
  ].join('\n')

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      temperature: DEFAULTS.temperature,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text:
            language === 'en'
              ? 'Respond in clear English at a 5th-grade reading level.'
              : `Every user-facing string (relief, summary, reasoning, nextStep, evidenceNeeded, deadline labels, disclaimer) must be in ${languageName} at a 5th-grade reading level. Keep USCIS form numbers (like "I-864") in English/Latin script.`,
        },
      ],
      tools: [TOOL_DEFINITION],
      tool_choice: { type: 'tool', name: 'emit_recommendations' },
      messages: [{ role: 'user', content: payload }],
    })

    const toolUse = response.content.find(
      (b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use'
    )
    if (!toolUse) {
      return NextResponse.json({ error: 'no_tool_use' }, { status: 502 })
    }

    const result = toolUse.input as WizardResult
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('eligibility error', err)
    return NextResponse.json(
      { error: 'eligibility_failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}
