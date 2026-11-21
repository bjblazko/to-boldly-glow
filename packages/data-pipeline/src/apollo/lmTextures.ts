import sharp from 'sharp'
import { blockText, blockTextWidth } from './blockLetters'
import { paletteTexture, type Rgb } from './palette'

// Eagle's look, drawn here: the crinkled foil wrapped round the descent stage (and parts of the
// ascent stage), the flat paint of the rest as a palette, the flag with "UNITED STATES", and the
// plaque on the ladder leg - its words only, without the signatures. No NASA insignia.

const FOIL_SIZE = 2048

export type FoilTint = 'gold' | 'amber' | 'black' | 'silver'

const FOIL_COLORS: Record<FoilTint, Rgb> = {
  gold: [222, 172, 72], // the Kapton's outer layer, gold in sunlight
  amber: [176, 112, 42], // darker, thicker Kapton
  black: [44, 42, 40], // the black H-film
  silver: [196, 198, 204], // aluminized Mylar
}

export const LM_FOIL_TEXTURES: Record<FoilTint, string> = {
  gold: 'lm-foil-gold.jpg',
  amber: 'lm-foil-amber.jpg',
  black: 'lm-foil-black.jpg',
  silver: 'lm-foil-silver.jpg',
}

// A small, seeded random generator (mulberry32), so the foil comes out the same every build.
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Crumpled foil: flat facets, each tilted its own way, with sharp creases where they meet - the
// cells of a Voronoi pattern (one random point per grid cell, tiling across the image's edges), at
// three sizes, the small facets tilting less.
interface Facets {
  cells: number
  points: Float32Array // x, y per cell (0 to 1 within it)
  tilts: Float32Array // dx, dy per cell
}

function facets(cells: number, tilt: number, next: () => number): Facets {
  const points = Float32Array.from({ length: cells * cells * 2 }, next)
  const tilts = Float32Array.from({ length: cells * cells * 2 }, () => (next() * 2 - 1) * tilt)
  return { cells, points, tilts }
}

// The tilt of the facet a point (0 to 1) falls in: the nearest cell point's.
function tiltAt({ cells, points, tilts }: Facets, x: number, y: number): [number, number] {
  const [gx, gy] = [x * cells, y * cells]
  const [i, j] = [Math.floor(gx), Math.floor(gy)]
  let [best, nearest] = [Infinity, 0]
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const cell = (((j + dj + cells) % cells) * cells + ((i + di + cells) % cells)) * 2
      const distance = (i + di + points[cell] - gx) ** 2 + (j + dj + points[cell + 1] - gy) ** 2
      if (distance < best) [best, nearest] = [distance, cell]
    }
  }
  return [tilts[nearest], tilts[nearest + 1]]
}

// Each pixel's slope (dx, dy): the big facets' tilt plus the small ones'.
function crinkles(seed: number): Float32Array {
  const next = random(seed)
  const layers = [facets(8, 0.6, next), facets(22, 0.22, next), facets(60, 0.07, next)]
  const slopes = new Float32Array(FOIL_SIZE * FOIL_SIZE * 2)
  for (let y = 0; y < FOIL_SIZE; y++) {
    for (let x = 0; x < FOIL_SIZE; x++) {
      let [dx, dy] = [0, 0]
      for (const layer of layers) {
        const [tx, ty] = tiltAt(layer, x / FOIL_SIZE, y / FOIL_SIZE)
        dx += tx
        dy += ty
      }
      slopes.set([dx, dy], (y * FOIL_SIZE + x) * 2)
    }
  }
  return slopes
}

// Lit from the upper left: a diffuse shade and a sharp, metallic glint on the facets turned to it.
function shadeFoil(slopes: Float32Array, [r, g, b]: Rgb): Buffer {
  const pixels = Buffer.alloc(FOIL_SIZE * FOIL_SIZE * 3)
  const light = [-0.4, -0.5, 0.77]
  for (let p = 0; p < FOIL_SIZE * FOIL_SIZE; p++) {
    const [dx, dy] = [slopes[p * 2], slopes[p * 2 + 1]]
    const facing = (-dx * light[0] - dy * light[1] + light[2]) / Math.hypot(dx, dy, 1)
    const glint = Math.pow(Math.max(0, facing), 40) * 0.6
    const shade = 0.55 + 0.5 * Math.max(0, facing)
    pixels[p * 3] = Math.min(255, r * shade + 255 * glint)
    pixels[p * 3 + 1] = Math.min(255, g * shade + 240 * glint)
    pixels[p * 3 + 2] = Math.min(255, b * shade + 210 * glint)
  }
  return pixels
}

