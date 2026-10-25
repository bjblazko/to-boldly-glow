import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lookup, messagesFor, parseAttributeList } from '../src/i18n/i18n'
import { pickLocale, SUPPORTED_LOCALES } from '../src/i18n/locale'

const INDEX_HTML = readFileSync(join(__dirname, '..', 'index.html'), 'utf8')

// Every text of a catalog by its dotted path: a string, or a function's parameter count.
function shape(node: unknown, path = ''): Record<string, string> {
  if (typeof node === 'string') return { [path]: node === '' ? 'empty' : 'text' }
  if (typeof node === 'function') return { [path]: `function/${node.length}` }
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>(
    (all, [key, child]) => ({ ...all, ...shape(child, path ? `${path}.${key}` : key) }),
    {},
  )
}

describe('picking the language', () => {
  const none = { search: '', stored: null, preferred: [] }

  it('follows the browser, region and all, and falls back to English', () => {
    expect(pickLocale({ ...none, preferred: ['de-AT', 'en'] })).toBe('de')
    expect(pickLocale({ ...none, preferred: ['fr-FR', 'de'] })).toBe('de')
    expect(pickLocale({ ...none, preferred: ['ja'] })).toBe('en')
    expect(pickLocale(none)).toBe('en')
  })

  it('prefers the visitor’s own choice over the browser, and a link’s ?lang= over both', () => {
    expect(pickLocale({ search: '', stored: 'de', preferred: ['en'] })).toBe('de')
    expect(pickLocale({ search: '?lang=en', stored: 'de', preferred: ['de'] })).toBe('en')
    expect(pickLocale({ search: '?lang=xx', stored: 'de', preferred: ['en'] })).toBe('de')
  })
})

describe('the message catalogs', () => {
  const english = shape(messagesFor('en'))

  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== 'en'))('%s has every text English has, and no others', (locale) => {
    expect(shape(messagesFor(locale))).toEqual(english)
  })

  it('has a text for every data-i18n path in index.html', () => {
    const textPaths = [...INDEX_HTML.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1])
    const attributePaths = [...INDEX_HTML.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((match) => parseAttributeList(match[1]).map(([, path]) => path))
    expect(textPaths.length).toBeGreaterThan(50)
    for (const locale of SUPPORTED_LOCALES) {
      expect([...textPaths, ...attributePaths].filter((path) => lookup(path, messagesFor(locale)) === undefined)).toEqual([])
    }
  })

  it('keeps index.html’s own English texts the same as the catalog’s', () => {
    const mismatches = [...INDEX_HTML.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)]
      .map((match) => ({ path: match[1], markup: match[2].replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim(), catalog: lookup(match[1], messagesFor('en'))!.trim() }))
      .filter(({ markup, catalog }) => markup !== catalog)
    expect(mismatches).toEqual([])
  })
})
