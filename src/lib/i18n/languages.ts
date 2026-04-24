/**
 * Top 9 languages USCIS provides form translations or instructions for,
 * matching the populations most represented in family-based immigration.
 * Ordered by approximate US immigrant population size.
 *
 * Each entry:
 * - `code`: BCP-47 locale code (used for Web Speech API + browser <html lang="">)
 * - `name`: native-script label for the language picker
 * - `englishName`: displayed in dev / admin UIs
 * - `speechLang`: exact code browsers expect for SpeechRecognition.lang
 */
export const LANGUAGES = [
  { code: 'en', name: 'English', englishName: 'English', speechLang: 'en-US' },
  { code: 'es', name: 'Español', englishName: 'Spanish', speechLang: 'es-US' },
  { code: 'zh', name: '中文 (简体)', englishName: 'Chinese (Simplified)', speechLang: 'zh-CN' },
  { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese', speechLang: 'vi-VN' },
  { code: 'tl', name: 'Tagalog', englishName: 'Tagalog', speechLang: 'fil-PH' },
  { code: 'ru', name: 'Русский', englishName: 'Russian', speechLang: 'ru-RU' },
  { code: 'uk', name: 'Українська', englishName: 'Ukrainian', speechLang: 'uk-UA' },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', speechLang: 'ar-SA' },
  { code: 'ht', name: 'Kreyòl Ayisyen', englishName: 'Haitian Creole', speechLang: 'ht-HT' },
  { code: 'pt', name: 'Português', englishName: 'Portuguese', speechLang: 'pt-BR' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: LanguageCode = 'en'

export function isValidLanguage(code: string): code is LanguageCode {
  return LANGUAGES.some((l) => l.code === code)
}

export function languageMeta(code: LanguageCode) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
}

/** Right-to-left languages need some CSS flipping. */
export const RTL_LANGUAGES: Set<LanguageCode> = new Set(['ar'])
