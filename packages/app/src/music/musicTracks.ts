// The background music: three lo-fi tracks, played live by a small synthesizer in the browser
// (musicEngine.ts) - no recordings. Each track is a key, a loop of four chords and a groove; the
// composer varies the rest from bar to bar.

export const MUSIC_TRACK_IDS = ['drift', 'nova', 'pixel'] as const
export type MusicTrackId = (typeof MUSIC_TRACK_IDS)[number]

export interface MusicChord {
  // The keys' voicing, as MIDI notes, around middle C.
  keys: number[]
  // The bass's root, as a MIDI note.
  bass: number
}

export interface MusicTrack {
  id: MusicTrackId
  name: string
  bpm: number
  // How late every second sixteenth comes, as a share of a sixteenth.
  swing: number
  // One chord per bar, looped.
  chords: MusicChord[]
  // The 8-bit lead's notes, as MIDI.
  scale: number[]
  // Sixteen steps each: 'x' a hit, 'o' a ghost note that sometimes sounds, '.' a rest.
  drums: { kick: string; snare: string; hat: string }
  // Where the bass plays in a bar, in sixteenths; the first is the root, the others root or fifth.
  bassSteps: number[]
  bassWave: OscillatorType
  // How the chords sound: a slow, soft pad; an electric piano; or 8-bit pulse stabs.
  keys: 'pad' | 'piano' | 'chip'
  // Short chords struck at these sixteenths instead of one held for the bar.
  stabSteps?: number[]
  // The 8-bit lead: how often it plays a note on an eighth, and whether it arpeggiates the chord.
  lead: { density: number; arpeggio: boolean; duty: number }
  // Hi-hats from the 8-bit noise channel rather than plain noise.
  chipHats: boolean
  // The whole mix's low-pass, in Hz: lower is warmer and duller.
  cutoff: number
  // The low-pass slowly opening and closing over eight bars.
  sweep?: boolean
}

export const MUSIC_TRACKS: Record<MusicTrackId, MusicTrack> = {
  // Slow and dreamy, in C major: soft pads, a sparse beat, and the lead rarely speaks.
  drift: {
    id: 'drift',
    name: 'Drift',
    bpm: 66,
    swing: 0.2,
    chords: [
      { keys: [57, 60, 64, 67], bass: 41 }, // Fmaj9
      { keys: [55, 59, 62, 64], bass: 40 }, // Em7
      { keys: [53, 57, 60, 64], bass: 38 }, // Dm9
      { keys: [52, 55, 59, 62], bass: 36 }, // Cmaj9
    ],
    scale: [72, 74, 76, 79, 81, 84],
    drums: { kick: 'x.........x.....', snare: '............x...', hat: '..o.x.o...o.x.o.' },
    bassSteps: [0, 10],
    bassWave: 'sine',
    keys: 'pad',
    lead: { density: 0.14, arpeggio: false, duty: 0.25 },
    chipHats: false,
    cutoff: 2600,
  },
  // Lo-fi house, in F minor: a four-on-the-floor kick, off-beat hats and bass, short electric-piano
  // stabs, and a filter slowly opening and closing over eight bars.
  nova: {
    id: 'nova',
    name: 'Nova',
    bpm: 112,
    swing: 0.08,
    chords: [
      { keys: [56, 60, 63, 67], bass: 41 }, // Fm9
      { keys: [55, 58, 62, 65], bass: 39 }, // Ebmaj9
      { keys: [53, 56, 60, 63], bass: 37 }, // Db9
      { keys: [55, 58, 60, 63], bass: 36 }, // Cm7
    ],
    scale: [77, 80, 82, 84, 87, 89],
    drums: { kick: 'x...x...x...x...', snare: '....x.......x..o', hat: '..x...x...x...xo' },
    bassSteps: [2, 6, 10, 14],
    bassWave: 'sine',
    keys: 'piano',
    stabSteps: [3, 6, 11, 14],
    lead: { density: 0.12, arpeggio: false, duty: 0.5 },
    chipHats: false,
    cutoff: 3600,
    sweep: true,
  },
  // The most 8-bit and the quickest: pulse-wave chords, a square bass, noise-channel hats and
  // arpeggios, in E minor.
  pixel: {
    id: 'pixel',
    name: 'Pixel',
    bpm: 92,
    swing: 0.12,
    chords: [
      { keys: [55, 59, 62, 66], bass: 40 }, // Em9
      { keys: [55, 59, 60, 64], bass: 36 }, // Cmaj7
      { keys: [57, 60, 64, 67], bass: 45 }, // Am7
      { keys: [54, 57, 59, 62], bass: 47 }, // Bm7
    ],
    scale: [76, 79, 81, 83, 86, 88],
    drums: { kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xo' },
    bassSteps: [0, 6, 10],
    bassWave: 'square',
    keys: 'chip',
    lead: { density: 0.2, arpeggio: true, duty: 0.125 },
    chipHats: true,
    cutoff: 3800,
  },
}
