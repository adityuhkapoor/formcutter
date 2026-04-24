import { NextResponse } from 'next/server'
import { createFlagReply, updateFlag, getCase } from '@/lib/case-store'

export const runtime = 'nodejs'

/**
 * POST /api/case/:id/question-help/:flagId/reply
 * Rep-side: appends a reply to the flag and marks it resolved. The applicant
 * /fill page polls and renders rep replies as green-avatar messages in the
 * chat transcript.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; flagId: string }> }
) {
  const { id, flagId } = await params
  const c = getCase(id)
  if (!c) return NextResponse.json({ error: 'case_not_found' }, { status: 404 })

  let body: { body?: string; authorLabel?: string } = {}
  try {
    body = await req.json()
  } catch {
    /* empty ok */
  }

  if (!body.body || !body.body.trim()) {
    return NextResponse.json({ error: 'body_required' }, { status: 400 })
  }

  const replyId = createFlagReply({
    flagId,
    body: body.body.trim(),
    authorLabel: body.authorLabel,
  })
  updateFlag(flagId, { status: 'approved', resolvedNote: 'Replied by rep' })

  return NextResponse.json({ ok: true, replyId })
}