export function foilTexture(seed: number, tint: FoilTint): Promise<Buffer> {
  const pixels = shadeFoil(crinkles(seed), FOIL_COLORS[tint])
  return sharp(pixels, { raw: { width: FOIL_SIZE, height: FOIL_SIZE, channels: 3 } }).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}

// The flat-painted parts: one swatch each (see palette.ts).
export const LM_SWATCHES = ['ascent', 'ascentDark', 'black', 'engine', 'nozzle', 'oxidizer', 'fuel', 'strut', 'steel', 'glass', 'person', 'dish'] as const
export type LmSwatch = (typeof LM_SWATCHES)[number]
export const LM_PALETTE_TEXTURE = 'lm-palette.png'

const SWATCH_COLORS: Record<LmSwatch, Rgb> = {
  ascent: [170, 172, 170], // the ascent stage's grey-anodized panels
  ascentDark: [72, 74, 76], // its dark grey ones
  black: [26, 26, 28], // black paint (the RCS plume deflectors, the window frames)
  engine: [58, 56, 54],
  nozzle: [150, 140, 128], // the descent engine's bare nozzle extension
  oxidizer: [170, 80, 50], // nitrogen tetroxide, reddish brown
  fuel: [220, 200, 110], // Aerozine 50
  strut: [214, 176, 80], // the gold-wrapped struts
  steel: [205, 205, 200], // the plaque, the ladder
  glass: [24, 28, 36], // the windows, dark from outside
  person: [235, 120, 40], // the figure for scale
  dish: [228, 228, 222], // the antennas' white dishes
}

export function lmPalette(): Promise<Buffer> {
  return paletteTexture(LM_SWATCHES.map((name) => SWATCH_COLORS[name]))
}

// The plaque's words (the crew's and the President's signatures are left off).
export const PLAQUE_TEXT = ['HERE MEN FROM THE PLANET EARTH', 'FIRST SET FOOT UPON THE MOON', 'JULY 1969, A.D.', 'WE CAME IN PEACE FOR ALL MANKIND']

const PLAQUE = { width: 1024, height: 820 }

function centredLine(text: string, top: number, height: number, color: string): string {
  return blockText(text, { left: (PLAQUE.width - blockTextWidth(text, height)) / 2, top, height, color })
}

// Two hemispheres as outlines above the words, on brushed steel with a dark rim.
function plaqueSvg(): string {
  const ink = '#2a2a2a'
  const globes = [PLAQUE.width / 2 - 170, PLAQUE.width / 2 + 170].map((cx) => `<circle cx="${cx}" cy="215" r="150" fill="none" stroke="${ink}" stroke-width="7"/>`).join('')
  const lines = PLAQUE_TEXT.map((text, index) => centredLine(text, 450 + index * 70, 26, ink)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PLAQUE.width}" height="${PLAQUE.height}"><rect width="100%" height="100%" fill="#c9c9c4"/><rect x="14" y="14" width="${PLAQUE.width - 28}" height="${PLAQUE.height - 28}" fill="none" stroke="${ink}" stroke-width="6"/>${globes}${lines}</svg>`
}

export function plaqueTexture(): Promise<Buffer> {
  return sharp(Buffer.from(plaqueSvg())).jpeg({ quality: 90, mozjpeg: true }).toBuffer()
}

const DECAL = { width: 512, height: 1024 }

// The flag (13 stripes, a plain canton) above "UNITED" and "STATES", for the descent stage's front.
function decalSvg(): string {
  const [left, top, width, height] = [56, 60, 400, 260]
  const stripes = Array.from({ length: 13 }, (_, index) => `<rect x="${left}" y="${top + (index * height) / 13}" width="${width}" height="${height / 13 + 0.5}" fill="${index % 2 ? '#f1f0ec' : '#b22234'}"/>`)
  const canton = `<rect x="${left}" y="${top}" width="${width * 0.4}" height="${(height * 7) / 13}" fill="#3c3b6e"/>`
  const words = ['UNITED', 'STATES'].map((word, index) => blockText(word, { left: (DECAL.width - blockTextWidth(word, 64)) / 2, top: 420 + index * 110, height: 64, color: '#141414' })).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DECAL.width}" height="${DECAL.height}">${stripes.join('')}${canton}${words}</svg>`
}

// The decal over a piece of gold foil.
export async function flagLettering(): Promise<Buffer> {
  const foil = await sharp(await foilTexture(7, 'gold')).extract({ left: 0, top: 0, width: DECAL.width, height: DECAL.height }).toBuffer()
  return sharp(foil).composite([{ input: Buffer.from(decalSvg()) }]).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}
