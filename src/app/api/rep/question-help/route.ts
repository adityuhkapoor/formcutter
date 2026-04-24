import { NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db, cases, flags } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/rep/question-help
 * Rep-side queue: every unresolved `question_help` flag joined with the case
 * basics. Distinct from the "submitted cases awaiting full review" queue
 * because these are mid-fill interventions the rep can answer without
 * blocking the applicant's overall progress.
 */
export async function GET() {
  const rows = db
    .select({
      flagId: flags.id,
      caseId: cases.id,
      formType: cases.formType,
      displayName: cases.displayName,
      caseStatus: cases.status,
      flagTitle: flags.title,
      flagDetail: flags.detail,
      flagCreatedAt: flags.createdAt,
      suggestedFieldPath: flags.suggestedFieldPath,
    })
    .from(flags)
    .innerJoin(cases, eq(flags.caseId, cases.id))
    .where(and(eq(flags.kind, 'question_help'), eq(flags.status, 'pending')))
    .orderBy(desc(flags.createdAt))
    .all()
  return NextResponse.json({ ok: true, items: rows })
}
