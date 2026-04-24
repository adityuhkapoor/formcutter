import { NextResponse } from 'next/server'
import { createCase, listCases } from '@/lib/case-store'

export const runtime = 'nodejs'

/** POST /api/case → creates a new drafting case. Body may include { formType }. */
export async function POST(req: Request) {
  let body: { formType?: string } = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine
  }
  const c = createCase({ formType: body.formType })
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
