'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { MESSAGES_EN, type MessageKey } from './messages.en'
import {
  DEFAULT_LANGUAGE,
  isValidLanguage,
  LANGUAGES,
  RTL_LANGUAGES,
  type LanguageCode,
} from './languages'

// Pre-bundled catalogs. Using JSON imports keeps tree-shaking simple.
import es from './catalogs/es.json'
import zh from './catalogs/zh.json'
import vi from './catalogs/vi.json'
import tl from './catalogs/tl.json'
import ru from './catalogs/ru.json'
import uk from './catalogs/uk.json'
import ar from './catalogs/ar.json'
import ht from './catalogs/ht.json'
import pt from './catalogs/pt.json'

const CATALOGS: Record<LanguageCode, Record<string, string>> = {
  en: MESSAGES_EN,
  es,
  zh,
  vi,
  tl,
  ru,
  uk,
  ar,
  ht,
  pt,
}

const LOCAL_KEY = 'formcutter:lang'

type I18nCtx = {
  lang: LanguageCode
  setLang: (next: LanguageCode) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  isRtl: boolean
}

const Ctx = createContext<I18nCtx | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(DEFAULT_LANGUAGE)

  // Hydrate from localStorage on mount (client-only).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(LOCAL_KEY)
    if (stored && isValidLanguage(stored) && stored !== lang) {
      setLangState(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect RTL + lang on <html> for proper CSS + a11y.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('lang', lang)
    document.documentElement.setAttribute('dir', RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr')
  }, [lang])

  function setLang(next: LanguageCode) {
    setLangState(next)
    if (typeof window !== 'undefined') localStorage.setItem(LOCAL_KEY, next)
  }

  const t = useMemo(() => {
    const catalog = CATALOGS[lang] ?? MESSAGES_EN
    return (key: MessageKey, vars?: Record<string, string | number>) => {
      const template = catalog[key] ?? MESSAGES_EN[key] ?? key
      if (!vars) return template
      return template.replace(/\{(\w+)\}/g, (_, v) =>
        vars[v] !== undefined ? String(vars[v]) : `{${v}}`
      )
    }
  }, [lang])

  const value: I18nCtx = {
    lang,
    setLang,
    t,
    isRtl: RTL_LANGUAGES.has(lang),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside <I18nProvider>')
  return v
}

export { LANGUAGES }
export type { LanguageCode }
