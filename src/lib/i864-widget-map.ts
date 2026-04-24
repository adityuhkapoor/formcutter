/**
 * Maps our internal I-864 schema paths (e.g. "part4.name.familyName")
 * to USCIS widget fully-qualified names inside public/forms/i-864.pdf
 * (e.g. "form1[0].#subform[0].P4_Line1a_FamilyName[0]").
 *
 * These fully-qualified names are what pdf-lib's form API uses after it
 * strips the XFA wrapper on getForm(). The filler reads them and calls
 * form.getTextField() / getCheckBox() / getDropdown() to fill properly.
 *
 * ─── NAMING MISMATCH HEADS-UP ─────────────────────────────────────────
 * Our schema labels fields by an arbitrary "partN" string. They do NOT
 * align 1:1 with the USCIS form's Part numbers. Specifically:
 *
 *   our schema "part4.*"  ⇄  USCIS form "Part 2 (Sponsor info)"
 *   our schema "part2.*"  ⇄  USCIS form "Part 3 (Principal Immigrant)"
 *
 * The rest (part5, part6, part8) happen to match. This mismatch is a
 * legacy from when the schema was drafted before we read the form. We
 * keep the internal names to avoid churning the LLM prompts + extracted
 * state; the mapping below translates to the correct widgets.
 * ──────────────────────────────────────────────────────────────────────
 */

export type WidgetOp =
  | { kind: 'text'; name: string; value: string }
  | { kind: 'dropdown'; name: string; value: string }
  | { kind: 'checkbox'; name: string; checked: boolean }

const text = (name: string) => (v: unknown): WidgetOp | null => {
  if (v === null || v === undefined || v === '') return null
  return { kind: 'text', name, value: String(v) }
}

const digits = (name: string) => (v: unknown): WidgetOp | null => {
  if (v === null || v === undefined || v === '') return null
  const d = String(v).replace(/\D/g, '')
  return d ? { kind: 'text', name, value: d } : null
}

const money = (name: string) => (v: unknown): WidgetOp | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return { kind: 'text', name, value: v.toLocaleString('en-US') }
}

const integer = (name: string) => (v: unknown): WidgetOp | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return { kind: 'text', name, value: String(Math.trunc(v)) }
}

const mdyDate = (name: string) => (v: unknown): WidgetOp | null => {
  if (typeof v !== 'string') return null
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return { kind: 'text', name, value: `${m[2]}/${m[3]}/${m[1]}` }
}

const dropdown = (name: string) => (v: unknown): WidgetOp | null => {
  if (v === null || v === undefined || v === '') return null
  return { kind: 'dropdown', name, value: String(v).toUpperCase() }
}

