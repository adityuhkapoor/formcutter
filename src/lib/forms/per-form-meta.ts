/**
 * Per-form metadata for forms other than I-864.
 *
 * I-864 has its own deep `FIELD_META` table at src/lib/i864-schema.ts. The
 * other 7 supported forms (I-130, I-485, N-400, I-589, I-765, I-821, I-102)
 * use the lighter shape here:
 *
 * - greeting: opening assistant message that names the form
 * - fieldMeta: a slim FieldMeta table keyed by dotted schema path. The chat
 *   endpoint uses this to build the MISSING list, prioritize required fields,
 *   and emit "USCIS needs this because..." copy. Paths line up with the
 *   schema in scripts/generate-widget-map.mjs so the auto-mapped widgets fill
 *   when the user submits.
 * - docFieldPaths: the human-readable list the extract endpoint cites in its
 *   system prompt so the vision model knows which paths to populate.
 * - evidence: the EvidenceRequirement[] for the right-rail checklist.
 *
 * Form coverage is staged:
 *   I-130 / I-485 / N-400 / I-589 — full tables (top demo paths)
 *   I-765 / I-821 / I-102           — slim tables (greeting + evidence + a
 *                                     handful of priority fields). The chat
 *                                     still works; it just has fewer
 *                                     "USCIS needs this because..." rationales.
 *
 * I-864 is intentionally NOT in this map. It has the canonical schema. Code
 * paths must call `getFieldMeta(formId)` and special-case 'i-864' upstream
 * (or read FIELD_META directly from i864-schema).
 */

import type { FormId } from './index'
import type { FieldMeta } from '../i864-schema'
import {
  type EvidenceRequirement,
  I864_EVIDENCE,
} from '../evidence'

// ─── Greetings ────────────────────────────────────────────────────────────

const GREETINGS: Record<FormId, string> = {
  'i-864':
    "Hey — I'll help you fill out your I-864 Affidavit of Support. Upload a photo of your license, green card, passport, or tax transcript. I'll extract what I can and then walk through anything missing.",
  'i-130':
    "Hey — I'll help you fill out your I-130 Petition for Alien Relative. As the U.S. citizen or LPR petitioner, you'll provide your info plus the relative you're petitioning for. Upload a photo of your passport or green card and your relative's birth certificate or passport, then I'll fill in what I can.",
  'i-485':
    "Hey — I'll help you fill out your I-485 Application to Adjust Status. Upload your passport, I-94, and any approval notice you have for an underlying petition (like an I-130). I'll extract what I can and then ask about anything missing.",
  'n-400':
    "Hey — I'll help you fill out your N-400 Application for Naturalization. Upload your green card (both sides), your passport, and a recent utility bill or lease for your address history. I'll extract what I can and then ask about anything missing.",
  'i-589':
    "Hey — I'll help you fill out your I-589 Application for Asylum. Upload your passport, I-94, and any documents about your situation. I'll extract identity info and then ask about your asylum claim. Note: you must file within 1 year of your last U.S. entry for most cases.",
  'i-765':
    "Hey — I'll help you fill out your I-765 Application for Employment Authorization. Upload your passport, I-94, and any approval notice or EAD card you already have. I'll extract what I can and then ask the rest.",
  'i-821':
    "Hey — I'll help you fill out your I-821 Application for Temporary Protected Status. Upload your passport, I-94, and any prior TPS approval notice if you've registered before. I'll extract what I can and then ask about anything missing.",
  'i-102':
    "Hey — I'll help you fill out your I-102 to replace a lost or missing I-94 arrival record. Upload your passport and any expired or damaged I-94 you still have. I'll extract what I can and then ask the rest.",
}

export function getGreeting(formId: FormId): string {
  return GREETINGS[formId]
}

// ─── Field meta per non-I-864 form ────────────────────────────────────────
// Schema paths mirror scripts/generate-widget-map.mjs so values flow through
// to the auto-generated widget map at fill time.

