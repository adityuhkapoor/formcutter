'use client'

import { useI18n, LANGUAGES, type LanguageCode } from '@/lib/i18n/provider'

/**
 * Small inline dropdown. Placed in the header so it's always accessible.
 * No build-time localization needed — strings flip instantly on change.
 */
export function LanguagePicker() {
  const { lang, setLang } = useI18n()
  return (
    <label className="flex items-center gap-1.5 text-xs text-neutral-600">
      <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-neutral-400">
        language
      </span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as LanguageCode)}
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs hover:border-neutral-400 focus:border-neutral-900 focus:outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  )
}
