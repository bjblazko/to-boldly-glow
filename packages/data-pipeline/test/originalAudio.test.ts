import { describe, expect, it } from 'vitest'
import { APOLLO11_CLIPS } from '../src/apollo/originalAudio'

describe('the Apollo 11 lesson’s recordings', () => {
  it('come from NASA’s own files only', () => {
    for (const clip of APOLLO11_CLIPS) expect(clip.source).toMatch(/^https:\/\/(www\.nasa\.gov\/|archive\.org\/download\/Apollo11Audio\/)/)
  })

  it('are one per chapter, each a short cut of its source', () => {
    expect(new Set(APOLLO11_CLIPS.map((clip) => clip.chapter)).size).toBe(APOLLO11_CLIPS.length)
    for (const clip of APOLLO11_CLIPS) {
      expect(clip.from).toBeGreaterThanOrEqual(0)
      if (clip.to !== null) expect(clip.to - clip.from).toBeGreaterThan(2)
      if (clip.to !== null) expect(clip.to - clip.from).toBeLessThan(25)
    }
  })
})
