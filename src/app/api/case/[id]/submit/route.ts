import { NextResponse } from 'next/server'
import {
  getCase,
  updateCase,
  clearFlagsForCase,
  createFlag,
  getFlagsForCase,
} from '@/lib/case-store'
import { analyzeCase } from '@/lib/flag-analyst'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/case/:id/submit
 * Moves case to pending_review, runs the flag analyst, persists flags.
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const c = getCase(id)
  if (!c) return NextResponse.json({ error: 'case_not_found' }, { status: 404 })
  if (c.status !== 'drafting') {
    return NextResponse.json(
      { error: 'already_submitted', status: c.status },
      { status: 409 }
    )
  }

  // Fresh analysis — clear any prior flags from prior submissions.
  clearFlagsForCase(id)

  const flags = await analyzeCase({
    state: c.state,
    messages: c.messages,
  })
  for (const f of flags) {
    createFlag({
      caseId: id,
      kind: f.kind,
      severity: f.severity,
      title: f.title,
      detail: f.detail,
      llmReasoning: f.llmReasoning,
      suggestedFieldPath: f.suggestedFieldPath,
    })
  }

  const updated = updateCase(id, {
    status: 'pending_review',
    submittedAt: new Date(),
  })

  return NextResponse.json({
    ok: true,
    case: updated,
    flags: getFlagsForCase(id),
  })
}
