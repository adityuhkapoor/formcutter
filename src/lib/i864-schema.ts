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
 * Field metadata: pretty labels + source hints for the LLM extraction prompts
 * and chat UI. The LLM uses these to decide which document a field should
 * be extracted from and to explain the question in plain English when
 * asking the user.
 */
export const FIELD_META: Record<string, {
  label: string
  docSource: Array<'license' | 'passport' | 'green-card' | 'tax-return' | 'paystub' | 'user-input'>
  askIfMissing?: string
}> = {
  'part4.name.familyName': {
    label: 'Sponsor family name (last name)',
    docSource: ['license', 'passport'],
  },
  'part4.name.givenName': {
    label: 'Sponsor given name (first name)',
    docSource: ['license', 'passport'],
  },
  'part4.dateOfBirth': {
    label: 'Sponsor date of birth',
    docSource: ['license', 'passport'],
  },
  'part4.ssn': {
    label: 'Sponsor Social Security Number',
    docSource: ['user-input'],
    askIfMissing: 'What is your Social Security Number? (9 digits, with or without dashes)',
  },
  'part4.mailingAddress.streetNumberAndName': {
    label: 'Sponsor mailing street address',
    docSource: ['license', 'user-input'],
  },
  'part4.citizenshipStatus': {
    label: 'Sponsor citizenship status',
    docSource: ['passport', 'green-card', 'user-input'],
    askIfMissing: 'Are you a U.S. citizen, U.S. national, or lawful permanent resident (green card holder)?',
  },
  'part5.householdSizeTotal': {
    label: 'Household size (Part 5 total)',
    docSource: ['user-input'],
    askIfMissing: 'How many people are in your household? Include yourself, the immigrant you are sponsoring, your spouse, any dependent children, and anyone else you claim on your tax return.',
  },
  'part6.currentIndividualAnnualIncome': {
    label: 'Current annual individual income',
    docSource: ['paystub', 'user-input'],
    askIfMissing: 'What is your current yearly income? (Estimate if variable — we will use pay stubs or an employer letter as proof.)',
  },
  'part6.taxReturnIncome.mostRecentYear.totalIncome': {
    label: 'Total income — most recent tax year (1040 line 9)',
    docSource: ['tax-return'],
  },
  'part6.taxReturnIncome.mostRecentYear.taxYear': {
    label: 'Most recent tax year filed',
    docSource: ['tax-return'],
  },
  'part8.sponsorEmail': {
    label: 'Sponsor email',
    docSource: ['user-input'],
    askIfMissing: 'What email address should USCIS use to contact you?',
  },
  'part8.sponsorDaytimePhone': {
    label: 'Sponsor daytime phone',
    docSource: ['user-input'],
    askIfMissing: 'What is a good daytime phone number for you?',
  },
}
