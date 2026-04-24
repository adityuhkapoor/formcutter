import { NextResponse } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  zh: 'Simplified Chinese',
  vi: 'Vietnamese',
  tl: 'Tagalog',
  ru: 'Russian',
  uk: 'Ukrainian',
  ar: 'Arabic',
  ht: 'Haitian Creole',
  pt: 'Brazilian Portuguese',
}

/**
 * POST /api/simplify — takes an assistant chat message + language, returns
 * a rewritten version at ~3rd-grade reading level in the same language.
 *
 * Used by the "Simplify" button below each assistant message in chat.
 */
export async function POST(req: Request) {
  const ip = ipFromRequest(req)
  const rl = rateLimit({ key: `simplify:${ip}`, limit: 60, windowMs: 60 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 })
  }

  let body: { text?: string; language?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) return NextResponse.json({ error: 'missing_text' }, { status: 400 })

  const language = body.language && LANGUAGE_NAMES[body.language] ? body.language : 'en'
  const languageName = LANGUAGE_NAMES[language]

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.2,
      system: [
        {
          type: 'text',
          text: `You simplify U.S. immigration assistant messages for users who have limited English / reading literacy. Rewrite at ~3rd-grade reading level. Keep the message's intent + any specific values (names, amounts, dates) intact. Remove jargon. Use short sentences (under 12 words). Don't add new questions the original didn't ask. Keep USCIS form names in English/Latin script.`,
        },
        {
          type: 'text',
          text:
            language === 'en'
              ? 'Rewrite in clear simple English.'
              : `Rewrite in ${languageName}.`,
        },
      ],
      messages: [{ role: 'user', content: `Rewrite this simpler:\n\n${text}` }],
    })

    const simplified = response.content.find((b) => b.type === 'text')?.text ?? text
    return NextResponse.json({ ok: true, simplified: simplified.trim() })
  } catch (err) {
    console.error('simplify error', err)
    return NextResponse.json(
      { error: 'simplify_failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}
