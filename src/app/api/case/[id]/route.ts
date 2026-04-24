import { NextResponse } from 'next/server'
import { getCase, updateCase, getFlagsForCase } from '@/lib/case-store'
import type { CaseMessage } from '@/lib/db/schema'

export const runtime = 'nodejs'

/** GET /api/case/:id → full case + flags (for both immigrant polling + rep review). */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const c = getCase(id)
  if (!c) return NextResponse.json({ error: 'case_not_found' }, { status: 404 })
  const flags = getFlagsForCase(id)
  return NextResponse.json({ ok: true, case: c, flags })
}

/** PUT /api/case/:id → patch state / messages / displayName. Immigrant-side autosave. */
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const c = getCase(id)
  if (!c) return NextResponse.json({ error: 'case_not_found' }, { status: 404 })
  if (c.status !== 'drafting') {
    return NextResponse.json(
      { error: 'case_locked', status: c.status },
      { status: 409 }
    )
  }

  let body: {
    state?: Record<string, unknown>
    messages?: CaseMessage[]
    displayName?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const updated = updateCase(id, {
    state: body.state,
    messages: body.messages,
    displayName: body.displayName,
  })
  return NextResponse.json({ ok: true, case: updated })
}
