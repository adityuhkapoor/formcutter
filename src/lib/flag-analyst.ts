import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { anthropic, MODEL } from './anthropic'
import { flattenPaths } from './field-paths'
import { FIELD_META } from './i864-schema'
import type { CaseMessage } from './db/schema'
import type { FlagKind, FlagSeverity } from './db/schema'

/**
 * LLM #2: the flag analyst.
 *
 * Takes a case's form state and chat transcript, runs deterministic checks,
 * then asks Claude for judgment-call flags. Returns a typed list the reviewer
 * sees in their queue.
 *
 * This is intentionally separate from the immigrant-facing chat LLM:
 * - Different system prompt ("be thorough, find issues" vs "be friendly")
 * - Different audience (the rep, not the user)
 * - Different accountability (the rep decides what to do with each flag)
 */

const I864_2025_POVERTY_125 = {
  // 125% federal poverty guidelines by household size (2025). Source:
  // USCIS I-864P. Verify against current form edition before production.
  1: 19562,
  2: 26437,
  3: 33312,
  4: 40187,
  5: 47062,
  6: 53937,
  7: 60812,
  8: 67687,
  addlPerson: 6875,
} as const

function povertyThreshold(householdSize: number): number {
  if (householdSize <= 0) return 0
  if (householdSize <= 8) {
    return I864_2025_POVERTY_125[householdSize as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8]
  }
  return I864_2025_POVERTY_125[8] + (householdSize - 8) * I864_2025_POVERTY_125.addlPerson
}

export type AnalyzedFlag = {
  kind: FlagKind
  severity: FlagSeverity
  title: string
  detail: string
  llmReasoning?: string
  suggestedFieldPath?: string
}

// ─── Deterministic checks ───────────────────────────────────────────────

function computedChecks(state: Record<string, unknown>): AnalyzedFlag[] {
  const flat = flattenPaths(state)
  const out: AnalyzedFlag[] = []

  const householdSize = Number(flat['part5.householdSizeTotal'])
  const income = Number(flat['part6.currentIndividualAnnualIncome'])
  const taxTotal = Number(flat['part6.taxReturnIncome.mostRecentYear.totalIncome'])

  // 1) Income vs 125% poverty line
  if (Number.isFinite(householdSize) && householdSize > 0 && Number.isFinite(income)) {
    const threshold = povertyThreshold(householdSize)
    const ratio = income / threshold
    if (income < threshold) {
      out.push({
        kind: 'income_check',
        severity: 'error',
        title: 'Income below 125% poverty line',
        detail: `Current income $${income.toLocaleString()} is below the $${threshold.toLocaleString()} threshold required for a household of ${householdSize}. A joint sponsor or assets (Part 7) will likely be required.`,
        suggestedFieldPath: 'part6.currentIndividualAnnualIncome',
      })
    } else if (ratio < 1.25) {
      out.push({
        kind: 'income_check',
        severity: 'warn',
        title: `Income only ${Math.round(ratio * 100)}% of threshold`,
        detail: `Current income $${income.toLocaleString()} vs required $${threshold.toLocaleString()}. USCIS officers sometimes RFE on borderline cases; recommend asking sponsor to attach 6 months of pay stubs + employer letter.`,
      })
    } else {
      out.push({
        kind: 'income_check',
        severity: 'info',
        title: 'Income comfortably above threshold',
        detail: `$${income.toLocaleString()} is ${Math.round(ratio * 100)}% of the $${threshold.toLocaleString()} threshold for household of ${householdSize}.`,
      })
    }
  }

  // 2) Income vs most-recent tax year — large gap = reviewer should verify
  if (Number.isFinite(income) && Number.isFinite(taxTotal)) {
    const delta = income - taxTotal
    const pct = Math.abs(delta) / Math.max(income, taxTotal)
    if (pct > 0.1) {
      out.push({
        kind: 'source_discrepancy',
        severity: 'warn',
        title: 'Current income differs from most recent tax return',
        detail: `Current annual income reported as $${income.toLocaleString()}, but most recent tax return shows $${taxTotal.toLocaleString()} (${Math.abs(Math.round(pct * 100))}% ${delta > 0 ? 'increase' : 'decrease'}). Verify pay stubs / employer letter support the current figure.`,
      })
    }
  }

  // 3) Required fields not filled
  const missingRequired: string[] = []
  for (const [path, meta] of Object.entries(FIELD_META)) {
    if (meta.tier !== 'required') continue
    if (meta.tier === 'required' && (flat[path] === undefined || flat[path] === '')) {
      missingRequired.push(path)
    }
  }
  if (missingRequired.length > 0) {
    out.push({
      kind: 'incomplete_section',
      severity: missingRequired.length > 3 ? 'error' : 'warn',
      title: `${missingRequired.length} required field${missingRequired.length === 1 ? '' : 's'} still blank`,
      detail: `Missing: ${missingRequired.map((p) => FIELD_META[p]?.label ?? p).slice(0, 8).join('; ')}${missingRequired.length > 8 ? `; and ${missingRequired.length - 8} more` : ''}.`,
    })
  }

  return out
}

