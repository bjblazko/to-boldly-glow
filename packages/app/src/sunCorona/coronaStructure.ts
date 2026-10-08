import type { Vec3 } from '../math/tuples'
import { seededRandom, type Random } from '../math/seededRandom'

const DEGREES = Math.PI / 180

// A helmet streamer: where it leaves the Sun (a unit direction in the Sun's own frame, +Z along its
// spin axis), how bright it is, how wide (relative), how far out it reaches (the solar radii over
// which its stalk fades), and how much it bends sideways (radians, by four solar radii out).
export interface Streamer {
  direction: Vec3
  strength: number
  width: number
  length: number
  bend: number
}

// A prominence: where on the Sun it stands, how high it reaches and how wide it is (solar radii).
export interface Prominence {
  direction: Vec3
  height: number
  width: number
}

export const STREAMER_COUNT = 10
export const PROMINENCE_COUNT = 8

// Streamers leave the Sun at this latitude at most: a year or two after the 2025 solar maximum they
// still stand out at nearly every latitude; only around the poles, where coronal holes open up,
// the corona stays faint.
export const MAX_STREAMER_LATITUDE_DEGREES = 65
// Prominences rise from the active belts, up to this latitude.
export const MAX_PROMINENCE_LATITUDE_DEGREES = 50

// The corona's large-scale structure, the same on every visit. It is fixed to the Sun, so it turns
// with the Sun's rotation.
export function coronaStructure(seed = 2026): { streamers: Streamer[]; prominences: Prominence[] } {
  const random = seededRandom(seed)
  // Spread evenly around the Sun, alternating between its hemispheres, so they surround it from
  // every side.
  const streamers = Array.from({ length: STREAMER_COUNT }, (_, index) => ({
    direction: directionAt(
      (index % 2 === 0 ? 1 : -1) * Math.abs(randomLatitude(random, MAX_STREAMER_LATITUDE_DEGREES)),
      ((index + 0.2 + 0.6 * random()) / STREAMER_COUNT) * 360,
    ),
    strength: 0.4 + random(),
    width: 0.6 + 0.9 * random(),
    length: 1.5 + 4.5 * random(),
    bend: 0.3 * (random() - 0.5),
  }))
  // Prominences reach 20,000-100,000 km above the surface (0.03-0.15 solar radii).
  const prominences = Array.from({ length: PROMINENCE_COUNT }, () => ({
    direction: directionAt(randomLatitude(random, MAX_PROMINENCE_LATITUDE_DEGREES), random() * 360),
    height: 0.03 + random() * 0.12,
    width: 0.015 + random() * 0.035,
  }))
  return { streamers, prominences }
}

// A WGSL module-scope array of vec4s, for a shader to loop over.
export function wgslVec4Array(name: string, rows: readonly (readonly number[])[]): string {
  const values = rows.map((row) => `vec4f(${row.map((value) => value.toFixed(5)).join(', ')})`)
  return `var<private> ${name}: array<vec4f, ${rows.length}> = array<vec4f, ${rows.length}>(${values.join(', ')});`
}

function randomLatitude(random: Random, maxDegrees: number): number {
  const sign = random() < 0.5 ? -1 : 1
  return sign * (5 + (maxDegrees - 5) * random() ** 1.3)
}

function directionAt(latitudeDegrees: number, longitudeDegrees: number): Vec3 {
  const latitude = latitudeDegrees * DEGREES
  const longitude = longitudeDegrees * DEGREES
  return [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)]
}
