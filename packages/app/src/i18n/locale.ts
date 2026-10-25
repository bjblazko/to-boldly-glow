// The languages the app speaks. A new one needs its message catalog (i18n/messages/) and its
// narration (narration/scripts/).
export const SUPPORTED_LOCALES = ['en', 'de'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

// Its own name, for the language switch.
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch' }

// For Intl's number formats.
export const LOCALE_TAGS: Record<Locale, string> = { en: 'en-US', de: 'de-DE' }

const STORAGE_KEY = 'toBoldlyGlow.locale'
const FALLBACK: Locale = 'en'

export interface LocaleSources {
  // The page's query string: ?lang=de picks German for a link (and the end-to-end tests).
  search: string
  // The language the visitor chose before, if any.
  stored: string | null
  // The browser's languages, most preferred first.
  preferred: readonly string[]
}

export function isLocale(value: string | null | undefined): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? '')
}

// A link's ?lang= first, then the visitor's own choice, then the first of the browser's languages
// the app speaks (de-AT counts as de), and English otherwise.
export function pickLocale({ search, stored, preferred }: LocaleSources): Locale {
  const requested = new URLSearchParams(search).get('lang')
  if (isLocale(requested)) return requested
  if (isLocale(stored)) return stored
  const spoken = preferred.map((tag) => tag.toLowerCase().split('-')[0]).find(isLocale)
  return spoken ?? FALLBACK
}

export function browserLocaleSources(): LocaleSources {
  if (typeof window === 'undefined') return { search: '', stored: null, preferred: [] }
  return { search: window.location.search, stored: storedLocale(), preferred: navigator.languages ?? [navigator.language] }
}

// The visitor's own choice, if they made one (the welcome card asks once).
export function storedLocale(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function rememberLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Private mode or blocked storage: the choice holds for this page only.
  }
}
