import type { UnitVector } from '../skyFrames'
import { fbm, ridged, type Noise3 } from './noise'

export type Rgb = [number, number, number]

// The noise fields the painting is built from - separate seeds, so star clouds, dust and grain
// don't line up with each other.
export interface SkyNoise {
  clouds: Noise3
  warp: Noise3
  dust: Noise3
  grain: Noise3
}

const DEGREES = 180 / Math.PI
// How bright the painting is overall: enough to read as the Milky Way at a glance, faint enough to
// stay behind the planets.
const BRIGHTNESS = 2.2
const WARM: Rgb = [1, 0.84, 0.64]
const COOL: Rgb = [0.78, 0.86, 1]

// The Milky Way's light toward a galactic-frame direction, before any dust: a thin, clumpy disk of
// star clouds, brightest and thickest toward the galactic center in Sagittarius, where the old,
// yellowish stars of the bulge add their glow; younger, bluer starlight elsewhere. In display
// units (sRGB 0..1).
export function starlight(direction: UnitVector, noise: SkyNoise): Rgb {
  const longitude = Math.atan2(direction[1], direction[0]) * DEGREES
  const latitude = Math.asin(direction[2]) * DEGREES
  const center = Math.exp(-((longitude / 55) ** 2))
  const amplitude = BRIGHTNESS * (0.06 + 0.13 * center + 0.05 * bump(longitude, 75, 22) + 0.05 * bump(longitude, -75, 25))
  const height = 4.5 + 3 * center
  const disk = amplitude * (0.75 * Math.exp(-((latitude / height) ** 2)) + 0.25 * Math.exp(-Math.abs(latitude) / (height * 2)))
  const bulge = BRIGHTNESS * (0.22 * Math.exp(-((longitude / 9) ** 2 + (latitude / 6.5) ** 2)) + 0.06 * Math.exp(-Math.sqrt((longitude / 14) ** 2 + (latitude / 10) ** 2)))
  if (disk + bulge < 0.002) return [0, 0, 0]

  const light = (disk + bulge * 0.8) * starClouds(direction, noise) + bulge * 0.2 + disk * grain(direction, noise.grain)
  const warmth = Math.min(center * 0.7 + bulge * 3, 1)
  return [0, 1, 2].map((channel) => light * (COOL[channel] + (WARM[channel] - COOL[channel]) * warmth)) as Rgb
}

// How much dust dims the light toward this direction (optical depth): dark lanes along the
// galactic plane, thickest in the Great Rift that splits the Milky Way from Cygnus to Sagittarius,
// torn into filaments.
export function dustDepth(direction: UnitVector, noise: SkyNoise): number {
  const longitude = Math.atan2(direction[1], direction[0]) * DEGREES
  const latitude = Math.asin(direction[2]) * DEGREES
  const center = Math.exp(-((longitude / 55) ** 2))
  const midplane = 0.8 * Math.sin(longitude / 9) + 0.5 * Math.sin(longitude / 23 + 1)
  const width = 2.5 + 2 * center
  const profile = Math.exp(-(((latitude - midplane) / width) ** 2)) + 0.3 * Math.exp(-(((latitude - midplane) / (width * 3)) ** 2))
  if (profile < 0.01) return 0

  const rift = 0.6 + 1.2 * bump(longitude, 30, 50)
  const [x, y, z] = direction
  const clouds = Math.max(fbm(noise.dust, [x * 9, y * 9 + 7.7, z * 9], 5) * 1.8 + 0.15, 0) ** 1.5
  const filaments = ridged(noise.dust, [x * 20 + 3.1, y * 20, z * 20], 4) ** 4
  return profile * rift * (0.2 + 2.2 * clouds + 0.8 * filaments * clouds)
}

// Light dimmed by dust, the blue more than the red: dust reddens what shines through it.
export function throughDust(light: Rgb, depth: number): Rgb {
  return [light[0] * Math.exp(-depth * 0.75), light[1] * Math.exp(-depth), light[2] * Math.exp(-depth * 1.35)]
}

// Clumpy star clouds: domain-warped fractal noise, around 0.25 (thin stretches) to 1.75 (dense
// clouds) times the smooth disk's light.
function starClouds([x, y, z]: UnitVector, noise: SkyNoise): number {
  const warpX = fbm(noise.warp, [x * 4, y * 4, z * 4], 3)
  const warpY = fbm(noise.warp, [x * 4 + 5.2, y * 4, z * 4], 3)
  const warpZ = fbm(noise.warp, [x * 4, y * 4 + 9.4, z * 4], 3)
  const clouds = fbm(noise.clouds, [x * 10 + warpX, y * 10 + warpY, z * 10 + warpZ], 6)
  const density = Math.min(Math.max(0.5 + 0.6 * clouds, 0), 1)
  return 0.25 + 1.5 * density * density
}

// Unresolved stars: a fine speckle over the disk.
function grain([x, y, z]: UnitVector, noise: Noise3): number {
  const speckle = Math.max(noise.at(x * 900, y * 900, z * 900), 0)
  return 2.2 * speckle ** 3
}

function bump(longitude: number, centerDegrees: number, widthDegrees: number): number {
  const offset = ((longitude - centerDegrees + 540) % 360) - 180
  return Math.exp(-((offset / widthDegrees) ** 2))
}
