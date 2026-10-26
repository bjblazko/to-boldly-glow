import { describe, expect, it } from 'vitest'
import { SUPPORTED_LOCALES } from '../src/i18n/locale'
import { LESSONS_BY_ID } from '../src/learn/lessons/lessonCatalog'
import { lessonClipId, narrationSegments, orderClipId } from '../src/narration/narrationSegments'
import { spokenText } from '../src/narration/spokenText'

describe('the lessons read out', () => {
  it.each(SUPPORTED_LOCALES)('have a text for every chapter, in every order, and for every order (%s)', (locale) => {
    const ids = new Set(narrationSegments().filter((segment) => segment.locale === locale).map((segment) => segment.id))
    for (const lesson of Object.values(LESSONS_BY_ID)) {
      const chapters = [lesson.chapters, ...(lesson.sortings ?? []).map((sorting) => sorting.chapters)].flat()
      for (const chapter of chapters) expect(ids).toContain(lessonClipId(lesson.id, chapter.id, chapter.focusPlanetId))
      for (const sorting of lesson.sortings ?? []) expect(ids).toContain(orderClipId(sorting.id))
    }
  })

  it('reads a planet’s chapter in the tour’s words for it', () => {
    expect(lessonClipId('planetSizes', 'jupiter', 'jupiter')).toBe('jupiter-orbit')
    expect(lessonClipId('planetSizes', 'lineup')).toBe('lesson-planetSizes-lineup')
  })

  it('names the planets in their new order', () => {
    const size = narrationSegments().find((segment) => segment.locale === 'de' && segment.id === 'order-size')!
    expect(size.text).toBe('Nach Größe, vom größten zum kleinsten: Jupiter, Saturn, Uranus, Neptun, Erde, Venus, Mars und Merkur.')
  })
})

describe('a text made fit to be spoken', () => {
  it('spells out the units a voice would stumble over, in each language', () => {
    expect(spokenText('at 1,700 km/h, at most 270 km wide, tilted 23.4°, 99.8% of the mass', 'en')).toBe(
      'at 1,700 kilometres an hour, at most 270 kilometres wide, tilted 23.4 degrees, 99.8 percent of the mass',
    )
    expect(spokenText('mit 1.700 km/h, höchstens 270 km breit, um 23,4° geneigt, 99,8 % der Masse', 'de')).toBe(
      'mit 1.700 Kilometer pro Stunde, höchstens 270 Kilometer breit, um 23,4 Grad geneigt, 99,8 Prozent der Masse',
    )
  })

  it('leaves words alone', () => {
    expect(spokenText('The kilometre-long Moon shadow', 'en')).toBe('The kilometre-long Moon shadow')
  })
})
