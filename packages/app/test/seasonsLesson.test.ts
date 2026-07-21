import { describe, expect, it } from 'vitest'
import { LESSONS_BY_ID, SEASONS_LESSON } from '../src/learn/lessons/seasons'

describe('SEASONS_LESSON', () => {
  it('has exactly 5 chapters in chronological order', () => {
    expect(SEASONS_LESSON.chapters).toHaveLength(5)
    const ids = SEASONS_LESSON.chapters.map((c) => c.id)
    expect(ids).toEqual(['intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice'])
  })

  it('every chapter has a season phase in [0, 360) degrees', () => {
    for (const chapter of SEASONS_LESSON.chapters) {
      expect(chapter.seasonPhaseDegrees).toBeGreaterThanOrEqual(0)
      expect(chapter.seasonPhaseDegrees).toBeLessThan(360)
    }
  })

  it('the four solstice/equinox chapters use the four cardinal phases exactly once each', () => {
    const nonIntro = SEASONS_LESSON.chapters.filter((c) => c.id !== 'intro')
    const phases = nonIntro.map((c) => c.seasonPhaseDegrees).sort((a, b) => a - b)
    expect(phases).toEqual([0, 90, 180, 270])
  })

  it('Intro uses a neutral (equinox-like) phase, matching one of the equinox chapters', () => {
    const intro = SEASONS_LESSON.chapters.find((c) => c.id === 'intro')!
    const septemberEquinox = SEASONS_LESSON.chapters.find((c) => c.id === 'september-equinox')!
    expect(intro.seasonPhaseDegrees).toBe(septemberEquinox.seasonPhaseDegrees)
  })

  it('every chapter has non-empty text', () => {
    for (const chapter of SEASONS_LESSON.chapters) {
      expect(chapter.text.length).toBeGreaterThan(0)
    }
  })

  it('June and December solstice text each mention both locations by name', () => {
    const june = SEASONS_LESSON.chapters.find((c) => c.id === 'june-solstice')!
    const december = SEASONS_LESSON.chapters.find((c) => c.id === 'december-solstice')!
    for (const chapter of [june, december]) {
      expect(chapter.text).toContain('Location A')
      expect(chapter.text).toContain('Location B')
    }
  })

  it('markerLatitudeDegrees is a single positive magnitude (the two markers are its +/- mirror)', () => {
    expect(SEASONS_LESSON.markerLatitudeDegrees).toBeGreaterThan(0)
    expect(SEASONS_LESSON.markerLatitudeDegrees).toBeLessThan(90)
  })

  it('is registered in LESSONS_BY_ID under "seasons"', () => {
    expect(LESSONS_BY_ID['seasons']).toBe(SEASONS_LESSON)
  })
})
