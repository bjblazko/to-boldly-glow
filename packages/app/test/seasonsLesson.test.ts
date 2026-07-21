import { describe, expect, it } from 'vitest'
import { LESSONS_BY_ID, SEASONS_LESSON } from '../src/learn/lessons/seasons'

describe('SEASONS_LESSON', () => {
  it('has exactly 5 chapters in chronological order', () => {
    expect(SEASONS_LESSON.chapters).toHaveLength(5)
    const ids = SEASONS_LESSON.chapters.map((c) => c.id)
    expect(ids).toEqual(['intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice'])
  })

  it('every non-intro chapter\'s defining date falls strictly inside its own dateRange', () => {
    for (const chapter of SEASONS_LESSON.chapters.filter((c) => c.id !== 'intro')) {
      const [start, end] = chapter.dateRange
      const definingDate = chapter.cameraFraming.date
      expect(definingDate.getTime()).toBeGreaterThan(start.getTime())
      expect(definingDate.getTime()).toBeLessThan(end.getTime())
    }
  })

  it('has at least 5 latitude presets including the Equator', () => {
    expect(SEASONS_LESSON.latitudePresets.length).toBeGreaterThanOrEqual(5)
    expect(SEASONS_LESSON.latitudePresets.some((p) => p.id === 'equator')).toBe(true)
  })

  it('every chapter\'s text() returns a non-empty string for the Equator preset at scrubT=0.5', () => {
    const equator = SEASONS_LESSON.latitudePresets.find((p) => p.id === 'equator')!
    for (const chapter of SEASONS_LESSON.chapters) {
      expect(chapter.text(0.5, equator).length).toBeGreaterThan(0)
    }
  })

  it('is registered in LESSONS_BY_ID under "seasons"', () => {
    expect(LESSONS_BY_ID['seasons']).toBe(SEASONS_LESSON)
  })

  it('a latitude preset text override reads sensibly across multiple chapters, not just its own season', () => {
    const tropicOfCancer = SEASONS_LESSON.latitudePresets.find((p) => p.id === 'tropic-of-cancer')!
    const marchChapter = SEASONS_LESSON.chapters.find((c) => c.id === 'march-equinox')!
    const decemberChapter = SEASONS_LESSON.chapters.find((c) => c.id === 'december-solstice')!

    for (const chapter of [marchChapter, decemberChapter]) {
      const text = chapter.text(0.5, tropicOfCancer)
      // Must not read as a June-solstice-only sentence when shown during a different chapter -
      // it should mention both solstices, like the Arctic/Antarctic Circle overrides do.
      expect(text).toContain('June solstice')
      expect(text).toContain('December solstice')
    }
  })
})
