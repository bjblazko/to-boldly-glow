// A plain block alphabet for the lettering painted on the models, drawn here so the textures carry
// no font's glyphs and come out the same on every machine. Each letter is an SVG path on a grid 5
// units wide and 7 tall (y down), filled even-odd so the counters stay open.

export const LETTER_GRID = { width: 5, height: 7 } as const

const LETTERS: Record<string, string> = {
  A: 'M0,7 V1.5 L1.5,0 H3.5 L5,1.5 V7 H4 V4.5 H1 V7 Z M1,3.5 H4 V2 L3,1 H2 L1,2 Z',
  D: 'M0,0 H3.5 L5,1.5 V5.5 L3.5,7 H0 Z M1,1 V6 H3 L4,5 V2 L3,1 Z',
  E: 'M0,0 H5 V1 H1 V3 H4 V4 H1 V6 H5 V7 H0 Z',
  I: 'M2,0 H3 V7 H2 Z',
  N: 'M0,7 V0 H1.2 L4,5.2 V0 H5 V7 H3.8 L1,1.8 V7 Z',
  S: 'M5,0 V1 H1.5 L1,1.5 V3 H3.5 L5,4.5 V5.5 L3.5,7 H0 V6 H3.5 L4,5.5 V4.5 L3.5,4 H1.5 L0,2.5 V1.5 L1.5,0 Z',
  T: 'M0,0 H5 V1 H3 V7 H2 V1 H0 Z',
  U: 'M0,0 H1 V5.5 L1.5,6 H3.5 L4,5.5 V0 H5 V6 L4,7 H1 L0,6 Z',
}

// The path of one letter (a space draws nothing).
export function letterPath(letter: string): string {
  if (letter === ' ') return ''
  const path = LETTERS[letter]
  if (!path) throw new Error(`No block letter for "${letter}"`)
  return path
}
