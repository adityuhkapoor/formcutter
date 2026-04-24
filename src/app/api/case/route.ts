import { NextResponse } from 'next/server'
import { createCase, createFlag, updateCase } from '@/lib/case-store'
import { listCases } from '@/lib/case-store'
import type { CaseMessage } from '@/lib/db/schema'

export const runtime = 'nodejs'

type CreateCaseBody = {
  formType?: string
  /** If the case originated from a triage escalation, attach the transcript. */
  triageTranscript?: CaseMessage[]
  /**
   * Optional triage escalation payload. If present, we additionally create a
   * `triage_escalation` flag so the rep queue surfaces this as a pre-fill
   * escalation rather than a regular drafting case.
   */
  triageEscalation?: {
    reason: string
    severity: 'red-flag' | 'judgment' | 'self-requested' | 'turn-cap'
    contactEmail?: string
    contactPhone?: string
  }
  /** Optional display name for surfacing in the rep queue. */
  displayName?: string
}

/** POST /api/case → creates a new drafting case. */
export async function POST(req: Request) {
  let body: CreateCaseBody = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine
  }

  const c = createCase({
    formType: body.formType,
    triageTranscript: body.triageTranscript,
  })

  if (body.displayName) {
    updateCase(c.id, { displayName: body.displayName })
  }

  // If this was a triage escalation, pin a flag + mark the case pending so it
  // shows up in the rep queue immediately rather than sitting in drafting.
  if (body.triageEscalation) {
    const severityMap = {
      'red-flag': 'error' as const,
      judgment: 'warn' as const,
      'self-requested': 'info' as const,
      'turn-cap': 'warn' as const,
    }
    createFlag({
      caseId: c.id,
      kind: 'triage_escalation',
      severity: severityMap[body.triageEscalation.severity] ?? 'warn',
      title: 'Triage escalation — needs pre-fill review',
      detail: [
        body.triageEscalation.reason,
        body.triageEscalation.contactEmail && `Contact: ${body.triageEscalation.contactEmail}`,
        body.triageEscalation.contactPhone && `Phone: ${body.triageEscalation.contactPhone}`,
      ]
        .filter(Boolean)
        .join(' · '),
    })
    updateCase(c.id, { status: 'pending_review', submittedAt: new Date() })
  }

  return NextResponse.json({ ok: true, case: c })
}

/**
 * GET /api/case?status=pending_review (for rep dashboard).
 * GET /api/case (all cases, most recent first).
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') as
    | 'drafting'
    | 'pending_review'
    | 'approved'
    | 'released'
    | null
  const rows = listCases(status ? { status } : undefined)
  return NextResponse.json({ ok: true, cases: rows })
}
