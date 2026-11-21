import { paletteTexture, type Rgb } from './palette'

// The flat colours of what we add to NASSP's lunar module (lmNasspModel.ts): the cutaway's tanks
// and engines, and the person for scale.

export const LM_SWATCHES = ['engine', 'oxidizer', 'fuel', 'person'] as const
export type LmSwatch = (typeof LM_SWATCHES)[number]
export const LM_PALETTE_TEXTURE = 'lm-palette.png'

const SWATCH_COLORS: Record<LmSwatch, Rgb> = {
  engine: [58, 56, 54],
  oxidizer: [170, 80, 50], // nitrogen tetroxide, reddish brown
  fuel: [220, 200, 110], // Aerozine 50
  person: [235, 120, 40], // the figure for scale
}

export function lmPalette(): Promise<Buffer> {
  return paletteTexture(LM_SWATCHES.map((name) => SWATCH_COLORS[name]))
}
