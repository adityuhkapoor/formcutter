import { NextResponse } from 'next/server'
import { getCase, updateCase, getFlagsForCase } from '@/lib/case-store'

export const runtime = 'nodejs'

/**
 * POST /api/case/:id/release
 * Rep marks the case approved after reviewing flags. Immigrant side polling
 * will flip to "approved" and unlock the PDF download.
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const c = getCase(id)
  if (!c) return NextResponse.json({ error: 'case_not_found' }, { status: 404 })
  if (c.status !== 'pending_review') {
    return NextResponse.json(
      { error: 'not_pending_review', status: c.status },
      { status: 409 }
    )
  }

  const pending = getFlagsForCase(id).filter((f) => f.status === 'pending')
  if (pending.length > 0) {
    return NextResponse.json(
      {
        error: 'unresolved_flags',
        pendingCount: pending.length,
      },
      { status: 409 }
    )
  }

  const updated = updateCase(id, {
    status: 'approved',
    approvedAt: new Date(),
  })
  return NextResponse.json({ ok: true, case: updated })
}
