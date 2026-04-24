import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Force no-cache headers on everything during development so we never ship a
 * feature and then stare at a cached browser response wondering why it didn't
 * land. Remove or gate by NODE_ENV before production.
 */
export function middleware(request: NextRequest) {
  const res = NextResponse.next()
  res.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  )
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  res.headers.set('Surrogate-Control', 'no-store')
  // Let callers see what build this was served by — helps diagnose stale bundles.
  res.headers.set('X-Formcutter-Build', String(Date.now()))
  return res
}

export const config = {
  matcher: [
    // Skip Next internals + static files the dev server already serves fresh.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
