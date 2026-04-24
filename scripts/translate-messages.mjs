/**
 * One-shot translator: takes src/lib/i18n/messages.en.ts and produces
 * src/lib/i18n/catalogs/{code}.json for every non-English language.
 *
 * Caches translations by (key, source) → value so re-runs only translate new
 * or changed strings. Costs pennies per full run once cached.
 *
 * Usage: node scripts/translate-messages.mjs [--force] [--only es,zh,vi]
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Load .env.local without printing.
const envText = fs.readFileSync('.env.local', 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1')
}

const MODEL = 'claude-sonnet-4-6'
const CATALOG_DIR = 'src/lib/i18n/catalogs'
const CACHE_PATH = '.translation-cache.json'

const LANGS = [
  { code: 'es', name: 'Spanish' },
  { code: 'zh', name: 'Simplified Chinese (中文)' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ar', name: 'Arabic (Modern Standard)' },
  { code: 'ht', name: 'Haitian Creole' },
  { code: 'pt', name: 'Brazilian Portuguese' },
]

const flags = new Set(process.argv.slice(2))
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]?.split(',') ?? null
const force = flags.has('--force')

// Dynamically import the source English messages (TS file; Node 20+ can't
// require-TS, so we use a thin transformer: strip `export const ... as const`
// and eval the object literal).
async function loadEnglishMessages() {
  const src = fs.readFileSync('src/lib/i18n/messages.en.ts', 'utf8')
  const match = src.match(/export const MESSAGES_EN = (\{[\s\S]*?\}) as const/)
  if (!match) throw new Error('could not find MESSAGES_EN in source')
  // Safe because this file is authored by us and committed.
  return Function(`return ${match[1]}`)()
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {}
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) } catch { return {} }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
}

const client = new Anthropic()

async function translateBatch({ lang, keyedEntries }) {
  // keyedEntries: [{ key, source }]
  if (keyedEntries.length === 0) return {}
  const systemPrompt = `You are a professional UI translator for a U.S. immigration form-filling assistant used by immigrants with limited English.

Translate each supplied string into ${lang.name} (locale code "${lang.code}").

Rules:
- Preserve placeholder tokens like {count}, {name}, {X} exactly as-is.
- Preserve emoji, line breaks (\\n), and markdown (**bold**, _italic_).
- Use plain, warm, 5th-grade-reading-level phrasing. Prefer clarity over formality.
- Terms of art: "I-864", "USCIS", "AI" — keep in English/Latin script. Everything else translates.
- Avoid false cognates. For "sponsor" in the immigration sense use the common legal-Spanish equivalent "patrocinador" rather than financial "padrino".
- Output ONLY a JSON object mapping key → translation. No prose. No wrapper keys.`

  const content = keyedEntries.map((e) => `${e.key}: ${e.source}`).join('\n')
  const userPrompt = `Translate the following UI strings. Each line is "key: English source". Return JSON mapping key → translated string.\n\n${content}`

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = res.content.find((b) => b.type === 'text')?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`no JSON in response for ${lang.code}:\n${text}`)
  return JSON.parse(jsonMatch[0])
}

async function main() {
  fs.mkdirSync(CATALOG_DIR, { recursive: true })
  const englishMessages = await loadEnglishMessages()
  const cache = loadCache()
  let totalNew = 0

  for (const lang of LANGS) {
    if (only && !only.includes(lang.code)) continue
    cache[lang.code] = cache[lang.code] ?? {}
    const langCache = cache[lang.code]

    const needsTranslation = []
    const translated = {}

    for (const [key, source] of Object.entries(englishMessages)) {
      const cacheKey = `${source}`
      if (!force && langCache[cacheKey]) {
        translated[key] = langCache[cacheKey]
      } else {
        needsTranslation.push({ key, source })
      }
    }

    if (needsTranslation.length === 0) {
      console.log(`${lang.code}: all ${Object.keys(englishMessages).length} strings cached, skipping`)
    } else {
      console.log(`${lang.code}: translating ${needsTranslation.length} new/changed strings...`)
      const BATCH = 50
      for (let i = 0; i < needsTranslation.length; i += BATCH) {
        const slice = needsTranslation.slice(i, i + BATCH)
        const result = await translateBatch({ lang, keyedEntries: slice })
        for (const { key, source } of slice) {
          if (result[key]) {
            translated[key] = result[key]
            langCache[source] = result[key]
            totalNew += 1
          } else {
            // Fall back to English if the model skipped one.
            translated[key] = source
          }
        }
      }
    }

    const outPath = path.join(CATALOG_DIR, `${lang.code}.json`)
    fs.writeFileSync(outPath, JSON.stringify(translated, null, 2) + '\n')
    console.log(`  wrote ${outPath}`)
  }

  saveCache(cache)
  console.log(`done. ${totalNew} new translations added. cache at ${CACHE_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
