/**
 * Maps our internal I-864 schema paths (e.g. "part4.name.familyName")
 * to the USCIS widget names inside public/forms/i-864.pdf
 * (e.g. "P4_Line1a_FamilyName[0]").
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

export type WidgetValue =
  | { kind: 'text'; value: string }
  | { kind: 'checkbox'; checked: boolean }

export type SchemaToWidget = {
  /** Widget name (e.g. "P4_Line1a_FamilyName[0]") */
  widget: string
  /** Renderer: takes the schema value, returns what to set on the widget. */
  render: (value: unknown) => WidgetValue | null
}

const text = (value: unknown): WidgetValue | null => {
  if (value === null || value === undefined || value === '') return null
  return { kind: 'text', value: String(value) }
}

/** Strip non-digits — for SSN fields that use per-char box layout and a /MaxLen
 * of 9, so dashes eat character slots. */
const digitsOnly = (value: unknown): WidgetValue | null => {
  if (value === null || value === undefined || value === '') return null
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return null
  return { kind: 'text', value: digits }
}

const money = (value: unknown): WidgetValue | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return { kind: 'text', value: value.toLocaleString('en-US') }
}

const mdyDate = (value: unknown): WidgetValue | null => {
  if (typeof value !== 'string') return null
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return { kind: 'text', value: `${m[2]}/${m[3]}/${m[1]}` }
}

const integer = (value: unknown): WidgetValue | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return { kind: 'text', value: String(Math.trunc(value)) }
}

const SIMPLE: Record<string, SchemaToWidget> = {
  // ─── Sponsor identity (USCIS Part 2) ────────────────────────────────
  'part4.name.familyName': { widget: 'P4_Line1a_FamilyName[0]', render: text },
  'part4.name.givenName': { widget: 'P4_Line1b_GivenName[0]', render: text },
  'part4.name.middleName': { widget: 'P4_Line1c_MiddleName[0]', render: text },

  'part4.mailingAddress.streetNumberAndName': {
    widget: 'P4_Line2b_StreetNumberName[0]',
    render: text,
  },
  'part4.mailingAddress.aptSteFlrNumber': {
    widget: 'P4_Line2d_AptSteFlrNumber[0]',
    render: text,
  },
  'part4.mailingAddress.cityOrTown': {
    widget: 'P4_Line2e_CityOrTown[0]',
    render: text,
  },
  'part4.mailingAddress.state': {
    widget: 'P4_Line2f_State[0]',
    render: text, // /Ch dropdown — value must match one of the options (2-letter state code works for these)
  },
  'part4.mailingAddress.zipCode': {
    widget: 'P4_Line2g_ZipCode[0]',
    render: text,
  },
  'part4.mailingAddress.province': {
    widget: 'P4_Line2h_Province[0]',
    render: text,
  },
  'part4.mailingAddress.postalCode': {
    widget: 'P4_Line2i_PostalCode[0]',
    render: text,
  },
  'part4.mailingAddress.country': {
    widget: 'P4_Line2j_Country[0]',
    render: text,
  },

  'part4.countryOfDomicile': {
    widget: 'P4_Line5_CountryOfDomicile[0]',
    render: text,
  },
  'part4.dateOfBirth': {
    widget: 'P4_Line6_DateOfBirth[0]',
    render: mdyDate,
  },
  'part4.placeOfBirth.cityOrTown': {
    widget: 'P4_Line7_CityofBirth[0]',
    render: text,
  },
  'part4.ssn': {
    widget: 'P4_Line10_SocialSecurityNumber[0]',
    render: digitsOnly,
  },

  // ─── Household size (USCIS Part 5) ──────────────────────────────────
  'part5.self': { widget: 'P5_Line2_Yourself[0]', render: integer },
  'part5.spouse': { widget: 'P5_Line3_Married[0]', render: integer },
  'part5.dependentChildren': {
    widget: 'P5_Line4_DependentChildren[0]',
    render: integer,
  },
  'part5.otherDependentsOnTaxReturn': {
    widget: 'P5_Line5_OtherDependents[0]',
    render: integer,
  },
  'part5.priorI864Obligations': {
    widget: 'P5_Line6_Sponsors[0]',
    render: integer,
  },
  'part5.householdMembersI864A': {
    widget: 'P5_Line7_SameResidence[0]',
    render: integer,
  },
  'part5.householdSizeTotal': { widget: 'Override[0]', render: integer },

  // ─── Employment and income (USCIS Part 6) ───────────────────────────
  'part6.occupation': { widget: 'P6_Line1a_NameofEmployer[0]', render: text },
  'part6.employerOrBusinessName': {
    widget: 'P6_Line1a1_NameofEmployer[0]',
    render: text,
  },
  'part6.currentIndividualAnnualIncome': {
    widget: 'P6_Line2_TotalIncome[0]',
    render: money,
  },
  'part6.currentAnnualHouseholdIncome': {
    widget: 'P6_Line15_TotalHouseholdIncome[0]',
    render: money,
  },

  'part6.taxReturnIncome.mostRecentYear.taxYear': {
    widget: 'P6_Line19a_TaxYear[0]',
    render: integer,
  },
  'part6.taxReturnIncome.mostRecentYear.totalIncome': {
    widget: 'P6_Line19a_TotalIncome[0]',
    render: money,
  },
  'part6.taxReturnIncome.twoYearsAgo.taxYear': {
    widget: 'P6_Line19b_TaxYear[0]',
    render: integer,
  },
  'part6.taxReturnIncome.twoYearsAgo.totalIncome': {
    widget: 'P6_Line19b_TotalIncome[0]',
    render: money,
  },
  'part6.taxReturnIncome.threeYearsAgo.taxYear': {
    widget: 'P6_Line19c_TaxYear[0]',
    render: integer,
  },
  'part6.taxReturnIncome.threeYearsAgo.totalIncome': {
    widget: 'P6_Line19c_TotalIncome[0]',
    render: money,
  },

  // ─── Contact + signature (USCIS Part 8) ─────────────────────────────
  'part8.sponsorDaytimePhone': {
    widget: 'P8_Line3_DaytimeTelephoneNumber[0]',
    render: text,
  },
  'part8.sponsorMobilePhone': {
    widget: 'P8_Line4_MobileTelephoneNumber[0]',
    render: text,
  },
  'part8.sponsorEmail': { widget: 'P7Line7_EmailAddress[0]', render: text },
  'part8.signatureDate': { widget: 'P7Line9b_DateofSignature[0]', render: mdyDate },
}

