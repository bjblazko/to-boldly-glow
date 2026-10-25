import { describe, expect, it } from 'vitest'
import { Composer, STEPS_PER_BAR, type MusicEvent } from '../src/music/composer'
import { midiToHz } from '../src/music/instruments'
import { MUSIC_TRACK_IDS, MUSIC_TRACKS } from '../src/music/musicTracks'

// The same "chance" every run.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

const kinds = (events: MusicEvent[]) => new Set(events.map((event) => event.kind))

describe.each(MUSIC_TRACK_IDS)('the composer, playing %s', (id) => {
  const track = MUSIC_TRACKS[id]
  const bars = (count: number) => {
    const composer = new Composer(track, seeded(7))
    return Array.from({ length: count }, (_, bar) => composer.bar(bar))
  }

  it('opens with the keys alone, then brings in bass and hats, then the whole groove', () => {
    const [first, second, third, , fifth] = bars(5)
    expect(kinds(first)).toEqual(new Set(['keys']))
    expect(kinds(second)).toEqual(new Set(['keys']))
    expect(kinds(third)).toEqual(new Set(['keys', 'bass', 'hat']))
    expect([...kinds(fifth)]).toEqual(expect.arrayContaining(['keys', 'bass', 'kick', 'snare', 'hat']))
  })

  it('plays the kick where the groove has one, on every bar of the groove', () => {
    const hits = [...track.drums.kick].flatMap((mark, step) => (mark === 'x' ? [step] : []))
    for (const bar of bars(14).slice(4)) {
      expect(bar.filter((event) => event.kind === 'kick').map((event) => event.step)).toEqual(expect.arrayContaining(hits))
    }
  })

  it('drops the drums for the last two bars of every sixteen', () => {
    const song = bars(32)
    for (const bar of [14, 15, 30, 31]) expect([...kinds(song[bar])].filter((kind) => ['kick', 'snare', 'hat'].includes(kind))).toEqual([])
  })

  it('keeps every note inside its bar, and the lead on its scale or the chord', () => {
    const song = bars(64)
    song.forEach((bar, index) => {
      const chord = track.chords[index % track.chords.length].keys.map((note) => note + 24)
      for (const event of bar) {
        expect(event.step).toBeGreaterThanOrEqual(0)
        expect(event.step).toBeLessThan(STEPS_PER_BAR)
        if (event.kind === 'lead') expect([...track.scale, ...chord]).toContain(event.note)
      }
    })
    expect(song.flat().some((event) => event.kind === 'lead')).toBe(true)
  })
})

it('tunes A above middle C to 440 Hz', () => {
  expect(midiToHz(69)).toBe(440)
  expect(midiToHz(81)).toBe(880)
})
