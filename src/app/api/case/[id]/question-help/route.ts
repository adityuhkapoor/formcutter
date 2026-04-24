import { NextResponse } from 'next/server'
import { createFlag, getCase, getRepliesForCase } from '@/lib/case-store'

export const runtime = 'nodejs'

/**
 * GET /api/case/:id/question-help
 * Returns all rep replies for question_help flags on this case, so the
 * applicant /fill UI can inline them as assistant messages.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = getCase(id)
  if (!c) return NextResponse.json({ error: 'case_not_found' }, { status: 404 })
  const replies = getRepliesForCase(id)
  return NextResponse.json({ ok: true, replies })
}

/**
 * POST /api/case/:id/question-help
 * Creates a `question_help` flag on the case. Body captures the specific
 * assistant turn (and any context) the user asked a rep to weigh in on.
 * Returns the flag id so the UI can mark the chat turn as "waiting on rep".
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = getCase(id)
  if (!c) return NextResponse.json({ error: 'case_not_found' }, { status: 404 })

  let body: {
    messageId?: string
    questionText?: string
    fieldPath?: string
    partialAnswer?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    /* empty ok */
  }

  if (!body.questionText || !body.questionText.trim()) {
    return NextResponse.json({ error: 'question_text_required' }, { status: 400 })
  }

  const detail = [
    body.questionText.trim(),
    body.fieldPath && `Field: ${body.fieldPath}`,
    body.partialAnswer && `User's in-progress answer: ${body.partialAnswer}`,
    body.messageId && `Turn: ${body.messageId}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const flagId = createFlag({
    caseId: id,
    kind: 'question_help',
    severity: 'info',
    title: 'Applicant requested rep help on this question',
    detail,
    suggestedFieldPath: body.fieldPath,
  })

  return NextResponse.json({ ok: true, flagId })
}
