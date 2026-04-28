import Anthropic from '@anthropic-ai/sdk'

// Strip wrapping quotes if the env file has them. Turbopack's dotenv loader
// in Next.js 16 passes quoted values through literally in some cases.
function cleanKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed
  return unquoted || undefined
}

export const anthropic = new Anthropic({
  apiKey: cleanKey(process.env.ANTHROPIC_API_KEY),
})

export const MODEL = 'claude-opus-4-7'

// Rate caps applied per request to prevent runaway costs from demo traffic.
// Note: Opus 4.7 deprecated `temperature` — it's no longer accepted by the
// API for newer Claude models, so we omit it from defaults entirely.
export const DEFAULTS = {
  maxTokens: 2048,
} as const

export type DocHint =
  | 'license'
  | 'passport'
  | 'green-card'
  | 'tax-return'
  | 'tax-transcript'
  | 'paystub'
  | 'other'
