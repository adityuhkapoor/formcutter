import { z } from 'zod'

/**
 * I-864 Affidavit of Support — typed field schema.
 *
 * Scope: MVP fields that appear on every standard sponsor filing.
 * Grouped by form Part. Field names mirror the USCIS instructions wording
 * so LLM extraction prompts can reference them directly.
 *
 * Form reference: 12-page PDF at public/forms/i-864.pdf (2025-05-12 edition).
 */

const USState = z.string().length(2).toUpperCase()
const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const USMoney = z.number().nonnegative()
const SSN = z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/).optional()
const ANumber = z.string().regex(/^A?\d{7,9}$/i).optional()

const Address = z.object({
  streetNumberAndName: z.string(),
  aptSteFlrNumber: z.string().optional(),
  cityOrTown: z.string(),
  state: USState,
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().default('USA'),
})

const PersonName = z.object({
  familyName: z.string(),
  givenName: z.string(),
  middleName: z.string().optional(),
})

// ─── Part 1 — Basis For Filing ───────────────────────────────────────────
export const Part1Schema = z.object({
  relationship: z.enum([
    'spouse',
    'child',
    'parent',
    'sibling',
    'i130-petitioner',
    'joint-sponsor',
    'substitute-sponsor',
    'five-percent-owner',
  ]),
})

// ─── Part 2 — Principal Immigrant ────────────────────────────────────────
export const Part2Schema = z.object({
  name: PersonName,
  dateOfBirth: ISODate,
  countryOfCitizenship: z.string(),
  mailingAddress: Address,
  aNumber: ANumber,
  uscisOnlineAccountNumber: z.string().optional(),
  ssn: SSN,
})

// ─── Part 4 — Sponsor ───────────────────────────────────────────────────
export const Part4Schema = z.object({
  name: PersonName,
  mailingAddress: Address,
  placeOfResidence: Address.optional(), // only if different from mailing
  countryOfDomicile: z.string().default('USA'),
  dateOfBirth: ISODate,
  placeOfBirth: z.object({
    cityOrTown: z.string(),
    state: z.string().optional(),
    country: z.string(),
  }),
  aNumber: ANumber,
  ssn: SSN,
  uscisOnlineAccountNumber: z.string().optional(),
  citizenshipStatus: z.enum([
    'us-citizen',
    'us-national',
    'lpr', // lawful permanent resident
  ]),
})

// ─── Part 5 — Household Size ────────────────────────────────────────────
export const Part5Schema = z.object({
  // Question 1 — immigrants being sponsored (Part 3 count)
  sponsoredImmigrantsCount: z.number().int().nonnegative(),
  // Question 2 — person 1 (yourself) = always 1
  self: z.literal(1).default(1),
  // Question 3 — spouse
  spouse: z.number().int().min(0).max(1).default(0),
  // Question 4 — dependent children
  dependentChildren: z.number().int().nonnegative().default(0),
  // Question 5 — other dependents on most recent tax return
  otherDependentsOnTaxReturn: z.number().int().nonnegative().default(0),
  // Question 6 — current I-864 obligations for prior immigrants
  priorI864Obligations: z.number().int().nonnegative().default(0),
  // Question 7 — household members on I-864A (same residence)
  householdMembersI864A: z.number().int().nonnegative().default(0),
  // Question 8 — computed total
  householdSizeTotal: z.number().int().positive(),
})

// ─── Part 6 — Employment and Income ─────────────────────────────────────
export const Part6Schema = z.object({
  employment: z.object({
    employed: z.boolean().default(false),
    selfEmployed: z.boolean().default(false),
    retired: z.boolean().default(false),
    retiredDate: ISODate.optional(),
    unemployed: z.boolean().default(false),
    unemployedSince: ISODate.optional(),
  }),
  employerOrBusinessName: z.string().optional(),
  occupation: z.string().optional(),

  // Q2 — current individual annual income
  currentIndividualAnnualIncome: USMoney,

  // Q3-5 — if using household members, list each (simplified for MVP)
  householdMembersContributingIncome: z.array(z.object({
    name: PersonName,
    income: USMoney,
    relationship: z.string(),
    filedI864A: z.boolean().default(false),
  })).default([]),

  // Q6 — household income total
  currentAnnualHouseholdIncome: USMoney,

  // Q7 — intending immigrant's income counted
  intendingImmigrantIncomeCounted: z.boolean().default(false),
  intendingImmigrantIncome: USMoney.optional(),

  // Q13a-c — federal tax return income (most recent 3 years, newest first)
  taxReturnIncome: z.object({
    mostRecentYear: z.object({
      taxYear: z.number().int().min(2000).max(2100),
      totalIncome: USMoney, // 1040 line that says "Total income" (currently line 9)
    }),
    twoYearsAgo: z.object({
      taxYear: z.number().int(),
      totalIncome: USMoney,
    }).optional(),
    threeYearsAgo: z.object({
      taxYear: z.number().int(),
      totalIncome: USMoney,
    }).optional(),
  }),

  // Q20 — did not file federal tax return (explanation required)
  didNotFileTaxReturn: z.boolean().default(false),
  didNotFileExplanation: z.string().optional(),
})

