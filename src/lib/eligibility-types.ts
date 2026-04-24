/**
 * Eligibility wizard data contracts. Kept separate from route/schema so
 * both server (LLM call) and client (UI) can import without bundling
 * server-only deps.
 */

export const IMMIGRATION_STATUS_OPTIONS = [
  { value: 'usc', label: 'U.S. citizen' },
  { value: 'lpr', label: 'Green card holder (LPR)' },
  { value: 'tps', label: 'Temporary Protected Status (TPS)' },
  { value: 'parole', label: 'Paroled at the border or through a program' },
  { value: 'asylee', label: 'Asylee / refugee' },
  { value: 'student', label: 'Student visa (F-1 / M-1 / J-1)' },
  { value: 'work', label: 'Work visa (H-1B, L-1, O-1, etc.)' },
  { value: 'visitor', label: 'Visitor visa (B-1 / B-2) or ESTA' },
  { value: 'overstay', label: 'Overstayed a visa' },
  { value: 'uninspected', label: 'Entered without being inspected' },
  { value: 'unsure', label: "I'm not sure" },
] as const

export const ENTRY_METHOD_OPTIONS = [
  { value: 'visa', label: 'With a visa' },
  { value: 'border-parole', label: 'Through a border checkpoint / got parole' },
  { value: 'border-uninspected', label: 'Crossed the border without being checked' },
  { value: 'born-here', label: 'I was born in the U.S.' },
  { value: 'adjusted', label: "I'm already a green card holder" },
  { value: 'unsure', label: "I'm not sure" },
] as const

export const FAMILY_OPTIONS = [
  { value: 'spouse-usc', label: 'Spouse who is a U.S. citizen' },
  { value: 'spouse-lpr', label: 'Spouse who has a green card' },
  { value: 'parent-usc', label: 'Parent who is a U.S. citizen (and I am over 21)' },
  { value: 'parent-usc-under21', label: 'Parent who is a U.S. citizen (I am under 21)' },
  { value: 'child-usc-21', label: 'Adult U.S. citizen child (over 21)' },
  { value: 'sibling-usc', label: 'Sibling who is a U.S. citizen (and I am over 21)' },
  { value: 'none', label: 'None of the above' },
  { value: 'unsure', label: "I'm not sure" },
] as const

export const REMOVAL_OPTIONS = [
  { value: 'yes-active', label: 'Yes, I have an active case / hearing scheduled' },
  { value: 'yes-past', label: "I've been ordered removed / deported in the past" },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: "I'm not sure" },
] as const

export const GOAL_OPTIONS = [
  { value: 'stay', label: 'Stay in the U.S. legally' },
  { value: 'work', label: 'Get permission to work' },
  { value: 'green-card', label: 'Get a green card' },
  { value: 'citizen', label: 'Become a U.S. citizen' },
  { value: 'family', label: 'Bring family from abroad' },
  { value: 'asylum', label: 'Apply for asylum' },
  { value: 'unsure', label: "I'm not sure" },
] as const

export type WizardAnswers = {
  status: string
  entry: string
  entryDate?: string // ISO yyyy-MM-dd
  family: string[]
  removal: string
  goal: string
}

export type ReliefVerdict = 'likely' | 'possibly' | 'unlikely' | 'not-eligible'

export type ReliefRecommendation = {
  id: string
  relief: string
  summary: string
  verdict: ReliefVerdict
  forms: string[]
  deadlines?: Array<{ label: string; byDate?: string; daysRemaining?: number; severity: 'critical' | 'warn' | 'info' }>
  evidenceNeeded: string[]
  reasoning: string
  nextStep: string
}

export type WizardResult = {
  recommendations: ReliefRecommendation[]
  urgentDeadlines: Array<{ label: string; byDate: string; daysRemaining: number }>
  disclaimer: string
}
