import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * GET /api/health
 *
 * Minimal liveness probe. Reports only whether an Anthropic key is loaded —
 * never the prefix, length, env var names, or cwd. The earlier version of
 * this endpoint leaked enough metadata to flag in a security review;
 * sensitive diagnostics are now gated behind ?debug=1 + a server-side env
 * flag (FORMCUTTER_HEALTH_DEBUG=1) so dev still has them when needed.
 */
export async function GET(req: Request) {
  const ok = Boolean(process.env.ANTHROPIC_API_KEY?.trim())

  const url = new URL(req.url)
  const debugRequested = url.searchParams.get('debug') === '1'
  const debugAllowed = process.env.FORMCUTTER_HEALTH_DEBUG === '1'

  if (debugRequested && debugAllowed) {
    const raw = process.env.ANTHROPIC_API_KEY
    return NextResponse.json({
      ok,
      rawIsUndefined: raw === undefined,
      rawIsEmpty: raw === '',
      rawLength: raw?.length ?? 0,
      nodeEnv: process.env.NODE_ENV,
    })
  }

  return NextResponse.json({ ok })
}