// ─── Part 7 — Assets (only used if Part 6 income below 125%) ────────────
export const Part7Schema = z.object({
  use: z.boolean().default(false),
  sponsorAssets: z.object({
    savingsAndChecking: USMoney.default(0),
    stocksBondsCDs: USMoney.default(0),
    realEstateNetValue: USMoney.default(0),
    total: USMoney,
  }).optional(),
  householdMemberAssets: USMoney.default(0),
  intendingImmigrantAssets: USMoney.default(0),
  totalAssets: USMoney.default(0),
}).optional()

// ─── Part 8 — Signature ─────────────────────────────────────────────────
export const Part8Schema = z.object({
  sponsorDaytimePhone: z.string(),
  sponsorMobilePhone: z.string().optional(),
  sponsorEmail: z.string().email(),
  signatureDate: ISODate,
})

// ─── Full form ──────────────────────────────────────────────────────────
export const I864Schema = z.object({
  part1: Part1Schema.partial(),
  part2: Part2Schema.partial(),
  part4: Part4Schema.partial(),
  part5: Part5Schema.partial(),
  part6: Part6Schema.partial(),
  part7: Part7Schema.optional(),
  part8: Part8Schema.partial(),
})

export type I864Data = z.infer<typeof I864Schema>
export type I864PartialData = z.input<typeof I864Schema>

/**
 * Field metadata: labels, tier, why-USCIS-needs-it, source hints.
 *
 * - `tier: required` → USCIS rejects without it. Gate submission.
 * - `tier: conditional` → required only if a trigger matches (e.g. spouse info only
 *   needed if married). Chat should ask only when the trigger condition is true.
 * - `tier: optional` → strengthens case but isn't blocking.
 *
 * `why` is a one-line plain-English reason surfaced in chat when we ask for the
 * field, so users understand the request. Mirrors the standard healthcare /
 * fintech KYC "why we need this" pattern.
 *
 * `sensitivity` flags fields that should be masked in chat bubbles (e.g. SSN →
 * show only last 4). The form state panel displays full values with a
 * show/hide toggle.
 */
export type FieldMeta = {
  label: string
  tier: 'required' | 'conditional' | 'optional'
  why: string
  docSource: Array<'license' | 'passport' | 'green-card' | 'tax-return' | 'paystub' | 'user-input'>
  sensitivity?: 'high' | 'low'
  /** If tier is "conditional", this is the dotted path whose truthy value triggers the field. */
  conditionOn?: string
  /** Optional prewritten question the assistant can open with. */
  askIfMissing?: string
}