const SIMPLE: Record<string, (v: unknown) => WidgetOp | null> = {
  // ─── Sponsor identity (form's "Part 2") ─────────────────────────────
  'part4.name.familyName': text('form1[0].#subform[0].P4_Line1a_FamilyName[0]'),
  'part4.name.givenName': text('form1[0].#subform[0].P4_Line1b_GivenName[0]'),
  'part4.name.middleName': text('form1[0].#subform[0].P4_Line1c_MiddleName[0]'),

  'part4.mailingAddress.streetNumberAndName': text(
    'form1[0].#subform[1].P4_Line2b_StreetNumberName[0]'
  ),
  'part4.mailingAddress.aptSteFlrNumber': text(
    'form1[0].#subform[1].P4_Line2d_AptSteFlrNumber[0]'
  ),
  'part4.mailingAddress.cityOrTown': text(
    'form1[0].#subform[1].P4_Line2e_CityOrTown[0]'
  ),
  'part4.mailingAddress.state': dropdown(
    'form1[0].#subform[1].P4_Line2f_State[0]'
  ),
  'part4.mailingAddress.zipCode': text(
    'form1[0].#subform[1].P4_Line2g_ZipCode[0]'
  ),
  'part4.mailingAddress.province': text(
    'form1[0].#subform[1].P4_Line2h_Province[0]'
  ),
  'part4.mailingAddress.postalCode': text(
    'form1[0].#subform[1].P4_Line2i_PostalCode[0]'
  ),
  'part4.mailingAddress.country': text(
    'form1[0].#subform[1].P4_Line2j_Country[0]'
  ),

  'part4.countryOfDomicile': text('form1[0].#subform[1].P4_Line5_CountryOfDomicile[0]'),
  'part4.dateOfBirth': mdyDate('form1[0].#subform[1].P4_Line6_DateOfBirth[0]'),
  'part4.placeOfBirth.cityOrTown': text(
    'form1[0].#subform[1].P4_Line7_CityofBirth[0]'
  ),
  'part4.ssn': digits('form1[0].#subform[1].P4_Line10_SocialSecurityNumber[0]'),

  // ─── Household size (Part 5) ─────────────────────────────────────────
  'part5.self': integer('form1[0].#subform[4].P5_Line2_Yourself[0]'),
  'part5.spouse': integer('form1[0].#subform[4].P5_Line3_Married[0]'),
  'part5.dependentChildren': integer(
    'form1[0].#subform[4].P5_Line4_DependentChildren[0]'
  ),
  'part5.otherDependentsOnTaxReturn': integer(
    'form1[0].#subform[4].P5_Line5_OtherDependents[0]'
  ),
  'part5.priorI864Obligations': integer(
    'form1[0].#subform[4].P5_Line6_Sponsors[0]'
  ),
  'part5.householdMembersI864A': integer(
    'form1[0].#subform[4].P5_Line7_SameResidence[0]'
  ),
  'part5.householdSizeTotal': integer('form1[0].#subform[4].Override[0]'),

  // ─── Employment and income (Part 6) ──────────────────────────────────
  'part6.occupation': text('form1[0].#subform[4].P6_Line1a_NameofEmployer[0]'),
  'part6.employerOrBusinessName': text(
    'form1[0].#subform[4].P6_Line1a1_NameofEmployer[0]'
  ),
  'part6.currentIndividualAnnualIncome': money(
    'form1[0].#subform[4].P6_Line2_TotalIncome[0]'
  ),
  'part6.currentAnnualHouseholdIncome': money(
    'form1[0].#subform[5].P6_Line15_TotalHouseholdIncome[0]'
  ),

  'part6.taxReturnIncome.mostRecentYear.taxYear': integer(
    'form1[0].#subform[6].P6_Line19a_TaxYear[0]'
  ),
  'part6.taxReturnIncome.mostRecentYear.totalIncome': money(
    'form1[0].#subform[6].P6_Line19a_TotalIncome[0]'
  ),
  'part6.taxReturnIncome.twoYearsAgo.taxYear': integer(
    'form1[0].#subform[6].P6_Line19b_TaxYear[0]'
  ),
  'part6.taxReturnIncome.twoYearsAgo.totalIncome': money(
    'form1[0].#subform[6].P6_Line19b_TotalIncome[0]'
  ),
  'part6.taxReturnIncome.threeYearsAgo.taxYear': integer(
    'form1[0].#subform[6].P6_Line19c_TaxYear[0]'
  ),
  'part6.taxReturnIncome.threeYearsAgo.totalIncome': money(
    'form1[0].#subform[6].P6_Line19c_TotalIncome[0]'
  ),

  // ─── Contact + signature (Part 8) ────────────────────────────────────
  'part8.sponsorDaytimePhone': text(
    'form1[0].#subform[9].P8_Line3_DaytimeTelephoneNumber[0]'
  ),
  'part8.sponsorMobilePhone': text(
    'form1[0].#subform[9].P8_Line4_MobileTelephoneNumber[0]'
  ),
  'part8.sponsorEmail': text('form1[0].#subform[9].P7Line7_EmailAddress[0]'),
  'part8.signatureDate': mdyDate(
    'form1[0].#subform[9].P7Line9b_DateofSignature[0]'
  ),
}

const CITIZENSHIP_FIELDS = {
  'us-citizen': 'form1[0].#subform[1].P4_Line11a_Checkbox[0]',
  'us-national': 'form1[0].#subform[1].P4_Line11b_Checkbox[0]',
  lpr: 'form1[0].#subform[1].P4_Line11c_Checkbox[0]',
} as const

const EMPLOYMENT_FIELDS = {
  employed: 'form1[0].#subform[4].P6_Line1_Checkbox[0]',
  selfEmployed: 'form1[0].#subform[4].P6_Line4_Checkbox[0]',
  retired: 'form1[0].#subform[4].P6_Line5_Checkbox[0]',
  unemployed: 'form1[0].#subform[4].P6_Line6_Checkbox[0]',
} as const

export function resolveSchemaPath(path: string, value: unknown): WidgetOp[] {
  if (path === 'part4.citizenshipStatus' && typeof value === 'string') {
    const name = CITIZENSHIP_FIELDS[value as keyof typeof CITIZENSHIP_FIELDS]
    return name ? [{ kind: 'checkbox', name, checked: true }] : []
  }

  if (path.startsWith('part6.employment.')) {
    const key = path.slice('part6.employment.'.length) as keyof typeof EMPLOYMENT_FIELDS
    const name = EMPLOYMENT_FIELDS[key]
    if (name && value === true) return [{ kind: 'checkbox', name, checked: true }]
    return []
  }

  const resolver = SIMPLE[path]
  if (!resolver) return []
  const op = resolver(value)
  return op ? [op] : []
}
