import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOURS_TO_RADIANS = (15 * Math.PI) / 180
const DEGREES_TO_RADIANS = Math.PI / 180

const MIN_VMAG = -1.46 // Sirius, the brightest star in the catalog
const MAX_VMAG = 6.5 // conventional naked-eye visibility limit
const MIN_BRIGHTNESS = 0.05
const MAX_BRIGHTNESS = 1.0

// Converts an equatorial direction (RA in hours, Dec in degrees) to a unit vector. Dec maps to
// the Y (up) axis and RA sweeps around it, mirroring how latitude/longitude parametrize
// generateSphereMesh (packages/app/src/geometry/sphere.ts) — the star field is a decorative
// direction-only skybox, not an orientation-accurate planetarium, so this convention is a
// deliberate simplification rather than a true celestial-to-world transform.
export function raDecToUnitVector(raHours: number, decDeg: number): [number, number, number] {
  const ra = raHours * HOURS_TO_RADIANS
  const dec = decDeg * DEGREES_TO_RADIANS
  const cosDec = Math.cos(dec)
  return [cosDec * Math.cos(ra), Math.sin(dec), cosDec * Math.sin(ra)]
}

// Maps visual magnitude (lower = brighter) to a [MIN_BRIGHTNESS, MAX_BRIGHTNESS] render weight,
// clamped to the catalog's actual magnitude range (brightest star to the naked-eye limit).
export function magnitudeToBrightness(vmag: number): number {
  const clamped = Math.min(Math.max(vmag, MIN_VMAG), MAX_VMAG)
  const t = (clamped - MIN_VMAG) / (MAX_VMAG - MIN_VMAG)
  return MAX_BRIGHTNESS - t * (MAX_BRIGHTNESS - MIN_BRIGHTNESS)
}

export interface BscStar {
  raHours: number
  decDeg: number
  vmag: number
}

// Parses one fixed-width record from the Yale Bright Star Catalogue (BSC5, CDS V/50 ASCII
// edition — see packages/data-pipeline/data/ReadMe for the full byte-by-byte column layout).
// Only the J2000 RA/Dec (bytes 76-90) and Vmag (bytes 103-107) fields are needed here. Returns
// null for the ~14 legacy nova/extragalactic entries that carry no position/magnitude data (see
// the catalog's ReadMe), so callers can filter them out of the star field.
export function parseBscLine(line: string): BscStar | null {
  if (line.length < 107) return null
  const raDecField = line.slice(75, 90)
  const vmagField = line.slice(102, 107)

  const raH = Number(raDecField.slice(0, 2))
  const raM = Number(raDecField.slice(2, 4))
  const raS = Number(raDecField.slice(4, 8))
  const sign = raDecField[8] === '-' ? -1 : 1
  const decD = Number(raDecField.slice(9, 11))
  const decM = Number(raDecField.slice(11, 13))
  const decS = Number(raDecField.slice(13, 15))
  const vmag = Number(vmagField)

  if ([raH, raM, raS, decD, decM, decS, vmag].some((value) => Number.isNaN(value))) return null

  return {
    raHours: raH + raM / 60 + raS / 3600,
    decDeg: sign * (decD + decM / 60 + decS / 3600),
    vmag,
  }
}

// Converts the raw catalog into a flat (x, y, z, brightness) Float32Array, one star per 4 floats,
// and writes it to outputPath. Returns the number of stars written.
export function convertCatalog(catalogText: string): Float32Array {
  const stars = catalogText
    .split('\n')
    .map(parseBscLine)
    .filter((star): star is BscStar => star !== null)

  const buffer = new Float32Array(stars.length * 4)
  stars.forEach((star, i) => {
    const [x, y, z] = raDecToUnitVector(star.raHours, star.decDeg)
    buffer.set([x, y, z, magnitudeToBrightness(star.vmag)], i * 4)
  })
  return buffer
}

// Only run the conversion when executed directly (`npm run convert`), not when imported for tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url))
  const catalogPath = join(here, '../data/bsc5.dat')
  const outputPath = join(here, '../../app/public/stars/starCatalog.bin')

  const catalogText = readFileSync(catalogPath, 'utf-8')
  const buffer = convertCatalog(catalogText)

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength))

  console.log(`Wrote ${buffer.length / 4} stars to ${outputPath}`)
}