const I130_META: Record<string, FieldMeta> = {
  // Petitioner (the sponsor filing)
  'petitioner.name.familyName': {
    label: 'Petitioner family name (last name)',
    tier: 'required',
    why: 'USCIS needs the petitioner\'s legal name as it appears on their citizenship or LPR document.',
    docSource: ['license', 'passport'],
  },
  'petitioner.name.givenName': {
    label: 'Petitioner given name (first name)',
    tier: 'required',
    why: 'Part of the petitioner\'s legal name on record with USCIS.',
    docSource: ['license', 'passport'],
  },
  'petitioner.dateOfBirth': {
    label: 'Petitioner date of birth',
    tier: 'required',
    why: 'USCIS verifies the petitioner\'s identity against their citizenship or green card.',
    docSource: ['license', 'passport'],
  },
  'petitioner.ssn': {
    label: 'Petitioner Social Security Number',
    tier: 'required',
    why: 'USCIS uses the SSN to match the petitioner to immigration records.',
    docSource: ['user-input'],
    sensitivity: 'high',
  },
  'petitioner.aNumber': {
    label: 'Petitioner A-Number (LPRs only)',
    tier: 'conditional',
    why: 'Lawful permanent residents have an A-Number on their green card. Citizens leave this blank.',
    docSource: ['green-card'],
    conditionOn: 'petitioner.citizenshipStatus',
  },
  'petitioner.citizenshipStatus': {
    label: 'Petitioner citizenship status',
    tier: 'required',
    why: 'Only U.S. citizens or LPRs can file an I-130.',
    docSource: ['passport', 'green-card', 'user-input'],
    askIfMissing: 'Are you filing as a U.S. citizen or as a green card holder (LPR)?',
  },
  'petitioner.maritalStatus': {
    label: 'Petitioner marital status',
    tier: 'required',
    why: 'Marital status affects eligibility for spousal petitions and downstream forms like I-864.',
    docSource: ['user-input'],
    askIfMissing: 'What is your current marital status?',
  },
  'petitioner.mailingAddress.streetNumberAndName': {
    label: 'Petitioner mailing street address',
    tier: 'required',
    why: 'USCIS sends notices and decisions to this address.',
    docSource: ['license', 'user-input'],
  },
  'petitioner.mailingAddress.cityOrTown': {
    label: 'Petitioner mailing city',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['license', 'user-input'],
  },
  'petitioner.mailingAddress.state': {
    label: 'Petitioner mailing state',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['license', 'user-input'],
  },
  'petitioner.mailingAddress.zipCode': {
    label: 'Petitioner ZIP code',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['license', 'user-input'],
  },
  'petitioner.daytimePhone': {
    label: 'Petitioner daytime phone',
    tier: 'required',
    why: 'USCIS may call to schedule biometrics or interviews.',
    docSource: ['user-input'],
  },
  'petitioner.emailAddress': {
    label: 'Petitioner email',
    tier: 'optional',
    why: 'USCIS sends online-account-linked notices here when provided.',
    docSource: ['user-input'],
  },

  // Beneficiary (the immigrant being petitioned for)
  'beneficiary.name.familyName': {
    label: 'Beneficiary family name',
    tier: 'required',
    why: 'The immigrant\'s legal name as it appears on their passport.',
    docSource: ['passport'],
  },
  'beneficiary.name.givenName': {
    label: 'Beneficiary given name',
    tier: 'required',
    why: 'Part of the immigrant\'s legal name on their passport.',
    docSource: ['passport'],
  },
  'beneficiary.dateOfBirth': {
    label: 'Beneficiary date of birth',
    tier: 'required',
    why: 'USCIS verifies identity and age (relevant for child petitions).',
    docSource: ['passport'],
  },
  'beneficiary.countryOfBirth': {
    label: 'Beneficiary country of birth',
    tier: 'required',
    why: 'Country of birth (not citizenship) determines visa-availability charts for siblings/parents.',
    docSource: ['passport'],
  },
  'beneficiary.countryOfCitizenship': {
    label: 'Beneficiary country of citizenship',
    tier: 'required',
    why: 'Required for the consular process if the beneficiary is abroad.',
    docSource: ['passport', 'user-input'],
  },
  'relationship.type': {
    label: 'Relationship to beneficiary',
    tier: 'required',
    why: 'Spouse, parent, child, or sibling — eligibility and processing time depend on this.',
    docSource: ['user-input'],
    askIfMissing: 'How are you related to the person you\'re petitioning for? Spouse, parent, child, or sibling?',
  },
  'signature.date': {
    label: 'Signature date',
    tier: 'required',
    why: 'Forms must be signed and dated within ~60 days of filing.',
    docSource: ['user-input'],
  },
}

