/**
 * Evidence requirements per form.
 *
 * Each requirement is a bucket that can be satisfied by one or more
 * extracted `docType` values. The checklist sidebar walks the requirements,
 * matches uploaded docs against them, and surfaces what's still missing.
 *
 * This is the lawyer-brain of the product — we encode what USCIS actually
 * wants in the evidence packet, not just what goes on the form itself.
 */

export type DocType =
  | 'license'
  | 'passport'
  | 'green-card'
  | 'tax-return'
  | 'tax-transcript'
  | 'paystub'
  | 'employer-letter'
  | 'birth-certificate'
  | 'naturalization-cert'
  | 'bank-statement'
  | 'other'

export type EvidenceRequirement = {
  /** Stable id used as React key + state. */
  id: string
  /** i18n key for the user-facing label. */
  labelI18nKey: string
  /** Plain-English explanation (falls back to this if i18n missing). */
  labelEn: string
  /** Description shown on hover — what does this satisfy? */
  descriptionEn: string
  /** "required" = must have; "conditional" = only if a trigger matches; "recommended" = strongly encouraged */
  tier: 'required' | 'conditional' | 'recommended'
  /** DocTypes that can satisfy this requirement. First match wins. */
  satisfiedBy: DocType[]
  /** Minimum count needed (e.g. pay stubs: 6 issues over 6 months; most evidence: 1). */
  minCount: number
  /** Max age in days (for freshness-sensitive docs). */
  maxAgeDays?: number
  /** Only show when this condition matches state. */
  conditionOn?: (state: Record<string, unknown>) => boolean
}

/**
 * Requirements for the I-864 evidence packet.
 * Source: USCIS I-864 instructions + our earlier research.
 */
export const I864_EVIDENCE: EvidenceRequirement[] = [
  {
    id: 'citizenship-proof',
    labelI18nKey: 'evidence.citizenship',
    labelEn: 'Proof of U.S. citizenship or LPR status',
    descriptionEn:
      'A passport, birth certificate, naturalization certificate, or both sides of a green card.',
    tier: 'required',
    satisfiedBy: ['passport', 'birth-certificate', 'naturalization-cert', 'green-card'],
    minCount: 1,
  },
  {
    id: 'tax-return-recent',
    labelI18nKey: 'evidence.taxReturn',
    labelEn: 'Most recent federal tax return (or IRS transcript)',
    descriptionEn:
      "The sponsor's full 1040 from the most recent year (with all W-2s, 1099s, and schedules) OR an IRS tax transcript. Missing schedules are the #1 cause of RFEs.",
    tier: 'required',
    satisfiedBy: ['tax-return', 'tax-transcript'],
    minCount: 1,
  },
  {
    id: 'current-income-proof',
    labelI18nKey: 'evidence.payStubs',
    labelEn: 'Pay stubs from last 6 months (if currently employed)',
    descriptionEn:
      "Every pay stub for the last 6 months, or an employer letter confirming current salary. USCIS uses this to verify the sponsor's current income matches what's on the form.",
    tier: 'recommended',
    satisfiedBy: ['paystub', 'employer-letter'],
    minCount: 1, // We accept 1 for the demo; production would check 6.
    maxAgeDays: 180,
  },
  {
    id: 'photo-id',
    labelI18nKey: 'evidence.photoId',
    labelEn: "Government-issued photo ID (driver's license or equivalent)",
    descriptionEn:
      "A driver's license or state ID. Confirms the sponsor's identity and address for USCIS.",
    tier: 'recommended',
    satisfiedBy: ['license', 'passport'],
    minCount: 1,
  },
  {
    id: 'domicile-proof',
    labelI18nKey: 'evidence.domicile',
    labelEn: 'Proof of U.S. domicile (only if sponsor lives abroad)',
    descriptionEn:
      'Lease, voter registration, U.S. bank accounts, employer letter, or similar showing intent to reside in the U.S.',
    tier: 'conditional',
    satisfiedBy: ['bank-statement', 'employer-letter', 'other'],
    minCount: 1,
    conditionOn: (state) => {
      const domicile = getPath(state, 'part4.countryOfDomicile')
      return typeof domicile === 'string' && domicile.trim().length > 0 && !/usa|united states|u\.s\./i.test(domicile)
    },
  },
]

function getPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let cur: unknown = obj
  for (const k of keys) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

export type UploadedDoc = {
  id: string
  fileName: string
  /** What the user said it was. */
  claimedType: DocType
  /** What the LLM's extraction concluded it actually was. */
  detectedType: DocType
  /** Warnings from the extractor (stale, partial, illegible, etc). */
  warnings: string[]
  /** Date the document covers (if detectable — e.g. pay-stub period end, tax year end). */
  docDate?: Date
  uploadedAt: Date
}

export type EvidenceStatus = {
  requirement: EvidenceRequirement
  matching: UploadedDoc[]
  /** "met" | "partial" | "stale" | "missing" */
  status: 'met' | 'partial' | 'stale' | 'missing'
}

export function evaluateEvidence(opts: {
  requirements: EvidenceRequirement[]
  docs: UploadedDoc[]
  state: Record<string, unknown>
  now?: Date
}): EvidenceStatus[] {
  const now = opts.now ?? new Date()
  const out: EvidenceStatus[] = []

  for (const r of opts.requirements) {
    if (r.conditionOn && !r.conditionOn(opts.state)) continue
    const matching = opts.docs.filter((d) => r.satisfiedBy.includes(d.detectedType))
    let status: EvidenceStatus['status']
    if (matching.length === 0) {
      status = 'missing'
    } else {
      const freshMatching = r.maxAgeDays
        ? matching.filter(
            (d) =>
              d.docDate &&
              (now.getTime() - d.docDate.getTime()) / 86_400_000 <= r.maxAgeDays!
          )
        : matching
      if (freshMatching.length >= r.minCount) {
        status = 'met'
      } else if (freshMatching.length > 0 || matching.length >= r.minCount) {
        // Matching docs exist but either too old or too few of the fresh ones.
        status = r.maxAgeDays && freshMatching.length < matching.length ? 'stale' : 'partial'
      } else {
        status = 'partial'
      }
    }
    out.push({ requirement: r, matching, status })
  }

  return out
}