export const FIELD_META: Record<string, FieldMeta> = {
  // ─── Sponsor identity ───────────────────────────────────────────────
  'part4.name.familyName': {
    label: 'Sponsor family name (last name)',
    tier: 'required',
    why: 'USCIS matches the sponsor to their tax records and citizenship documents by legal name.',
    docSource: ['license', 'passport'],
  },
  'part4.name.givenName': {
    label: 'Sponsor given name (first name)',
    tier: 'required',
    why: 'Part of the sponsor\'s legal name on record with USCIS.',
    docSource: ['license', 'passport'],
  },
  'part4.name.middleName': {
    label: 'Sponsor middle name',
    tier: 'optional',
    why: 'Included if it appears on the sponsor\'s government ID; not required if they don\'t have one.',
    docSource: ['license', 'passport'],
  },
  'part4.dateOfBirth': {
    label: 'Sponsor date of birth',
    tier: 'required',
    why: 'USCIS confirms identity and matches the sponsor to their tax return and citizenship record.',
    docSource: ['license', 'passport'],
  },
  'part4.ssn': {
    label: 'Sponsor Social Security Number',
    tier: 'required',
    why: 'USCIS uses the SSN to verify the sponsor\'s tax return income. This is the single most checked field on the I-864.',
    docSource: ['tax-return', 'user-input'],
    sensitivity: 'high',
    askIfMissing: 'What\'s your Social Security Number? We\'ll use it to match the tax return info to your name on record.',
  },
  'part4.mailingAddress.streetNumberAndName': {
    label: 'Sponsor mailing street address',
    tier: 'required',
    why: 'USCIS sends receipt notices, RFEs, and decisions to this address.',
    docSource: ['license', 'user-input'],
  },
  'part4.mailingAddress.cityOrTown': {
    label: 'Sponsor mailing city',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['license', 'user-input'],
  },
  'part4.mailingAddress.state': {
    label: 'Sponsor mailing state',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['license', 'user-input'],
  },
  'part4.mailingAddress.zipCode': {
    label: 'Sponsor ZIP code',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['license', 'user-input'],
  },
  'part4.citizenshipStatus': {
    label: 'Sponsor citizenship status',
    tier: 'required',
    why: 'Only U.S. citizens, U.S. nationals, or lawful permanent residents can sponsor. USCIS checks this first.',
    docSource: ['passport', 'green-card', 'user-input'],
    askIfMissing: 'Are you a U.S. citizen, U.S. national, or a green card holder (lawful permanent resident)?',
  },

  // ─── Household composition (Part 5) ─────────────────────────────────
  'part5.self': {
    label: 'Count for yourself',
    tier: 'required',
    why: 'Household size determines the 125% poverty line your income must meet. Yourself counts as 1.',
    docSource: ['user-input'],
  },
  'part5.spouse': {
    label: 'Spouse count (0 or 1)',
    tier: 'required',
    why: 'Your spouse counts toward household size whether or not they earn income.',
    docSource: ['tax-return', 'user-input'],
    askIfMissing: 'Are you currently married? (If yes, your spouse is included in the household count.)',
  },
  'part5.dependentChildren': {
    label: 'Number of dependent children',
    tier: 'required',
    why: 'Each dependent child raises the income threshold USCIS requires.',
    docSource: ['tax-return', 'user-input'],
    askIfMissing: 'How many dependent children do you have?',
  },
  'part5.otherDependentsOnTaxReturn': {
    label: 'Other dependents on your tax return',
    tier: 'optional',
    why: 'Other people you claim as dependents on your 1040 (parents, in-laws, adult children) count toward household size.',
    docSource: ['tax-return', 'user-input'],
  },
  'part5.priorI864Obligations': {
    label: 'Prior I-864 obligations still active',
    tier: 'conditional',
    why: 'If you\'ve sponsored someone else in the past and they haven\'t naturalized / earned 40 quarters / died, they still count toward your household size.',
    docSource: ['user-input'],
    conditionOn: 'part4.hasPreviouslySponsored',
  },
  'part5.householdSizeTotal': {
    label: 'Total household size',
    tier: 'required',
    why: 'Computed total — USCIS uses this to check your income against the 125% poverty guideline.',
    docSource: ['user-input'],
  },

  // ─── Employment + income (Part 6) ───────────────────────────────────
  'part6.employment.employed': {
    label: 'Currently employed',
    tier: 'required',
    why: 'USCIS needs to know the sponsor\'s current employment status to assess income stability.',
    docSource: ['paystub', 'user-input'],
    askIfMissing: 'Are you currently employed, self-employed, retired, or unemployed?',
  },
  'part6.employerOrBusinessName': {
    label: 'Current employer name',
    tier: 'conditional',
    why: 'USCIS uses the employer name to verify your current income source.',
    docSource: ['paystub', 'user-input'],
    conditionOn: 'part6.employment.employed',
  },
  'part6.occupation': {
    label: 'Occupation',
    tier: 'optional',
    why: 'Gives USCIS context about the sponsor\'s income type.',
    docSource: ['paystub', 'user-input'],
  },
  'part6.currentIndividualAnnualIncome': {
    label: 'Current annual individual income',
    tier: 'required',
    why: 'This is the main number USCIS compares against the 125% poverty line. It can differ from last year\'s tax return if you\'ve gotten a raise or changed jobs.',
    docSource: ['paystub', 'user-input'],
    askIfMissing: 'What is your current yearly income? (Estimate is fine — we\'ll back it up with pay stubs.)',
  },
  'part6.taxReturnIncome.mostRecentYear.totalIncome': {
    label: 'Total income — most recent tax year',
    tier: 'required',
    why: 'USCIS cross-checks this against your IRS tax transcript. It\'s Line 9 (Total Income) on the 1040, not AGI.',
    docSource: ['tax-return'],
  },
  'part6.taxReturnIncome.mostRecentYear.taxYear': {
    label: 'Most recent tax year filed',
    tier: 'required',
    why: 'USCIS wants the most recent year\'s tax return attached to the packet.',
    docSource: ['tax-return'],
  },

  // ─── Contact + signature (Part 8) ────────────────────────────────────
  'part8.sponsorEmail': {
    label: 'Sponsor email',
    tier: 'required',
    why: 'USCIS uses this for secondary communication and case status updates.',
    docSource: ['user-input'],
    askIfMissing: 'What email address can USCIS use to reach you?',
  },
  'part8.sponsorDaytimePhone': {
    label: 'Sponsor daytime phone',
    tier: 'required',
    why: 'USCIS may call to clarify during review.',
    docSource: ['user-input'],
    askIfMissing: 'What\'s a good daytime phone number?',
  },
  'part8.signatureDate': {
    label: 'Date signed',
    tier: 'required',
    why: 'Signature date cannot be more than 6 months before filing. We\'ll fill today\'s date at the end.',
    docSource: ['user-input'],
  },
}

/** Schema paths whose full value must NOT appear in chat bubbles. */
export const SENSITIVE_PATHS = new Set(
  Object.entries(FIELD_META)
    .filter(([, m]) => m.sensitivity === 'high')
    .map(([p]) => p)
)
