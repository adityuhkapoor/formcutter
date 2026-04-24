import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function cleanKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  return (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ? trimmed.slice(1, -1) || undefined
    : trimmed || undefined
}

export async function GET() {
  const raw = process.env.ANTHROPIC_API_KEY
  const cleaned = cleanKey(raw)
  const allEnvKeys = Object.keys(process.env).filter((k) =>
    /ANTHRO|API_KEY|AUTH/i.test(k)
  )
  return NextResponse.json({
    ok: Boolean(cleaned),
    rawType: typeof raw,
    rawIsUndefined: raw === undefined,
    rawIsEmpty: raw === '',
    rawLength: raw?.length ?? 0,
    cleanedLength: cleaned?.length ?? 0,
    keyPrefix: cleaned?.slice(0, 10) ?? null,
    matchingEnvKeys: allEnvKeys,
    nodeEnv: process.env.NODE_ENV,
    cwd: process.cwd(),
  })
}
