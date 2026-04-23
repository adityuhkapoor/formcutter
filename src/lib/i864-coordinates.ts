/**
 * Hand-mapped (page, x, y) coordinates for overlaying text on the blank I-864 PDF.
 *
 * Coordinate system: pdf-lib's origin is BOTTOM-LEFT. Letter page = 612 x 792 points.
 * Pages are 0-indexed in code; the comments call out the I-864 page number (1-indexed).
 *
 * These are first-pass estimates measured off the 2025-05-12 edition. They may need
 * visual adjustment — the filler script outputs the PDF, open in Preview, squint, iterate.
 *
 * Only high-impact fields are mapped for MVP. Missing fields can stay blank — USCIS
 * accepts partial forms (the rep review pass catches what we miss).
 */

import { getPath } from './field-paths'

export type FieldMapping = {
  /** 0-indexed page */
  page: number
  x: number
  y: number
  fontSize?: number
  /** Fixed text mode: check a box, or set multi-char alignment */
  mode?: 'text' | 'checkbox'
  /** For checkbox: value on the field state that triggers the check */
  checkboxValue?: unknown
  /** Function taking state and returning the rendered string */
  render: (state: Record<string, unknown>) => string | undefined
}

/** Formats a number like 95000 into "$95,000". Blank on missing values. */
function money(v: unknown): string | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

/** Formats ISO date into MM/DD/YYYY (I-864 form convention). */
function mdyDate(v: unknown): string | undefined {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined
  const [y, m, d] = v.split('-')
  return `${m}/${d}/${y}`
}

function stringOrBlank(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.trim() === '') return undefined
  return v
}

function numberOrBlank(v: unknown): string | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  return String(v)
}

export const I864_MAPPINGS: FieldMapping[] = [
  // ─── Page 3 — Part 4, Sponsor's Basic Information (approx) ─────────────
  {
    page: 2,
    x: 72,
    y: 700,
    render: (s) => stringOrBlank(getPath(s, 'part4.name.familyName')),
  },
  {
    page: 2,
    x: 300,
    y: 700,
    render: (s) => stringOrBlank(getPath(s, 'part4.name.givenName')),
  },
  {
    page: 2,
    x: 460,
    y: 700,
    render: (s) => stringOrBlank(getPath(s, 'part4.name.middleName')),
  },
  // Sponsor mailing street
  {
    page: 2,
    x: 72,
    y: 650,
    render: (s) => stringOrBlank(getPath(s, 'part4.mailingAddress.streetNumberAndName')),
  },
  // City
  {
    page: 2,
    x: 72,
    y: 620,
    render: (s) => stringOrBlank(getPath(s, 'part4.mailingAddress.cityOrTown')),
  },
  // State
  {
    page: 2,
    x: 300,
    y: 620,
    render: (s) => stringOrBlank(getPath(s, 'part4.mailingAddress.state')),
  },
  // ZIP
  {
    page: 2,
    x: 380,
    y: 620,
    render: (s) => stringOrBlank(getPath(s, 'part4.mailingAddress.zipCode')),
  },
  // Sponsor DOB
  {
    page: 2,
    x: 72,
    y: 500,
    render: (s) => mdyDate(getPath(s, 'part4.dateOfBirth')),
  },
  // Sponsor SSN
  {
    page: 2,
    x: 300,
    y: 500,
    render: (s) => stringOrBlank(getPath(s, 'part4.ssn')),
  },

  // ─── Page 5 — Part 5, Household Size ───────────────────────────────────
  {
    page: 4,
    x: 500,
    y: 600,
    render: (s) => numberOrBlank(getPath(s, 'part5.householdSizeTotal')),
  },

  // ─── Page 6 — Part 6, Employment and Income ────────────────────────────
  {
    page: 5,
    x: 72,
    y: 650,
    render: (s) => stringOrBlank(getPath(s, 'part6.employerOrBusinessName')),
  },
  {
    page: 5,
    x: 72,
    y: 620,
    render: (s) => stringOrBlank(getPath(s, 'part6.occupation')),
  },
  // Q2 current individual annual income
  {
    page: 5,
    x: 400,
    y: 560,
    fontSize: 11,
    render: (s) => money(getPath(s, 'part6.currentIndividualAnnualIncome')),
  },
  // Q6 household income total
  {
    page: 5,
    x: 400,
    y: 450,
    fontSize: 11,
    render: (s) => money(getPath(s, 'part6.currentAnnualHouseholdIncome')),
  },
  // Q13a - most recent tax year total income
  {
    page: 6,
    x: 300,
    y: 500,
    fontSize: 11,
    render: (s) => money(getPath(s, 'part6.taxReturnIncome.mostRecentYear.totalIncome')),
  },
  // Q13a - most recent tax year
  {
    page: 6,
    x: 150,
    y: 500,
    fontSize: 11,
    render: (s) => numberOrBlank(getPath(s, 'part6.taxReturnIncome.mostRecentYear.taxYear')),
  },

  // ─── Part 8 — Sponsor Signature (no signature image, just date + contact) ─
  {
    page: 8,
    x: 72,
    y: 400,
    render: (s) => stringOrBlank(getPath(s, 'part8.sponsorDaytimePhone')),
  },
  {
    page: 8,
    x: 300,
    y: 400,
    render: (s) => stringOrBlank(getPath(s, 'part8.sponsorEmail')),
  },
  {
    page: 8,
    x: 400,
    y: 300,
    render: (s) => mdyDate(getPath(s, 'part8.signatureDate')),
  },
]