/**
 * Checkboxes and radio groups that need special handling — one schema value
 * maps to multiple widgets, and only one gets checked.
 *
 * For citizenship, employment: enum → exactly one checkbox selected.
 */
const CITIZENSHIP_WIDGETS = {
  'us-citizen': 'P4_Line11a_Checkbox[0]',
  'us-national': 'P4_Line11b_Checkbox[0]',
  lpr: 'P4_Line11c_Checkbox[0]',
} as const

const EMPLOYMENT_WIDGETS = {
  employed: 'P6_Line1_Checkbox[0]',
  selfEmployed: 'P6_Line4_Checkbox[0]',
  retired: 'P6_Line5_Checkbox[0]',
  unemployed: 'P6_Line6_Checkbox[0]',
} as const

export function resolveSchemaPath(
  path: string,
  value: unknown
): Array<{ widget: string; value: WidgetValue }> {
  // Special cases first
  if (path === 'part4.citizenshipStatus' && typeof value === 'string') {
    const widget = CITIZENSHIP_WIDGETS[value as keyof typeof CITIZENSHIP_WIDGETS]
    if (!widget) return []
    return [{ widget, value: { kind: 'checkbox', checked: true } }]
  }

  if (path.startsWith('part6.employment.')) {
    const key = path.slice('part6.employment.'.length)
    const widget = EMPLOYMENT_WIDGETS[key as keyof typeof EMPLOYMENT_WIDGETS]
    if (widget && value === true) {
      return [{ widget, value: { kind: 'checkbox', checked: true } }]
    }
    return []
  }

  const mapping = SIMPLE[path]
  if (!mapping) return []
  const rendered = mapping.render(value)
  if (!rendered) return []
  return [{ widget: mapping.widget, value: rendered }]
}
