import Anthropic from '@anthropic-ai/sdk'

// Singleton SDK client for all server routes.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const MODEL = 'claude-sonnet-4-6'

// Rate caps applied per request to prevent runaway costs from demo traffic.
export const DEFAULTS = {
  maxTokens: 2048,
  temperature: 0,
} as const

export type DocHint =
  | 'license'
  | 'passport'
  | 'green-card'
  | 'tax-return'
  | 'tax-transcript'
  | 'paystub'
  | 'other'
