import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { equatorialToScene, equatorialVector } from './skyFrames'

// x, y, z (the star's direction in the app's ecliptic scene frame), visual magnitude, B−V color index.
export const FLOATS_PER_STAR = 5

// Typical B−V color index of each spectral class (main sequence), for the few hundred stars the
// catalog lists without a measured B−V.
const SPECTRAL_CLASS_COLOR_INDEX: Readonly<Record<string, number>> = { O: -0.32, B: -0.16, A: 0.15, F: 0.45, G: 0.68, K: 1.15, M: 1.6 }
const SUN_LIKE_COLOR_INDEX = 0.65

export interface BscStar {
  raHours: number
  decDeg: number
  vmag: number
  colorIndex: number
}

// Parses one fixed-width record from the Yale Bright Star Catalogue (BSC5, CDS V/50 ASCII
// edition — see packages/data-pipeline/data/ReadMe for the full byte-by-byte column layout): the
// J2000 RA/Dec (bytes 76-90), Vmag (bytes 103-107), B−V (bytes 110-114) and, where B−V is
// missing, the spectral type (bytes 128-147). Returns null for the ~14 legacy
// nova/extragalactic entries that carry no position/magnitude data (see the catalog's ReadMe), so
// callers can filter them out of the star field.
export function parseBscLine(line: string): BscStar | null {
  if (line.length < 107) return null
  const raDecField = line.slice(75, 90)
  const raH = Number(raDecField.slice(0, 2))
  const raM = Number(raDecField.slice(2, 4))
  const raS = Number(raDecField.slice(4, 8))
  const sign = raDecField[8] === '-' ? -1 : 1
  const decD = Number(raDecField.slice(9, 11))
  const decM = Number(raDecField.slice(11, 13))
  const decS = Number(raDecField.slice(13, 15))
  const vmag = Number(line.slice(102, 107))
  if ([raH, raM, raS, decD, decM, decS, vmag].some((value) => Number.isNaN(value))) return null

  return {
    raHours: raH + raM / 60 + raS / 3600,
    decDeg: sign * (decD + decM / 60 + decS / 3600),
    vmag,
    colorIndex: colorIndexOf(line),
  }
}

function colorIndexOf(line: string): number {
  const field = line.slice(109, 114).trim()
  if (field !== '') return Number(field)
  const spectralClass = line.slice(127, 147).trim()[0] ?? ''
  return SPECTRAL_CLASS_COLOR_INDEX[spectralClass] ?? SUN_LIKE_COLOR_INDEX
}

// Converts the raw catalog into a flat Float32Array of FLOATS_PER_STAR floats per star. How bright
// and in which color a star is drawn is the app's business (see starfield/starAppearance.ts).
export function convertCatalog(catalogText: string): Float32Array {
  const stars = catalogText
    .split('\n')
    .map(parseBscLine)
    .filter((star): star is BscStar => star !== null)

  const buffer = new Float32Array(stars.length * FLOATS_PER_STAR)
  stars.forEach((star, i) => {
    const direction = equatorialToScene(equatorialVector(star.raHours, star.decDeg))
    buffer.set([...direction, star.vmag, star.colorIndex], i * FLOATS_PER_STAR)
  })
  return buffer
}

// Only run the conversion when executed directly (`npm run convert`), not when imported for tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url))
  const catalogPath = join(here, '../data/bsc5.dat')
  const outputPath = join(here, '../../app/public/stars/starCatalog.bin')

  const buffer = convertCatalog(readFileSync(catalogPath, 'utf-8'))
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength))

  console.log(`Wrote ${buffer.length / FLOATS_PER_STAR} stars to ${outputPath}`)
}
