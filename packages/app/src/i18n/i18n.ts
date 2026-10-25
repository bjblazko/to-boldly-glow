import { browserLocaleSources, LOCALE_TAGS, pickLocale, type Locale } from './locale'
import { de } from './messages/de'
import { en, type Messages } from './messages/en'

const CATALOGS: Record<Locale, Messages> = { en, de }

// The language is settled once, as the page loads: switching it reloads the page, so every text -
// including the ones built into module constants (lesson chapters, body names) - is in one language.
export const locale: Locale = pickLocale(browserLocaleSources())
export const msg: Messages = CATALOGS[locale]

export function messagesFor(target: Locale): Messages {
  return CATALOGS[target]
}

// A text by its dotted path (`hud.settings.title`), for index.html's data-i18n attributes. Only
// plain texts resolve, not the catalog's functions.
export function lookup(path: string, messages: Messages = msg): string | undefined {
  const value = path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), messages)
  return typeof value === 'string' ? value : undefined
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString(LOCALE_TAGS[locale], { maximumFractionDigits })
}

export function formatSignificant(value: number, maximumSignificantDigits: number): string {
  return value.toLocaleString(LOCALE_TAGS[locale], { maximumSignificantDigits })
}

// index.html's own texts: an element's text from data-i18n="path", its attributes from
// data-i18n-attr="aria-label:path;title:path". A path the catalog lacks keeps the English text in
// the markup (a test makes sure there is none).
export function applyStaticTranslations(root: ParentNode, messages: Messages = msg): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const text = lookup(element.dataset.i18n!, messages)
    if (text !== undefined) element.textContent = text
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    for (const [attribute, path] of parseAttributeList(element.dataset.i18nAttr!)) {
      const text = lookup(path, messages)
      if (text !== undefined) element.setAttribute(attribute, text)
    }
  }
}

export function parseAttributeList(list: string): [attribute: string, path: string][] {
  return list
    .split(';')
    .map((entry) => entry.split(':').map((part) => part.trim()))
    .filter((parts): parts is [string, string] => parts.length === 2 && parts[0] !== '' && parts[1] !== '')
}

// A body's name, by its id (the catalog names every body the app has).
export function bodyName(id: string): string {
  return msg.scene.bodies[id] ?? id
}

// Always `digits` decimals (0.0, 23.4), in the language's own notation.
export function formatFixed(value: number, digits: number): string {
  return value.toLocaleString(LOCALE_TAGS[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