// ─── LLM judgment-call flags ────────────────────────────────────────────

const TOOL_DEFINITION: Tool = {
  name: 'emit_flags',
  description:
    'Emit a list of judgment-call review flags for the accredited rep. Focus on things a mechanical check cannot detect.',
  input_schema: {
    type: 'object',
    properties: {
      flags: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: [
                'income_check',
                'legal_strategy',
                'source_discrepancy',
                'incomplete_section',
                'data_quality',
                'other',
              ],
            },
            severity: { type: 'string', enum: ['info', 'warn', 'error'] },
            title: {
              type: 'string',
              description: 'Short (under 80 char) headline the rep sees in the queue.',
            },
            detail: {
              type: 'string',
              description: 'One-paragraph explanation of the issue and what the rep should check.',
            },
            reasoning: {
              type: 'string',
              description: 'Why you raised this — cite specific state values or chat turns.',
            },
            suggestedFieldPath: {
              type: 'string',
              description: 'If the flag is about a specific field, its dotted schema path.',
            },
          },
          required: ['kind', 'severity', 'title', 'detail'],
        },
      },
    },
    required: ['flags'],
  },
}

const ANALYST_SYSTEM = `You are a pre-review assistant for a DOJ-accredited representative reviewing an I-864 Affidavit of Support before USCIS submission.

Your job: scan the sponsor's form state and their chat transcript with our intake assistant. Flag anything the rep should personally verify or decide. Be thorough but focused — every flag you emit costs the rep attention.

Raise flags for:
- Legal-strategy questions the sponsor asked (joint sponsor, domicile, assets vs income, whether they qualify). These were refused by the intake assistant and now need the rep's direct answer.
- Source discrepancies (e.g. name spelled differently across documents, income figures that don't reconcile, dates that conflict).
- Data-quality concerns from document extraction (redacted fields, illegible docs, inferred values the sponsor didn't explicitly confirm).
- Missing conditional sections (user said "married" but no spouse info; user said "self-employed" but no business name).
- Anything a careful human would want to ask the sponsor about before signing Part 8.

Do NOT re-raise:
- Income-vs-poverty-line checks (handled by a deterministic checker separately).
- Missing required fields that are simply blank (handled separately).
- Generic "please review" flags — only raise if there's a specific concern.

Tone: terse, factual. Each flag reads like a senior paralegal's sticky note to the attorney.`

export async function analyzeCase(opts: {
  state: Record<string, unknown>
  messages: CaseMessage[]
}): Promise<AnalyzedFlag[]> {
  const computed = computedChecks(opts.state)

  // Truncate message history for the LLM to avoid sending huge transcripts.
  const recentChat = opts.messages.slice(-30).map((m) => ({
    role: m.role,
    content:
      m.content ||
      (m.attachment ? `[uploaded ${m.attachment.fileName}]` : '(empty)'),
  }))

  const contextMessage = [
    `Form state (dotted paths → values):`,
    '```json',
    JSON.stringify(flattenPaths(opts.state), null, 2),
    '```',
    '',
    `Chat transcript (last ${recentChat.length} turns):`,
    '```json',
    JSON.stringify(recentChat, null, 2),
    '```',
    '',
    `Emit flags the rep should personally attend to. Skip trivial observations.`,
  ].join('\n')

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0,
      system: [
        { type: 'text', text: ANALYST_SYSTEM, cache_control: { type: 'ephemeral' } },
      ],
      tools: [TOOL_DEFINITION],
      tool_choice: { type: 'tool', name: 'emit_flags' },
      messages: [{ role: 'user', content: contextMessage }],
    })

    const toolUse = response.content.find(
      (b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use'
    )
    if (!toolUse) return computed

    const out = toolUse.input as {
      flags: Array<{
        kind: FlagKind
        severity: FlagSeverity
        title: string
        detail: string
        reasoning?: string
        suggestedFieldPath?: string
      }>
    }

    const llmFlags: AnalyzedFlag[] = (out.flags ?? []).map((f) => ({
      kind: f.kind,
      severity: f.severity,
      title: f.title,
      detail: f.detail,
      llmReasoning: f.reasoning,
      suggestedFieldPath: f.suggestedFieldPath,
    }))

    return [...computed, ...llmFlags]
  } catch (err) {
    console.error('flag-analyst error', err)
    // Always return the computed checks even if Claude fails.
    return computed
  }
}
