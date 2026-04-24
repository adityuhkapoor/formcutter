import { NextResponse } from 'next/server'
import { fillI864 } from '@/lib/pdf-fill'
import { fillForm } from '@/lib/pdf-fill-generic'
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'
import type { FormId } from '@/lib/forms'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: Request) {
  const ip = ipFromRequest(req)
  const rl = rateLimit({ key: `pdf:${ip}`, limit: 60, windowMs: 60 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 })
  }

  let body: { state?: Record<string, unknown>; formId?: FormId }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const state = body.state ?? {}
  const formId: FormId = body.formId ?? 'i-864'

  try {
    const bytes =
      formId === 'i-864'
        ? await fillI864(state)
        : await fillForm(formId, state)
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${formId}-draft.pdf"`,
      },
    })
  } catch (err) {
    console.error('pdf fill error', err)
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: 'pdf_fill_failed', message }, { status: 500 })
  }
}
