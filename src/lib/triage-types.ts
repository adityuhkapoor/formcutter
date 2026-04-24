/**
 * Types + constants shared between the landing triage chat (client), the
 * /api/triage route, and the rep console (which renders the transcript when
 * a case escalated from triage).
 */

import type { FormId } from './forms'
import type { WizardResult } from './eligibility-types'

/** Rolling structured facts the triage LLM accumulates across turns. */
export type TriageFacts = {
  status?: string
  insideUS?: boolean
  family?: string[]
  entryMethod?: string
  entryDate?: string // ISO yyyy-MM-dd
  goal?: string
  fearOfReturn?: boolean
  namedForm?: FormId
  /** Free-form notes the LLM wants to carry across turns. */
  notes?: string
}

export type TriageMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  /** Only present on `ask` turns — quick-reply choices surfaced as chips. */
  chips?: string[]
}

export type TriageRouteOutcome = {
  type: 'route'
  formId: FormId
  facts: TriageFacts
  assistantMessage: string
}

export type TriageRecommendOutcome = {
  type: 'recommend'
  result: WizardResult
  facts: TriageFacts
  assistantMessage: string
}

export type TriageAskOutcome = {
  type: 'ask'
  question: string
  chips?: string[]
  facts: TriageFacts
  assistantMessage: string
}

export type TriageEscalateOutcome = {
  type: 'escalate'
  reason: string
  severity: 'red-flag' | 'judgment' | 'self-requested' | 'turn-cap'
  facts: TriageFacts
  assistantMessage: string
}

export type TriageOutcome =
  | TriageRouteOutcome
  | TriageRecommendOutcome
  | TriageAskOutcome
  | TriageEscalateOutcome

/**
 * Hard red-flag patterns. Anything here short-circuits the triage without an
 * LLM call — these are situations where DIY form advice could harm the user.
 * Intentionally over-broad: false positives (extra human review) are cheap,
 * false negatives (missed removal proceedings etc.) are not.
 */
export const RED_FLAG_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(immigration court|master calendar|merits hearing|deport(ed|ation)?|removal proceeding|received (an? )?(nta|notice to appear)|ice detainer|expedited removal|reinstatement of removal)\b/i,
    reason: 'Active or prior removal proceedings — outcome depends on legal strategy an AI shouldn\'t choose.',
  },
  {
    pattern: /\b(arrested|convicted|conviction|misdemeanor|felony|dui|dwi|criminal (record|charge|history)|charged with|pending charges?|open warrant)\b/i,
    reason: 'Criminal history — affects inadmissibility grounds and needs human review before any filing.',
  },
  {
    pattern: /\b(lied on|misrepresent(ed|ation)|false (statement|information)|fake (document|marriage)|marriage fraud|visa fraud)\b/i,
    reason: 'Prior fraud or misrepresentation — permanent bars may apply; requires an accredited rep.',
  },
  {
    pattern: /\b(they(')?ll (kill|harm|torture) me|fear (being )?(killed|tortured|persecut)|persecut(ed|ion)|asylum (claim|case|nexus))\b/i,
    reason: 'Asylum/persecution facts — the nexus analysis is strategic and must involve a human.',
  },
  {
    pattern: /\b(i-?751|i-?601|i-?212|i-?918|i-?914|vawa|u[- ]visa|t[- ]visa)\b/i,
    reason: 'Form or relief Formcutter doesn\'t support yet — handed to an accredited rep.',
  },
  {
    pattern: /\b(what should i do|what('s| is) my best (option|strategy)|what would you recommend|should i (file|apply)|is it (safe|risky) to)\b/i,
    reason: 'User asked for strategic legal advice — beyond an AI\'s scope.',
  },
]

export function checkRedFlags(text: string): { hit: true; reason: string } | { hit: false } {
  for (const { pattern, reason } of RED_FLAG_PATTERNS) {
    if (pattern.test(text)) return { hit: true, reason }
  }
  return { hit: false }
}
