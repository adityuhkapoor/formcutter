/**
 * Form registry. Each supported USCIS form has:
 * - An id (matches public/forms/<id>.pdf filename)
 * - A display name
 * - Widget-map (schema path → qualified widget name)
 * - A set of renderer functions per schema-value shape (text/date/money/etc.)
 *
 * I-864 has a hand-authored widget map (hand-tuned for SSN digits, date formats,
 * checkbox groupings, etc). I-130 / I-485 / N-400 use auto-generated maps
 * produced by scripts/generate-widget-map.mjs — less nuanced but working
 * baseline coverage.
 */

import { AUTO_I_130_MAP } from './i-130-widget-map.generated'
import { AUTO_I_485_MAP } from './i-485-widget-map.generated'
import { AUTO_N_400_MAP } from './n-400-widget-map.generated'
import { AUTO_I_589_MAP } from './i-589-widget-map.generated'
import { AUTO_I_765_MAP } from './i-765-widget-map.generated'
import { AUTO_I_821_MAP } from './i-821-widget-map.generated'
import { AUTO_I_102_MAP } from './i-102-widget-map.generated'

export type FormId =
  | 'i-864'
  | 'i-130'
  | 'i-485'
  | 'n-400'
  | 'i-589'
  | 'i-765'
  | 'i-821'
  | 'i-102'

export type FormMeta = {
  id: FormId
  name: string
  shortDescription: string
  pdfPath: string
  /** Number of mapped schema fields. UI uses this for progress indicator. */
  mappedFieldCount: number
}

export const FORM_REGISTRY: Record<FormId, FormMeta> = {
  'i-864': {
    id: 'i-864',
    name: 'I-864 Affidavit of Support',
    shortDescription: "Sponsor's financial affidavit, filed alongside most family-based green card applications.",
    pdfPath: 'public/forms/i-864.pdf',
    mappedFieldCount: 30,
  },
  'i-130': {
    id: 'i-130',
    name: 'I-130 Petition for Alien Relative',
    shortDescription: "Petition to establish a family relationship with the intending immigrant.",
    pdfPath: 'public/forms/i-130.pdf',
    mappedFieldCount: Object.keys(AUTO_I_130_MAP).length,
  },
  'i-485': {
    id: 'i-485',
    name: 'I-485 Adjustment of Status',
    shortDescription: 'Application to become a green-card holder while already in the U.S.',
    pdfPath: 'public/forms/i-485.pdf',
    mappedFieldCount: Object.keys(AUTO_I_485_MAP).length,
  },
  'n-400': {
    id: 'n-400',
    name: 'N-400 Application for Naturalization',
    shortDescription: 'Application to become a U.S. citizen (for LPRs who meet residency requirements).',
    pdfPath: 'public/forms/n-400.pdf',
    mappedFieldCount: Object.keys(AUTO_N_400_MAP).length,
  },
  'i-589': {
    id: 'i-589',
    name: 'I-589 Application for Asylum',
    shortDescription: 'Asylum and withholding of removal. Must be filed within 1 year of entry for most cases.',
    pdfPath: 'public/forms/i-589.pdf',
    mappedFieldCount: Object.keys(AUTO_I_589_MAP).length,
  },
  'i-765': {
    id: 'i-765',
    name: 'I-765 Application for Employment Authorization',
    shortDescription: 'Work permit (EAD). Often filed alongside other applications like asylum or adjustment of status.',
    pdfPath: 'public/forms/i-765.pdf',
    mappedFieldCount: Object.keys(AUTO_I_765_MAP).length,
  },
  'i-821': {
    id: 'i-821',
    name: 'I-821 Application for Temporary Protected Status',
    shortDescription: 'Lawful status for nationals of TPS-designated countries during emergencies.',
    pdfPath: 'public/forms/i-821.pdf',
    mappedFieldCount: Object.keys(AUTO_I_821_MAP).length,
  },
  'i-102': {
    id: 'i-102',
    name: 'I-102 Replacement I-94 Arrival Record',
    shortDescription: 'Request a new or replacement Form I-94 arrival/departure record when the original was lost, stolen, or never issued.',
    pdfPath: 'public/forms/i-102.pdf',
    mappedFieldCount: Object.keys(AUTO_I_102_MAP).length,
  },
}

/** Get the auto-generated widget map for forms that use it. */
export function getAutoMap(formId: FormId): Record<string, string> {
  switch (formId) {
    case 'i-130': return AUTO_I_130_MAP
    case 'i-485': return AUTO_I_485_MAP
    case 'n-400': return AUTO_N_400_MAP
    case 'i-589': return AUTO_I_589_MAP
    case 'i-765': return AUTO_I_765_MAP
    case 'i-821': return AUTO_I_821_MAP
    case 'i-102': return AUTO_I_102_MAP
    case 'i-864': return {} // uses hand-written map via resolveSchemaPath
  }
}