const I485_META: Record<string, FieldMeta> = {
  'applicant.name.familyName': {
    label: 'Applicant family name',
    tier: 'required',
    why: 'Your legal name as on your passport.',
    docSource: ['passport'],
  },
  'applicant.name.givenName': {
    label: 'Applicant given name',
    tier: 'required',
    why: 'Your legal name as on your passport.',
    docSource: ['passport'],
  },
  'applicant.dateOfBirth': {
    label: 'Date of birth',
    tier: 'required',
    why: 'USCIS matches against your passport and prior immigration records.',
    docSource: ['passport'],
  },
  'applicant.ssn': {
    label: 'Social Security Number',
    tier: 'conditional',
    why: 'If you have an SSN, USCIS matches against tax and employment records. Leave blank if you don\'t have one.',
    docSource: ['user-input'],
    sensitivity: 'high',
  },
  'applicant.aNumber': {
    label: 'A-Number',
    tier: 'required',
    why: 'Your A-Number appears on prior USCIS notices, EAD cards, or green cards. It\'s the primary key USCIS uses to find your file.',
    docSource: ['green-card', 'user-input'],
  },
  'applicant.countryOfBirth': {
    label: 'Country of birth',
    tier: 'required',
    why: 'Used for visa availability and processing.',
    docSource: ['passport'],
  },
  'applicant.countryOfCitizenship': {
    label: 'Country of citizenship',
    tier: 'required',
    why: 'Your current citizenship as it appears on your passport.',
    docSource: ['passport'],
  },
  'applicant.dateOfArrival': {
    label: 'Most recent date of U.S. arrival',
    tier: 'required',
    why: 'USCIS matches this to your I-94. Wrong dates here are a top RFE cause.',
    docSource: ['user-input'],
  },
  'applicant.i94Number': {
    label: 'I-94 admission number',
    tier: 'required',
    why: 'The I-94 record (retrieved from i94.cbp.dhs.gov) proves you were lawfully admitted.',
    docSource: ['user-input'],
  },
  'applicant.passportNumber': {
    label: 'Passport number',
    tier: 'required',
    why: 'Your passport ID, used to verify your most recent entry.',
    docSource: ['passport'],
  },
  'applicant.passportCountry': {
    label: 'Passport country of issuance',
    tier: 'required',
    why: 'Country that issued your passport.',
    docSource: ['passport'],
  },
  'applicant.maritalStatus': {
    label: 'Marital status',
    tier: 'required',
    why: 'Affects eligibility category and any concurrent I-130 petition.',
    docSource: ['user-input'],
    askIfMissing: 'What is your current marital status?',
  },
  'applicant.eligibilityCategory': {
    label: 'Adjustment eligibility category',
    tier: 'required',
    why: 'Family-based, employment-based, asylum-based, etc. — determines how USCIS reviews the case.',
    docSource: ['user-input'],
    askIfMissing: 'Which category are you adjusting under? (e.g. spouse of U.S. citizen, employment-based, asylum 1-year, etc.)',
  },
  'applicant.mailingAddress.streetNumberAndName': {
    label: 'Mailing street address',
    tier: 'required',
    why: 'USCIS sends decisions and biometrics notices here.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.cityOrTown': {
    label: 'Mailing city',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.state': {
    label: 'Mailing state',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.zipCode': {
    label: 'Mailing ZIP code',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['user-input'],
  },
  'applicant.daytimePhone': {
    label: 'Daytime phone',
    tier: 'required',
    why: 'USCIS may call to schedule your biometrics or interview.',
    docSource: ['user-input'],
  },
  'applicant.emailAddress': {
    label: 'Email',
    tier: 'optional',
    why: 'For USCIS online-account-linked notices.',
    docSource: ['user-input'],
  },
  'signature.date': {
    label: 'Signature date',
    tier: 'required',
    why: 'Forms must be signed within ~60 days of filing.',
    docSource: ['user-input'],
  },
}

const N400_META: Record<string, FieldMeta> = {
  'applicant.name.familyName': {
    label: 'Applicant family name',
    tier: 'required',
    why: 'Your legal name as it appears on your green card.',
    docSource: ['green-card', 'passport'],
  },
  'applicant.name.givenName': {
    label: 'Applicant given name',
    tier: 'required',
    why: 'Your legal name as it appears on your green card.',
    docSource: ['green-card', 'passport'],
  },
  'applicant.dateOfBirth': {
    label: 'Date of birth',
    tier: 'required',
    why: 'USCIS verifies against your green card and passport.',
    docSource: ['green-card', 'passport'],
  },
  'applicant.aNumber': {
    label: 'A-Number',
    tier: 'required',
    why: 'Printed on your green card. Primary identifier for your USCIS file.',
    docSource: ['green-card'],
  },
  'applicant.ssn': {
    label: 'Social Security Number',
    tier: 'required',
    why: 'USCIS verifies tax compliance — a common bar to naturalization.',
    docSource: ['user-input'],
    sensitivity: 'high',
  },
  'applicant.countryOfBirth': {
    label: 'Country of birth',
    tier: 'required',
    why: 'Required for the eligibility analysis (some treaties affect oath wording).',
    docSource: ['passport', 'green-card'],
  },
  'applicant.dateBecameLPR': {
    label: 'Date became a permanent resident',
    tier: 'required',
    why: 'You must have been an LPR for 5 years (3 if married to a U.S. citizen). USCIS counts from this date.',
    docSource: ['green-card'],
    askIfMissing: 'When did you become a permanent resident? (printed on your green card)',
  },
  'applicant.maritalStatus': {
    label: 'Marital status',
    tier: 'required',
    why: 'Determines the 3-year vs 5-year residency rule.',
    docSource: ['user-input'],
    askIfMissing: 'What is your current marital status?',
  },
  'applicant.mailingAddress.streetNumberAndName': {
    label: 'Mailing street address',
    tier: 'required',
    why: 'USCIS sends interview notices and the oath ceremony notice here.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.cityOrTown': {
    label: 'Mailing city',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.state': {
    label: 'Mailing state',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.zipCode': {
    label: 'Mailing ZIP code',
    tier: 'required',
    why: 'Part of the USCIS mailing address.',
    docSource: ['user-input'],
  },
  'applicant.daytimePhone': {
    label: 'Daytime phone',
    tier: 'required',
    why: 'USCIS calls to schedule biometrics or your interview.',
    docSource: ['user-input'],
  },
  'applicant.emailAddress': {
    label: 'Email',
    tier: 'optional',
    why: 'For USCIS online-account-linked notices.',
    docSource: ['user-input'],
  },
  'applicant.employerName': {
    label: 'Current employer name',
    tier: 'optional',
    why: 'Listed on the form; USCIS asks about employment for the last 5 years.',
    docSource: ['user-input', 'paystub'],
  },
  'applicant.heightFeet': {
    label: 'Height (feet)',
    tier: 'required',
    why: 'USCIS prints biographical details on the certificate of naturalization.',
    docSource: ['user-input'],
  },
  'applicant.heightInches': {
    label: 'Height (inches)',
    tier: 'required',
    why: 'Part of the certificate biographical info.',
    docSource: ['user-input'],
  },
  'applicant.weightPounds': {
    label: 'Weight (lbs)',
    tier: 'required',
    why: 'Part of the certificate biographical info.',
    docSource: ['user-input'],
  },
  'applicant.eyeColor': {
    label: 'Eye color',
    tier: 'required',
    why: 'Part of the certificate biographical info.',
    docSource: ['user-input'],
  },
  'applicant.hairColor': {
    label: 'Hair color',
    tier: 'required',
    why: 'Part of the certificate biographical info.',
    docSource: ['user-input'],
  },
  'signature.date': {
    label: 'Signature date',
    tier: 'required',
    why: 'Forms must be signed within ~60 days of filing.',
    docSource: ['user-input'],
  },
}

const I589_META: Record<string, FieldMeta> = {
  'applicant.name.familyName': {
    label: 'Applicant family name',
    tier: 'required',
    why: 'Your legal name as on your passport (or other identity document).',
    docSource: ['passport'],
  },
  'applicant.name.givenName': {
    label: 'Applicant given name',
    tier: 'required',
    why: 'Your legal name.',
    docSource: ['passport'],
  },
  'applicant.dateOfBirth': {
    label: 'Date of birth',
    tier: 'required',
    why: 'USCIS verifies identity and notes whether you\'re a minor (different procedures apply).',
    docSource: ['passport'],
  },
  'applicant.aNumber': {
    label: 'A-Number',
    tier: 'conditional',
    why: 'If you\'ve had any prior USCIS contact you have an A-Number. Leave blank if you don\'t.',
    docSource: ['user-input'],
  },
  'applicant.countryOfBirth': {
    label: 'Country of birth',
    tier: 'required',
    why: 'Required for the asylum analysis.',
    docSource: ['passport'],
  },
  'applicant.nationality': {
    label: 'Nationality',
    tier: 'required',
    why: 'Country whose protection you fear losing.',
    docSource: ['passport', 'user-input'],
  },
  'applicant.lastEntryDate': {
    label: 'Date of last entry to the U.S.',
    tier: 'required',
    why: 'You must file within 1 year of this date for most asylum claims. USCIS counts strictly.',
    docSource: ['user-input'],
    askIfMissing: 'When did you last enter the United States?',
  },
  'applicant.passportNumber': {
    label: 'Passport number',
    tier: 'conditional',
    why: 'If you have a current passport, USCIS records the number. Leave blank if you don\'t.',
    docSource: ['passport'],
  },
  'applicant.maritalStatus': {
    label: 'Marital status',
    tier: 'required',
    why: 'You can include a spouse and unmarried children under 21 as derivatives.',
    docSource: ['user-input'],
    askIfMissing: 'What is your current marital status?',
  },
  'applicant.mailingAddress.streetNumberAndName': {
    label: 'Mailing street address',
    tier: 'required',
    why: 'USCIS or the immigration court sends notices here. If you don\'t have a stable address, an attorney or community organization can be your address of record.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.cityOrTown': {
    label: 'Mailing city',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.state': {
    label: 'Mailing state',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.zipCode': {
    label: 'Mailing ZIP code',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'applicant.daytimePhone': {
    label: 'Daytime phone',
    tier: 'optional',
    why: 'USCIS may call to schedule your interview.',
    docSource: ['user-input'],
  },
  'applicant.emailAddress': {
    label: 'Email',
    tier: 'optional',
    why: 'For online-account-linked notices.',
    docSource: ['user-input'],
  },
  'signature.date': {
    label: 'Signature date',
    tier: 'required',
    why: 'Forms must be signed within ~60 days of filing.',
    docSource: ['user-input'],
  },
}

const I765_META: Record<string, FieldMeta> = {
  'applicant.name.familyName': {
    label: 'Applicant family name',
    tier: 'required',
    why: 'Your legal name.',
    docSource: ['passport'],
  },
  'applicant.name.givenName': {
    label: 'Applicant given name',
    tier: 'required',
    why: 'Your legal name.',
    docSource: ['passport'],
  },
  'applicant.dateOfBirth': {
    label: 'Date of birth',
    tier: 'required',
    why: 'Identity verification.',
    docSource: ['passport'],
  },
  'applicant.aNumber': {
    label: 'A-Number',
    tier: 'required',
    why: 'Required to link this EAD application to your existing USCIS file.',
    docSource: ['user-input'],
  },
  'applicant.eligibilityCategory': {
    label: 'EAD eligibility category',
    tier: 'required',
    why: 'Categories like (c)(8) for asylum or (c)(9) for adjustment determine processing time and required evidence.',
    docSource: ['user-input'],
    askIfMissing: 'What category are you applying under? (e.g. (c)(8) asylum applicant, (c)(9) adjustment, etc.)',
  },
  'applicant.countryOfBirth': {
    label: 'Country of birth',
    tier: 'required',
    why: 'Standard biographical info on USCIS forms.',
    docSource: ['passport'],
  },
  'applicant.dateOfLastEntry': {
    label: 'Date of last entry',
    tier: 'required',
    why: 'Must match your I-94.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.streetNumberAndName': {
    label: 'Mailing street address',
    tier: 'required',
    why: 'USCIS sends your EAD card here.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.cityOrTown': {
    label: 'Mailing city',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.state': {
    label: 'Mailing state',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.zipCode': {
    label: 'Mailing ZIP code',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'signature.date': {
    label: 'Signature date',
    tier: 'required',
    why: 'Forms must be signed within ~60 days of filing.',
    docSource: ['user-input'],
  },
}

const I821_META: Record<string, FieldMeta> = {
  'applicant.name.familyName': {
    label: 'Applicant family name',
    tier: 'required',
    why: 'Your legal name as on your passport.',
    docSource: ['passport'],
  },
  'applicant.name.givenName': {
    label: 'Applicant given name',
    tier: 'required',
    why: 'Your legal name as on your passport.',
    docSource: ['passport'],
  },
  'applicant.dateOfBirth': {
    label: 'Date of birth',
    tier: 'required',
    why: 'Identity verification.',
    docSource: ['passport'],
  },
  'applicant.countryOfCitizenship': {
    label: 'Country of citizenship',
    tier: 'required',
    why: 'TPS is granted by country — must match a current designation.',
    docSource: ['passport'],
  },
  'applicant.dateOfLastEntry': {
    label: 'Date of last entry',
    tier: 'required',
    why: 'You must have continuously resided in the U.S. since the country\'s designation date.',
    docSource: ['user-input'],
    askIfMissing: 'When did you last enter the United States?',
  },
  'applicant.passportNumber': {
    label: 'Passport number',
    tier: 'required',
    why: 'USCIS records your travel-document identifier.',
    docSource: ['passport'],
  },
  'applicant.aNumber': {
    label: 'A-Number',
    tier: 'conditional',
    why: 'If you\'ve had prior USCIS contact you have one. Leave blank if you don\'t.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.streetNumberAndName': {
    label: 'Mailing street address',
    tier: 'required',
    why: 'USCIS sends your TPS approval/EAD here.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.cityOrTown': {
    label: 'Mailing city',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.state': {
    label: 'Mailing state',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.zipCode': {
    label: 'Mailing ZIP code',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'signature.date': {
    label: 'Signature date',
    tier: 'required',
    why: 'Forms must be signed within ~60 days of filing.',
    docSource: ['user-input'],
  },
}

const I102_META: Record<string, FieldMeta> = {
  'applicant.name.familyName': {
    label: 'Applicant family name',
    tier: 'required',
    why: 'Your legal name as on your passport.',
    docSource: ['passport'],
  },
  'applicant.name.givenName': {
    label: 'Applicant given name',
    tier: 'required',
    why: 'Your legal name as on your passport.',
    docSource: ['passport'],
  },
  'applicant.dateOfBirth': {
    label: 'Date of birth',
    tier: 'required',
    why: 'Identity verification.',
    docSource: ['passport'],
  },
  'applicant.countryOfBirth': {
    label: 'Country of birth',
    tier: 'required',
    why: 'Standard biographical info.',
    docSource: ['passport'],
  },
  'applicant.passportNumber': {
    label: 'Passport number',
    tier: 'required',
    why: 'USCIS records your travel-document number to look up your I-94.',
    docSource: ['passport'],
  },
  'applicant.passportCountry': {
    label: 'Passport country',
    tier: 'required',
    why: 'Country that issued your passport.',
    docSource: ['passport'],
  },
  'applicant.dateOfLastEntry': {
    label: 'Date of last entry',
    tier: 'required',
    why: 'USCIS uses this to find the I-94 record they need to replace.',
    docSource: ['user-input'],
  },
  'applicant.placeOfLastEntry': {
    label: 'Place of last entry',
    tier: 'required',
    why: 'The port of entry where you were last admitted.',
    docSource: ['user-input'],
  },
  'applicant.classOfAdmission': {
    label: 'Class of admission',
    tier: 'required',
    why: 'The visa category under which you were admitted (e.g. F-1, B-2). Printed on your visa.',
    docSource: ['user-input'],
  },
  'applicant.reasonForApplication': {
    label: 'Reason for filing',
    tier: 'required',
    why: 'Whether your I-94 is lost, stolen, never issued, or just needs replacement.',
    docSource: ['user-input'],
    askIfMissing: 'Is your I-94 lost, stolen, never issued, or just damaged?',
  },
  'applicant.mailingAddress.streetNumberAndName': {
    label: 'Mailing street address',
    tier: 'required',
    why: 'USCIS sends the replacement I-94 here.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.cityOrTown': {
    label: 'Mailing city',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.state': {
    label: 'Mailing state',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'applicant.mailingAddress.zipCode': {
    label: 'Mailing ZIP code',
    tier: 'required',
    why: 'Part of the mailing address.',
    docSource: ['user-input'],
  },
  'signature.date': {
    label: 'Signature date',
    tier: 'required',
    why: 'Forms must be signed within ~60 days of filing.',
    docSource: ['user-input'],
  },
}

const FIELD_META_BY_FORM: Partial<Record<FormId, Record<string, FieldMeta>>> = {
  'i-130': I130_META,
  'i-485': I485_META,
  'n-400': N400_META,
  'i-589': I589_META,
  'i-765': I765_META,
  'i-821': I821_META,
  'i-102': I102_META,
}

/**
 * Returns the FieldMeta for a non-I-864 form, or null. Callers must read
 * I-864's table directly from i864-schema.ts.
 */
export function getFieldMeta(formId: FormId): Record<string, FieldMeta> | null {
  if (formId === 'i-864') return null
  return FIELD_META_BY_FORM[formId] ?? null
}

// ─── Doc-extraction field paths per form ──────────────────────────────────
// Used by /api/extract to tell the vision model which paths to populate.

const DOC_PATHS: Record<FormId, string[]> = {
  'i-864': [
    'part4.name.familyName',
    'part4.name.givenName',
    'part4.dateOfBirth',
    'part4.ssn',
    'part4.aNumber',
    'part4.mailingAddress.streetNumberAndName',
    'part4.mailingAddress.cityOrTown',
    'part4.mailingAddress.state',
    'part4.mailingAddress.zipCode',
    'part4.citizenshipStatus',
    'part2.name.familyName',
    'part2.name.givenName',
    'part2.dateOfBirth',
    'part2.aNumber',
    'part2.countryOfCitizenship',
    'part6.employerOrBusinessName',
    'part6.currentIndividualAnnualIncome',
    'part6.taxReturnIncome.mostRecentYear.taxYear',
    'part6.taxReturnIncome.mostRecentYear.totalIncome',
  ],
  'i-130': [
    'petitioner.name.familyName',
    'petitioner.name.givenName',
    'petitioner.dateOfBirth',
    'petitioner.aNumber',
    'petitioner.ssn',
    'petitioner.citizenshipStatus',
    'petitioner.mailingAddress.streetNumberAndName',
    'petitioner.mailingAddress.cityOrTown',
    'petitioner.mailingAddress.state',
    'petitioner.mailingAddress.zipCode',
    'beneficiary.name.familyName',
    'beneficiary.name.givenName',
    'beneficiary.dateOfBirth',
    'beneficiary.countryOfBirth',
    'beneficiary.countryOfCitizenship',
  ],
  'i-485': [
    'applicant.name.familyName',
    'applicant.name.givenName',
    'applicant.dateOfBirth',
    'applicant.ssn',
    'applicant.aNumber',
    'applicant.countryOfBirth',
    'applicant.countryOfCitizenship',
    'applicant.passportNumber',
    'applicant.passportCountry',
    'applicant.dateOfArrival',
    'applicant.i94Number',
    'applicant.mailingAddress.streetNumberAndName',
    'applicant.mailingAddress.cityOrTown',
    'applicant.mailingAddress.state',
    'applicant.mailingAddress.zipCode',
  ],
  'n-400': [
    'applicant.name.familyName',
    'applicant.name.givenName',
    'applicant.dateOfBirth',
    'applicant.aNumber',
    'applicant.ssn',
    'applicant.countryOfBirth',
    'applicant.dateBecameLPR',
    'applicant.mailingAddress.streetNumberAndName',
    'applicant.mailingAddress.cityOrTown',
    'applicant.mailingAddress.state',
    'applicant.mailingAddress.zipCode',
  ],
  'i-589': [
    'applicant.name.familyName',
    'applicant.name.givenName',
    'applicant.dateOfBirth',
    'applicant.aNumber',
    'applicant.countryOfBirth',
    'applicant.nationality',
    'applicant.passportNumber',
    'applicant.lastEntryDate',
    'applicant.mailingAddress.streetNumberAndName',
    'applicant.mailingAddress.cityOrTown',
    'applicant.mailingAddress.state',
    'applicant.mailingAddress.zipCode',
  ],
  'i-765': [
    'applicant.name.familyName',
    'applicant.name.givenName',
    'applicant.dateOfBirth',
    'applicant.aNumber',
    'applicant.countryOfBirth',
    'applicant.countryOfCitizenship',
    'applicant.dateOfLastEntry',
    'applicant.mailingAddress.streetNumberAndName',
    'applicant.mailingAddress.cityOrTown',
    'applicant.mailingAddress.state',
    'applicant.mailingAddress.zipCode',
  ],
  'i-821': [
    'applicant.name.familyName',
    'applicant.name.givenName',
    'applicant.dateOfBirth',
    'applicant.countryOfCitizenship',
    'applicant.passportNumber',
    'applicant.dateOfLastEntry',
    'applicant.mailingAddress.streetNumberAndName',
    'applicant.mailingAddress.cityOrTown',
    'applicant.mailingAddress.state',
    'applicant.mailingAddress.zipCode',
  ],
  'i-102': [
    'applicant.name.familyName',
    'applicant.name.givenName',
    'applicant.dateOfBirth',
    'applicant.countryOfBirth',
    'applicant.passportNumber',
    'applicant.passportCountry',
    'applicant.dateOfLastEntry',
    'applicant.placeOfLastEntry',
    'applicant.classOfAdmission',
    'applicant.mailingAddress.streetNumberAndName',
    'applicant.mailingAddress.cityOrTown',
    'applicant.mailingAddress.state',
    'applicant.mailingAddress.zipCode',
  ],
}

export function getDocFieldPaths(formId: FormId): string[] {
  return DOC_PATHS[formId]
}

// ─── Per-form evidence requirements ───────────────────────────────────────

/**
 * Slim evidence packets for the right-rail checklist. I-864 keeps its
 * canonical set from src/lib/evidence.ts. The others are deliberately short
 * (~3-5 items) since the demo only needs to show "this form expects different
 * docs than I-864" — not exhaustive USCIS guidance.
 */
const EVIDENCE_BY_FORM: Record<FormId, EvidenceRequirement[]> = {
  'i-864': I864_EVIDENCE,
  'i-130': [
    {
      id: 'i130-petitioner-citizenship',
      labelI18nKey: 'evidence.i130.petitionerCitizenship',
      labelEn: 'Proof of petitioner U.S. citizenship or LPR status',
      descriptionEn:
        'A U.S. passport, naturalization certificate, birth certificate, or both sides of a green card.',
      tier: 'required',
      satisfiedBy: ['passport', 'birth-certificate', 'naturalization-cert', 'green-card'],
      minCount: 1,
    },
    {
      id: 'i130-relationship-proof',
      labelI18nKey: 'evidence.i130.relationship',
      labelEn: 'Proof of qualifying relationship',
      descriptionEn:
        'Marriage certificate (spouses), birth certificates (parent/child), or sibling-linking birth certificates. The single most-checked item.',
      tier: 'required',
      satisfiedBy: ['birth-certificate', 'other'],
      minCount: 1,
    },
    {
      id: 'i130-beneficiary-id',
      labelI18nKey: 'evidence.i130.beneficiaryId',
      labelEn: "Beneficiary's identity document",
      descriptionEn: "The intending immigrant's passport or birth certificate.",
      tier: 'required',
      satisfiedBy: ['passport', 'birth-certificate'],
      minCount: 1,
    },
    {
      id: 'i130-photos',
      labelI18nKey: 'evidence.i130.photos',
      labelEn: '2 passport-style photos (each)',
      descriptionEn:
        '2x2-inch color photos of petitioner and beneficiary, taken within 30 days of filing.',
      tier: 'recommended',
      satisfiedBy: ['other'],
      minCount: 1,
    },
  ],
  'i-485': [
    {
      id: 'i485-passport',
      labelI18nKey: 'evidence.i485.passport',
      labelEn: 'Valid passport',
      descriptionEn: 'Bio page (and any visa pages relevant to your last entry).',
      tier: 'required',
      satisfiedBy: ['passport'],
      minCount: 1,
    },
    {
      id: 'i485-i94',
      labelI18nKey: 'evidence.i485.i94',
      labelEn: 'I-94 arrival/departure record',
      descriptionEn: 'Print from i94.cbp.dhs.gov. Required to show lawful admission.',
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
    {
      id: 'i485-medical',
      labelI18nKey: 'evidence.i485.medical',
      labelEn: 'Medical exam (Form I-693)',
      descriptionEn:
        'Sealed envelope from a USCIS-designated civil surgeon. Often filed concurrently or brought to the interview.',
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
    {
      id: 'i485-photos',
      labelI18nKey: 'evidence.i485.photos',
      labelEn: '2 passport-style photos',
      descriptionEn: '2x2-inch color photos taken within 30 days of filing.',
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
    {
      id: 'i485-underlying-petition',
      labelI18nKey: 'evidence.i485.underlying',
      labelEn: 'Approval notice for underlying petition',
      descriptionEn:
        'I-130, I-140, asylum grant, etc. — proof of the basis for your adjustment.',
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
  ],
  'n-400': [
    {
      id: 'n400-greencard',
      labelI18nKey: 'evidence.n400.greenCard',
      labelEn: 'Green card (both sides)',
      descriptionEn: 'Photocopy of front and back. Lost or expired = file Form I-90 first.',
      tier: 'required',
      satisfiedBy: ['green-card'],
      minCount: 1,
    },
    {
      id: 'n400-passport',
      labelI18nKey: 'evidence.n400.passport',
      labelEn: 'Passport(s) covering last 5 years',
      descriptionEn:
        'USCIS uses these to verify physical presence and trips abroad. Bring expired ones too.',
      tier: 'required',
      satisfiedBy: ['passport'],
      minCount: 1,
    },
    {
      id: 'n400-marriage-divorce',
      labelI18nKey: 'evidence.n400.marriage',
      labelEn: 'Marriage / divorce certificates',
      descriptionEn:
        'Required if filing under the 3-year rule based on marriage to a U.S. citizen, or if any prior marriages.',
      tier: 'conditional',
      satisfiedBy: ['other'],
      minCount: 1,
      conditionOn: () => true,
    },
    {
      id: 'n400-tax-returns',
      labelI18nKey: 'evidence.n400.taxes',
      labelEn: 'Tax returns or transcripts (last 5 years)',
      descriptionEn:
        'USCIS asks about tax filing history. Bring transcripts if available.',
      tier: 'recommended',
      satisfiedBy: ['tax-return', 'tax-transcript'],
      minCount: 1,
    },
    {
      id: 'n400-photos',
      labelI18nKey: 'evidence.n400.photos',
      labelEn: '2 passport-style photos',
      descriptionEn: '2x2-inch color photos for the certificate of naturalization.',
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
  ],
  'i-589': [
    {
      id: 'i589-id',
      labelI18nKey: 'evidence.i589.id',
      labelEn: 'Identity document',
      descriptionEn:
        'Passport or national ID. If you have neither, an attorney or community organization can help with alternatives.',
      tier: 'required',
      satisfiedBy: ['passport'],
      minCount: 1,
    },
    {
      id: 'i589-i94',
      labelI18nKey: 'evidence.i589.i94',
      labelEn: 'I-94 or other entry record',
      descriptionEn:
        'Proves your last entry date. The 1-year filing deadline runs from this date.',
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
    {
      id: 'i589-personal-statement',
      labelI18nKey: 'evidence.i589.statement',
      labelEn: 'Personal statement of persecution',
      descriptionEn:
        "Your detailed account of past persecution or fear of return. The single most important piece — it's your story.",
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
    {
      id: 'i589-corroborating',
      labelI18nKey: 'evidence.i589.corroborating',
      labelEn: 'Corroborating documents',
      descriptionEn:
        'News articles, country reports, medical records, witness statements, photos. Anything that backs up your statement.',
      tier: 'recommended',
      satisfiedBy: ['other'],
      minCount: 1,
    },
  ],
  'i-765': [
    {
      id: 'i765-passport',
      labelI18nKey: 'evidence.i765.passport',
      labelEn: 'Valid passport',
      descriptionEn: 'Bio page.',
      tier: 'required',
      satisfiedBy: ['passport'],
      minCount: 1,
    },
    {
      id: 'i765-prior-ead',
      labelI18nKey: 'evidence.i765.priorEad',
      labelEn: 'Prior EAD card (if any)',
      descriptionEn: "Both sides if you've been issued one before.",
      tier: 'conditional',
      satisfiedBy: ['other'],
      minCount: 1,
      conditionOn: () => true,
    },
    {
      id: 'i765-category-evidence',
      labelI18nKey: 'evidence.i765.category',
      labelEn: 'Evidence of your eligibility category',
      descriptionEn:
        "Receipt notice for asylum (c)(8), I-485 receipt for (c)(9), etc. — proof of why you're eligible to work.",
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
    {
      id: 'i765-photos',
      labelI18nKey: 'evidence.i765.photos',
      labelEn: '2 passport-style photos',
      descriptionEn: '2x2-inch color photos taken within 30 days.',
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
  ],
  'i-821': [
    {
      id: 'i821-passport',
      labelI18nKey: 'evidence.i821.passport',
      labelEn: 'Valid passport',
      descriptionEn: 'Proves your nationality (TPS is granted by country).',
      tier: 'required',
      satisfiedBy: ['passport'],
      minCount: 1,
    },
    {
      id: 'i821-entry-proof',
      labelI18nKey: 'evidence.i821.entry',
      labelEn: 'Proof of continuous U.S. residence',
      descriptionEn:
        "I-94, leases, utility bills, school records — anything dated to show you've lived here continuously since the country's TPS designation.",
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
    {
      id: 'i821-photos',
      labelI18nKey: 'evidence.i821.photos',
      labelEn: '2 passport-style photos',
      descriptionEn: '2x2-inch color photos taken within 30 days.',
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
  ],
  'i-102': [
    {
      id: 'i102-passport',
      labelI18nKey: 'evidence.i102.passport',
      labelEn: 'Valid passport',
      descriptionEn: 'Bio page and the visa stamp under which you entered.',
      tier: 'required',
      satisfiedBy: ['passport'],
      minCount: 1,
    },
    {
      id: 'i102-prior-i94',
      labelI18nKey: 'evidence.i102.priorI94',
      labelEn: 'Damaged or partial I-94 (if any)',
      descriptionEn:
        "If your I-94 is damaged but you still have it, include it. If it's truly lost, no document is needed for this requirement.",
      tier: 'conditional',
      satisfiedBy: ['other'],
      minCount: 1,
      conditionOn: () => true,
    },
    {
      id: 'i102-entry-proof',
      labelI18nKey: 'evidence.i102.entry',
      labelEn: 'Evidence of last U.S. entry',
      descriptionEn:
        'Boarding pass, plane ticket, or visa stamp dated to your most recent entry.',
      tier: 'required',
      satisfiedBy: ['other'],
      minCount: 1,
    },
  ],
}

export function getEvidence(formId: FormId): EvidenceRequirement[] {
  return EVIDENCE_BY_FORM[formId]
}
