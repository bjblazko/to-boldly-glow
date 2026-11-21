// A plain block alphabet (letters, digits and a little punctuation) for the lettering painted on the
// models and their panels, drawn here so the textures carry
// no font's glyphs and come out the same on every machine. Each letter is an SVG path on a grid 5
// units wide and 7 tall (y down), filled even-odd so the counters stay open.

export const LETTER_GRID = { width: 5, height: 7 } as const

const LETTERS: Record<string, string> = {
  A: 'M0,7 V1.5 L1.5,0 H3.5 L5,1.5 V7 H4 V4.5 H1 V7 H0 Z M1,3.5 H4 V2 L3,1 H2 L1,2 Z',
  B: 'M0,0 H3.5 L5,1.5 V2.5 L4,3.5 L5,4.5 V5.5 L3.5,7 H0 Z M1,1 V3 H3.5 L4,2.5 V1.5 L3.5,1 Z M1,4 V6 H3.5 L4,5.5 V4.5 L3.5,4 Z',
  C: 'M5,0 V1 H1.5 L1,1.5 V5.5 L1.5,6 H5 V7 H1 L0,6 V1 L1,0 Z',
  D: 'M0,0 H3.5 L5,1.5 V5.5 L3.5,7 H0 Z M1,1 V6 H3 L4,5 V2 L3,1 Z',
  E: 'M0,0 H5 V1 H1 V3 H4 V4 H1 V6 H5 V7 H0 Z',
  F: 'M0,0 H5 V1 H1 V3 H4 V4 H1 V7 H0 Z',
  G: 'M5,0 V1 H1.5 L1,1.5 V5.5 L1.5,6 H4 V4.5 H2.5 V3.5 H5 V7 H1 L0,6 V1 L1,0 Z',
  H: 'M0,0 H1 V3 H4 V0 H5 V7 H4 V4 H1 V7 H0 Z',
  I: 'M2,0 H3 V7 H2 Z',
  J: 'M3,0 H4 V6 L3,7 H1 L0,6 V5 H1 V5.5 L1.5,6 H2.5 L3,5.5 Z',
  K: 'M0,0 H1 V3 L4,0 H5 L2,3.5 L5,7 H4 L1,4 V7 H0 Z',
  L: 'M0,0 H1 V6 H5 V7 H0 Z',
  M: 'M0,7 V0 H1 L2.5,2.5 L4,0 H5 V7 H4 V2 L2.5,4.5 L1,2 V7 Z',
  N: 'M0,7 V0 H1.2 L4,5.2 V0 H5 V7 H3.8 L1,1.8 V7 Z',
  O: 'M1,0 H4 L5,1 V6 L4,7 H1 L0,6 V1 Z M1.5,1 L1,1.5 V5.5 L1.5,6 H3.5 L4,5.5 V1.5 L3.5,1 Z',
  P: 'M0,0 H3.5 L5,1.5 V2.5 L3.5,4 H1 V7 H0 Z M1,1 V3 H3 L4,2.2 V1.8 L3,1 Z',
  Q: 'M1,0 H4 L5,1 V5 L4.3,5.7 L5,7 H3.9 L3.6,6.4 L3,7 H1 L0,6 V1 Z M1.5,1 L1,1.5 V5.5 L1.5,6 H3 L4,5 V1.5 L3.5,1 Z',
  R: 'M0,0 H3.5 L5,1.5 V2.5 L3.8,3.7 L5,7 H3.9 L2.8,4 H1 V7 H0 Z M1,1 V3 H3 L4,2.2 V1.8 L3,1 Z',
  S: 'M5,0 V1 H1.5 L1,1.5 V3 H3.5 L5,4.5 V5.5 L3.5,7 H0 V6 H3.5 L4,5.5 V4.5 L3.5,4 H1.5 L0,2.5 V1.5 L1.5,0 Z',
  T: 'M0,0 H5 V1 H3 V7 H2 V1 H0 Z',
  U: 'M0,0 H1 V5.5 L1.5,6 H3.5 L4,5.5 V0 H5 V6 L4,7 H1 L0,6 Z',
  V: 'M0,0 H1 L2.5,5.5 L4,0 H5 L3,7 H2 Z',
  W: 'M0,0 H1 L1.5,5 L2.2,2 H2.8 L3.5,5 L4,0 H5 L4.2,7 H3.3 L2.5,4 L1.7,7 H0.8 Z',
  X: 'M0,0 H1.2 L2.5,2.7 L3.8,0 H5 L3.1,3.5 L5,7 H3.8 L2.5,4.3 L1.2,7 H0 L1.9,3.5 Z',
  Y: 'M0,0 H1.2 L2.5,2.8 L3.8,0 H5 L3,4 V7 H2 V4 Z',
  Z: 'M0,0 H5 V1 L1.3,6 H5 V7 H0 V6 L3.7,1 H0 Z',
  '0': 'M1,0 H4 L5,1 V6 L4,7 H1 L0,6 V1 Z M1.5,1 L1,1.5 V5.5 L1.5,6 H3.5 L4,5.5 V1.5 L3.5,1 Z',
  '1': 'M2,0 H3 V6 H4 V7 H1 V6 H2 V1.5 L1,2 V1 Z',
  '2': 'M0,1 L1,0 H4 L5,1 V3 L1.3,6 H5 V7 H0 V6 L4,2.5 V1.5 L3.5,1 H1.5 L1,1.5 V2 H0 Z',
  '3': 'M0,0 H4 L5,1 V2.8 L4.3,3.5 L5,4.2 V6 L4,7 H0 V6 H3.5 L4,5.5 V4.5 L3.5,4 H1.5 V3 H3.5 L4,2.5 V1.5 L3.5,1 H0 Z',
  '4': 'M3,0 H4.5 V4 H5 V5 H4.5 V7 H3.5 V5 H0 V4 Z M3.5,1.5 L1.2,4 H3.5 Z',
  '5': 'M0,0 H5 V1 H1 V3 H4 L5,4 V6 L4,7 H0 V6 H3.5 L4,5.5 V4.5 L3.5,4 H0 Z',
  '6': 'M4.5,0 V1 H1.5 L1,1.5 V3 H4 L5,4 V6 L4,7 H1 L0,6 V1 L1,0 Z M1,4 V5.5 L1.5,6 H3.5 L4,5.5 V4.5 L3.5,4 Z',
  '7': 'M0,0 H5 V1 L2.2,7 H1 L3.8,1 H0 Z',
  '8': 'M1,0 H4 L5,1 V2.5 L4,3.5 L5,4.5 V6 L4,7 H1 L0,6 V4.5 L1,3.5 L0,2.5 V1 Z M1.5,1 L1,1.5 V2.5 L1.5,3 H3.5 L4,2.5 V1.5 L3.5,1 Z M1.5,4 L1,4.5 V5.5 L1.5,6 H3.5 L4,5.5 V4.5 L3.5,4 Z',
  '9': 'M0.5,7 V6 H3.5 L4,5.5 V4 H1 L0,3 V1 L1,0 H4 L5,1 V6 L4,7 Z M4,3 V1.5 L3.5,1 H1.5 L1,1.5 V2.5 L1.5,3 Z',
  '.': 'M2,6 H3 V7 H2 Z',
  ',': 'M2,6 H3 V7 L2.3,8 H1.8 L2,7 Z',
  '-': 'M1,3 H4 V4 H1 Z',
  '+': 'M2,1.5 H3 V3 H4.5 V4 H3 V5.5 H2 V4 H0.5 V3 H2 Z',
  '/': 'M3.8,0 H5 L1.2,7 H0 Z',
  ':': 'M2,1.5 H3 V2.5 H2 Z M2,4.5 H3 V5.5 H2 Z',
}

// The path of one letter (a space draws nothing).
export function letterPath(letter: string): string {
  if (letter === ' ') return ''
  const path = LETTERS[letter]
  if (!path) throw new Error(`No block letter for "${letter}"`)
  return path
}

// A line of text in block letters as SVG paths, its top-left corner at (left, top), each letter
// `height` tall (a letter's width is 5/7 of that, with a gap of 2/7 between letters).
export function blockText(text: string, { left, top, height, color }: { left: number; top: number; height: number; color: string }): string {
  const scale = height / LETTER_GRID.height
  return [...text].map((letter, index) => {
    const path = letterPath(letter)
    return path ? `<path transform="translate(${left + index * (LETTER_GRID.width + 2) * scale} ${top}) scale(${scale})" d="${path}" fill="${color}" fill-rule="evenodd"/>` : ''
  }).join('')
}

// How wide a line of block text is at that letter height.
export function blockTextWidth(text: string, height: number): number {
  return (text.length * (LETTER_GRID.width + 2) - 2) * (height / LETTER_GRID.height)
}
