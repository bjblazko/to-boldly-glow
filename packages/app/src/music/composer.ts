import type { MusicTrack } from './musicTracks'

export const STEPS_PER_BAR = 16
// The first bar of the full groove.
export const GROOVE_BAR = 4

export type DrumKind = 'kick' | 'snare' | 'hat'

// One note, at a sixteenth of its bar; `steps` long where a length matters.
export type MusicEvent =
  | { kind: DrumKind; step: number; velocity: number }
  | { kind: 'keys'; step: number; steps: number; notes: number[]; velocity: number }
  | { kind: 'bass' | 'sub' | 'lead'; step: number; steps: number; note: number; velocity: number }

// A track's shape over time: two bars of keys alone, two more with bass and hats, then the full
// groove (where a track taking over from another starts, so it is heard for itself at once) - which, every sixteen bars, drops its drums for two, and lets the 8-bit lead answer the
// keys only every other four bars.
type Section = 'intro' | 'build' | 'groove' | 'break'

const PHRASE_BARS = 16
const GHOST_CHANCE = 0.35
const RESTRIKE_CHANCE = 0.4
const FIFTH = 7

// Writes a track bar by bar, from its chords and groove, with a little chance in every bar.
export class Composer {
  private leadIndex = 2

  constructor(
    private readonly track: MusicTrack,
    private readonly random: () => number = Math.random,
  ) {}

  bar(index: number): MusicEvent[] {
    const section = sectionOf(index)
    const chord = this.track.chords[index % this.track.chords.length]
    const events: MusicEvent[] = this.keys(chord.keys)
    if (section !== 'intro' && section !== 'break') events.push(...this.bass(chord.bass))
    if (section === 'groove') events.push(...this.sub(chord.bass))
    if (section !== 'intro') events.push(...this.drums(section))
    if (section !== 'intro' && index % 8 >= 4) events.push(...this.lead(chord.keys))
    return events
  }

  private keys(notes: number[]): MusicEvent[] {
    const { stabSteps } = this.track
    if (stabSteps) return stabSteps.map((step, i) => ({ kind: 'keys' as const, step, steps: 2, notes, velocity: (i === 0 ? 0.9 : 0.7) + 0.1 * this.random() }))
    const events: MusicEvent[] = [{ kind: 'keys', step: 0, steps: STEPS_PER_BAR, notes, velocity: 0.8 + 0.2 * this.random() }]
    if (this.random() < RESTRIKE_CHANCE) events.push({ kind: 'keys', step: 10, steps: 6, notes: notes.slice(1), velocity: 0.45 })
    return events
  }

  private bass(root: number): MusicEvent[] {
    const { bassSteps } = this.track
    return bassSteps.map((step, i) => ({
      kind: 'bass' as const,
      step,
      // Held up to just before the next note, and no longer than six sixteenths.
      steps: Math.min(6, (bassSteps[i + 1] ?? STEPS_PER_BAR) - step - 1),
      note: i > 0 && this.random() < 0.4 ? root + FIFTH : root,
      velocity: i === 0 ? 1 : 0.75,
    }))
  }

  // An octave under the bass, kept above an organ's lowest pipes (C1).
  private sub(root: number): MusicEvent[] {
    const note = root - 12 >= 24 ? root - 12 : root
    return (this.track.subSteps ?? []).map((step, i) => ({ kind: 'sub' as const, step, steps: 6, note, velocity: i === 0 ? 1 : 0.8 }))
  }

  private drums(section: Section): MusicEvent[] {
    const { kick, snare, hat } = this.track.drums
    if (section === 'break') return []
    const kinds: [DrumKind, string][] = section === 'groove' ? [['kick', kick], ['snare', snare], ['hat', hat]] : [['hat', hat]]
    return kinds.flatMap(([kind, pattern]) => this.hits(kind, pattern))
  }

  private hits(kind: DrumKind, pattern: string): MusicEvent[] {
    const events: MusicEvent[] = []
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      const mark = pattern[step]
      if (mark === 'x') events.push({ kind, step, velocity: step === 0 ? 1 : 0.8 + 0.15 * this.random() })
      else if (mark === 'o' && this.random() < GHOST_CHANCE) events.push({ kind, step, velocity: 0.35 + 0.2 * this.random() })
    }
    return events
  }

  private lead(chord: number[]): MusicEvent[] {
    const { density, arpeggio } = this.track.lead
    if (arpeggio && this.random() < 0.5) return this.arpeggio(chord)
    const events: MusicEvent[] = []
    for (let step = 0; step < STEPS_PER_BAR; step += 2) {
      if (this.random() >= density) continue
      this.leadIndex = this.walk(this.leadIndex)
      events.push({ kind: 'lead', step, steps: 1 + Math.floor(this.random() * 3), note: this.track.scale[this.leadIndex], velocity: 0.6 + 0.4 * this.random() })
    }
    return events
  }

  // The chord's notes two octaves up, rising on every sixteenth - softly, in the background.
  private arpeggio(chord: number[]): MusicEvent[] {
    return Array.from({ length: STEPS_PER_BAR }, (_, step) => ({ kind: 'lead' as const, step, steps: 1, note: chord[step % chord.length] + 24, velocity: step % 4 === 0 ? 0.55 : 0.35 }))
  }

  // A step or two up or down the scale, staying on it.
  private walk(index: number): number {
    const move = Math.round((this.random() - 0.5) * 4)
    return Math.min(this.track.scale.length - 1, Math.max(0, index + move))
  }
}

function sectionOf(bar: number): Section {
  if (bar < 2) return 'intro'
  if (bar < GROOVE_BAR) return 'build'
  return bar % PHRASE_BARS >= PHRASE_BARS - 2 ? 'break' : 'groove'
}
