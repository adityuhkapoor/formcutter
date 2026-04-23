import { NextResponse } from 'next/server'
import { fillI864 } from '@/lib/pdf-fill'
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: Request) {
  const ip = ipFromRequest(req)
  const rl = rateLimit({ key: `pdf:${ip}`, limit: 60, windowMs: 60 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 })
  }

  let body: { state?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const state = body.state ?? {}

  try {
    const bytes = await fillI864(state)
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="i-864-draft.pdf"',
      },
    })
  } catch (err) {
    console.error('pdf fill error', err)
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: 'pdf_fill_failed', message }, { status: 500 })
  }
}
