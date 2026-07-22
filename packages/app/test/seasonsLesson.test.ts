import { describe, expect, it } from 'vitest'
import { LESSONS_BY_ID, SEASONS_LESSON } from '../src/learn/lessons/seasons'

describe('SEASONS_LESSON', () => {
  it('has exactly 6 chapters in chronological order (1 continuously-animating real-orbit chapter, then the 5 staged ones)', () => {
    expect(SEASONS_LESSON.chapters).toHaveLength(6)
    const ids = SEASONS_LESSON.chapters.map((c) => c.id)
    expect(ids).toEqual(['orbit', 'intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice'])
  })

  it('the orbit chapter is tagged kind "orbit" and the 5 staged chapters are tagged kind "staged"', () => {
    const stagedIds = ['intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice']
    expect(SEASONS_LESSON.chapters.find((c) => c.id === 'orbit')!.kind).toBe('orbit')
    for (const id of stagedIds) {
      expect(SEASONS_LESSON.chapters.find((c) => c.id === id)!.kind).toBe('staged')
    }
  })

  it('every chapter has a season phase in [0, 360) degrees', () => {
    for (const chapter of SEASONS_LESSON.chapters) {
      expect(chapter.seasonPhaseDegrees).toBeGreaterThanOrEqual(0)
      expect(chapter.seasonPhaseDegrees).toBeLessThan(360)
    }
  })

  it('the four staged solstice/equinox chapters use the four cardinal phases exactly once each', () => {
    const stagedNonIntro = SEASONS_LESSON.chapters.filter((c) => c.kind === 'staged' && c.id !== 'intro')
    const phases = stagedNonIntro.map((c) => c.seasonPhaseDegrees).sort((a, b) => a - b)
    expect(phases).toEqual([0, 90, 180, 270])
  })

  // The orbit chapter's position isn't driven by seasonPhaseDegrees at all (see main.ts's
  // orbitRevolutionDegrees, a continuously incrementing angle) - this test just documents that its
  // seasonPhaseDegrees is present but genuinely unused, not asserting anything about its value.
  it('the orbit chapter has a seasonPhaseDegrees value present (required by the Chapter type) even though it goes unused', () => {
    const orbit = SEASONS_LESSON.chapters.find((c) => c.id === 'orbit')!
    expect(typeof orbit.seasonPhaseDegrees).toBe('number')
  })

  // Intro's own text opens with "Earth's axis is tilted 23.4 degrees" - showing a neutral,
  // equinox-like 0-degree phase here would render a perfectly upright axis, directly contradicting
  // that opening sentence. Intro must show a visible tilt, matching one of the two solstices.
  it('Intro uses a solstice phase, so the picture backs up its own "tilted 23.4 degrees" opening line', () => {
    const intro = SEASONS_LESSON.chapters.find((c) => c.id === 'intro')!
    expect([0, 180]).toContain(intro.seasonPhaseDegrees)
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
