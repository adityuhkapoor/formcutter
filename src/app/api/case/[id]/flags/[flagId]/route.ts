import { NextResponse } from 'next/server'
import { updateFlag, getFlagsForCase } from '@/lib/case-store'
import type { FlagStatus } from '@/lib/db/schema'

export const runtime = 'nodejs'

/** PUT /api/case/:id/flags/:flagId — rep changes status on one flag. */
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string; flagId: string }> }
) {
  const { id, flagId } = await context.params

  let body: { status?: FlagStatus; resolvedNote?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  updateFlag(flagId, {
    status: body.status,
    resolvedNote: body.resolvedNote,
  })

  return NextResponse.json({ ok: true, flags: getFlagsForCase(id) })
}
