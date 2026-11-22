import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GRAND_TOUR } from '../src/camera/tour/grandTour'
import { Narrator, type ClipPlayer, type NarrationClip } from '../src/narration/narrator'
import { NARRATION_SCRIPTS } from '../src/narration/narrationSegments'
import { cueAt, subtitleCues } from '../src/narration/subtitles'

// Plays a clip until the test ends it.
class FakePlayer implements ClipPlayer {
  playing: { clip: NarrationClip; onEnded: () => void } | null = null
  played: string[] = []
  prefetch?: (clip: NarrationClip) => void
  play(clip: NarrationClip, onEnded: () => void): void {
    this.playing = { clip, onEnded }
    this.played.push(clip.text)
  }
  elapsed(): number {
    return 0
  }
  stop(): void {
    this.playing = null
  }
  paused = false
  pause(): void {
    this.paused = true
  }
  resume(): void {
    this.paused = false
  }
  end(): void {
    const playing = this.playing
    this.playing = null
    playing?.onEnded()
  }
}

const clipFor = (stop: string, part: string): NarrationClip => ({ text: `${stop} ${part}`, seconds: stop === 'sun' ? 20 : 10, url: null })

function narrator() {
  const player = new FakePlayer()
  const shown: (string | null)[] = []
  return { player, shown, narrator: new Narrator(clipFor, player, { show: (text) => shown.push(text) }) }
}

describe('the narrator', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('paces each leg by what there is to say about its stop', () => {
    const { narrator: guide } = narrator()
    expect(guide.pace()).toEqual({ transitSeconds: 23, lapSeconds: 26 })
    guide.onLegStart()
    expect(guide.pace()).toEqual({ transitSeconds: 13, lapSeconds: 16 })
  })

  it('fetches the clips of the stop ahead and of the one after it as each leg is planned', () => {
    const { player, narrator: guide } = narrator()
    const fetched: string[] = []
    player.prefetch = (clip) => fetched.push(clip.text)
    guide.pace()
    expect(fetched).toEqual(['sun approach', 'sun orbit', 'mercury approach', 'mercury orbit'])
  })

  it('speaks the approach when the ship says it is near, then the rest while circling - one after the other', () => {
    const { player, narrator: guide } = narrator()
    guide.onLegStart()
    expect(player.played).toEqual([])
    guide.onApproach()
    guide.onLoopEnter()
    expect(player.played).toEqual(['sun approach'])
    player.end()
    expect(player.played).toEqual(['sun approach', 'sun orbit'])
  })

  it('holds the ship at a stop until it has finished speaking about it', () => {
    const { player, narrator: guide } = narrator()
    guide.onLegStart()
    guide.onApproach()
    player.end()
    guide.onLoopEnter()
    expect(guide.mayDepart()).toBe(false)
    player.end()
    expect(guide.mayDepart()).toBe(true)
    guide.onLegStart()
    guide.onApproach()
    expect(player.played.at(-1)).toBe('mercury approach')
    expect(guide.mayDepart()).toBe(false)
  })

  it('skips to another stop: falls silent, then speaks of that stop as the ship heads there', () => {
    const { player, narrator: guide } = narrator()
    guide.onLegStart()
    guide.onApproach()
    expect(guide.stopIndex).toBe(0)
    guide.seek(5)
    expect(player.playing).toBeNull()
    guide.onLegStart()
    expect(guide.stopIndex).toBe(5)
    guide.onApproach()
    expect(player.played.at(-1)).toBe('jupiter approach')
    guide.seek(0)
    guide.onLegStart()
    guide.onApproach()
    expect(player.played.at(-1)).toBe('sun approach')
  })

  it('holds its voice while the tour is paused', () => {
    const { player, narrator: guide } = narrator()
    guide.onLegStart()
    guide.onApproach()
    guide.setPaused(true)
    expect(player.paused).toBe(true)
    guide.setPaused(false)
    expect(player.paused).toBe(false)
  })

  it('goes quiet when the tour stops', () => {
    const { player, shown, narrator: guide } = narrator()
    guide.onLegStart()
    guide.onApproach()
    guide.stop()
    expect(player.playing).toBeNull()
    expect(shown.at(-1)).toBeNull()
  })
})

describe('the grand tour', () => {
  it('has words in every language for every stop', () => {
    for (const script of Object.values(NARRATION_SCRIPTS)) {
      for (const { stop } of GRAND_TOUR) expect(script[stop].approach.length * script[stop].orbit.length).toBeGreaterThan(0)
    }
  })
})

describe('subtitles', () => {
  const text = NARRATION_SCRIPTS.de.venus.orbit

  it('split sentences at their end, not at a decimal point', () => {
    expect(subtitleCues('It holds 99.8 percent of the mass. More than a million Earths would fit inside it.', 10).map((cue) => cue.text)).toEqual([
      'It holds 99.8 percent of the mass.',
      'More than a million Earths would fit inside it.',
    ])
  })

  it('cover the whole text, in order, short enough to read, across the clip', () => {
    const cues = subtitleCues(text, 30)
    expect(cues.map((cue) => cue.text).join(' ')).toBe(text.replace(/\s+/g, ' '))
    for (const cue of cues) expect(cue.text.length).toBeLessThanOrEqual(110)
    expect(cues[0].from).toBe(0)
    expect(cues.at(-1)!.to).toBeCloseTo(30, 6)
  })

  it('show the piece being spoken, and nothing after the clip', () => {
    const cues = subtitleCues(text, 30)
    expect(cueAt(cues, 0)).toBe(cues[0])
    expect(cueAt(cues, 29.9)).toBe(cues.at(-1))
    expect(cueAt(cues, 31)).toBeNull()
  })
})
