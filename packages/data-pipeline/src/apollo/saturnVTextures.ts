import sharp from 'sharp'
import { SWATCHES } from './saturnVParts'
import { LETTER_GRID, letterPath } from './blockLetters'
import { HEIGHTS, SIVB_INTERSTAGE, STAGE_RADIUS, TANKS, TOTAL_HEIGHT } from './saturnVProfile'

// The Saturn V's paint, drawn from its layout: white, the black-and-white roll pattern on the
// S-IC's base, intertank and forward skirt and on the S-IVB's aft end, "UNITED STATES" down the
// S-IC with the flag above it. No NASA insignia (see docs/asset-sources.md). One image wraps once
// around the rocket (x) and runs from the nose (top) to the base (y). A plain approximation of the
// photos, not a copy of any of them.

const WIDTH = 1024
const HEIGHT = 4096
const BLACK = '#141414'
const WHITE = '#f1f0ec'

// Where the lettering and the flag sit across the image (the second quarter's middle).
const LETTERING_AROUND = 0.375

const y = (height: number) => (1 - height / TOTAL_HEIGHT) * HEIGHT
const metresAround = (radius: number) => WIDTH / (2 * Math.PI * radius)

// Two opposite quarters black between two heights: the first and third. The second (with the
// lettering, on the model's -X/-Z side) and the fourth (the quarter the cutaway opens) stay white.
function rollPattern(from: number, to: number): string {
  const quarter = WIDTH / 4
  const top = y(to)
  const height = y(from) - top
  return [0, 2].map((index) => `<rect x="${index * quarter}" y="${top}" width="${quarter}" height="${height}" fill="${BLACK}"/>`).join('')
}

function band(from: number, to: number, color: string): string {
  return `<rect x="0" y="${y(to)}" width="${WIDTH}" height="${y(from) - y(to)}" fill="${color}"/>`
}

// "UNITED STATES" letter under letter, in the middle of the second quarter, in our own block letters
// (blockLetters.ts): each letter 1.1 m tall and 0.7 m wide on the S-IC, a line every 1.4 m.
function lettering(top: number, radius: number): string {
  const [lineMetres, letterHeight, letterWidth] = [1.4, 1.1, 0.7]
  const scaleX = (letterWidth * metresAround(radius)) / LETTER_GRID.width
  const scaleY = (letterHeight * (HEIGHT / TOTAL_HEIGHT)) / LETTER_GRID.height
  const left = WIDTH * LETTERING_AROUND - (LETTER_GRID.width * scaleX) / 2
  return [...'UNITED STATES'].map((letter, index) => {
    const path = letterPath(letter)
    if (!path) return ''
    const upper = y(top - index * lineMetres)
    return `<path transform="translate(${left} ${upper}) scale(${scaleX} ${scaleY})" d="${path}" fill="${BLACK}" fill-rule="evenodd"/>`
  }).join('')
}

// The flag, 3 m by 2 m, above the lettering (13 stripes, a plain blue canton - too small for stars).
function flag(top: number, radius: number): string {
  const width = 3 * metresAround(radius)
  const height = 2 * (HEIGHT / TOTAL_HEIGHT)
  const [left, upper] = [WIDTH * LETTERING_AROUND - width / 2, y(top)]
  const stripes = Array.from({ length: 13 }, (_, index) => `<rect x="${left}" y="${upper + (index * height) / 13}" width="${width}" height="${height / 13}" fill="${index % 2 ? WHITE : '#b22234'}"/>`)
  return stripes.join('') + `<rect x="${left}" y="${upper}" width="${width * 0.4}" height="${(height * 7) / 13}" fill="#3c3b6e"/>`
}

function paintSvg(): string {
  const sicTop = HEIGHTS.sicTop
  const loxTop = TANKS.sicLox.top
  const parts = [
    band(0, TOTAL_HEIGHT, WHITE),
    rollPattern(0, 9.1), // the S-IC's thrust structure
    rollPattern(TANKS.sicFuel.top, TANKS.sicLox.bottom), // its intertank
    rollPattern(loxTop + 1.5, sicTop), // its forward skirt
    rollPattern(HEIGHTS.siiTop + SIVB_INTERSTAGE, HEIGHTS.siiTop + 7.3), // the S-IVB's aft skirt
    band(HEIGHTS.iuTop, HEIGHTS.slaTop, '#d8d4c8'), // the SLA's cork-covered panels
    band(HEIGHTS.slaTop, HEIGHTS.smTop, '#c9cbcc'), // the service module's aluminium
    band(HEIGHTS.cmTop + 2.2, TOTAL_HEIGHT - 2.4, WHITE), // the escape motor
    band(TOTAL_HEIGHT - 2.4, TOTAL_HEIGHT - 1.9, BLACK),
    flag(loxTop - 0.5, STAGE_RADIUS),
    lettering(loxTop - 3.0, STAGE_RADIUS),
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${parts.join('')}</svg>`
}

export function paintTexture(): Promise<Buffer> {
  return sharp(Buffer.from(paintSvg())).flatten({ background: WHITE }).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}

// One flat swatch per material, in SWATCHES' order.
const SWATCH_COLORS: Record<(typeof SWATCHES)[number], [number, number, number]> = {
  engine: [52, 50, 48], // the engines' dark bells
  lox: [120, 170, 225], // liquid oxygen, pale blue
  rp1: [205, 150, 70], // kerosene (RP-1)
  lh2: [200, 225, 240], // liquid hydrogen
  tunnel: [150, 160, 170], // the LOX ducts
  gold: [200, 160, 60], // the LM's foil
  person: [235, 120, 40], // the figure for scale, easy to spot
  tower: [190, 60, 40], // the escape tower's truss
}

const SWATCH_SIZE = 8

export function paletteTexture(): Promise<Buffer> {
  const width = SWATCHES.length * SWATCH_SIZE
  const pixels = Buffer.alloc(width * SWATCH_SIZE * 3)
  for (let x = 0; x < width; x++) {
    const color = SWATCH_COLORS[SWATCHES[Math.floor(x / SWATCH_SIZE)]]
    for (let row = 0; row < SWATCH_SIZE; row++) pixels.set(color, (row * width + x) * 3)
  }
  return sharp(pixels, { raw: { width, height: SWATCH_SIZE, channels: 3 } }).png().toBuffer()
}
