import type { Vec3 } from '../math/tuples'

// How far out from the Sun's center the corona is drawn (solar radii): its streamers reach that far
// in long-exposure eclipse photographs.
export const CORONA_EXTENT_RADII = 8
// From closer than a little beyond the corona's extent, it surrounds the camera: the quad then
// reaches about 87 degrees to every side of the Sun.
const SURROUNDING_HALF_SIZE_PER_DISTANCE = 20

// How bright the corona is next to the visible disc, and in a total eclipse, when the exposure opens
// up for it. The chromosphere and prominences show only in an eclipse.
const CORONA_GAIN_BESIDE_DISC = 0.05
const CORONA_GAIN_IN_ECLIPSE = 0.9
const HYDROGEN_GAIN_IN_ECLIPSE = 4

// The quad the corona is drawn on: through the Sun's center, square to the line of sight.
export interface CoronaQuad {
  // Half-axes in world units.
  axisU: Vec3
  axisV: Vec3
  lineOfSight: Vec3
  // The camera's distance from the Sun's center, in solar radii.
  distanceRadii: number
}

export function coronaQuad(sun: { position: ArrayLike<number>; radius: number }, camera: ArrayLike<number>): CoronaQuad {
  const toSun: Vec3 = [sun.position[0] - camera[0], sun.position[1] - camera[1], sun.position[2] - camera[2]]
  const distance = Math.hypot(...toSun)
  const lineOfSight = toSun.map((value) => value / distance) as Vec3
  const distanceRadii = distance / sun.radius
  const halfSize = quadHalfSizeRadii(distanceRadii) * sun.radius
  const reference: Vec3 = Math.abs(lineOfSight[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
  const u = normalize(cross(lineOfSight, reference))
  const v = cross(u, lineOfSight)
  return { axisU: scale(u, halfSize), axisV: scale(v, halfSize), lineOfSight, distanceRadii }
}

// A line of sight through a point ρ from the Sun's center in the quad's plane passes the center at
// b = ρd / √(d² + ρ²) (d: the camera's distance), so reaching the corona's extent E takes
// ρ = Ed / √(d² − E²).
export function quadHalfSizeRadii(distanceRadii: number): number {
  const d = distanceRadii
  const extent = CORONA_EXTENT_RADII
  if (d <= extent * 1.05) return SURROUNDING_HALF_SIZE_PER_DISTANCE * d
  return (extent * d) / Math.sqrt(d * d - extent * extent)
}

// The corona's and the hydrogen glow's brightness, from how much of the Sun's disc is still in view
// (1 = all of it) and how far the camera has stopped down for a Sun that fills the picture (the
// Sun's close-up brightness over its usual one). Only once the last sliver of the disc is gone does
// the exposure open up.
export function coronaExposure(sunVisibleFraction: number, stopDown: number): { corona: number; hydrogen: number } {
  const totality = smoothstep(0.85, 0.995, 1 - sunVisibleFraction)
  const corona = CORONA_GAIN_BESIDE_DISC + (CORONA_GAIN_IN_ECLIPSE - CORONA_GAIN_BESIDE_DISC) * totality
  return { corona: corona * stopDown, hydrogen: HYDROGEN_GAIN_IN_ECLIPSE * totality * stopDown }
}

// Where a direction from the Sun's center (world) shows up in the sky: its part across the line of
// sight, as a unit vector, and that part's length - 1 for a direction along the limb, 0 for one
// pointing at the camera or away from it.
export function seenAcross(direction: Vec3, lineOfSight: Vec3): [number, number, number, number] {
  const along = direction[0] * lineOfSight[0] + direction[1] * lineOfSight[1] + direction[2] * lineOfSight[2]
  const across: Vec3 = [direction[0] - along * lineOfSight[0], direction[1] - along * lineOfSight[1], direction[2] - along * lineOfSight[2]]
  const length = Math.hypot(...across)
  if (length < 1e-6) return [0, 0, 0, 0]
  return [across[0] / length, across[1] / length, across[2] / length, length]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalize(a: Vec3): Vec3 {
  const length = Math.hypot(...a)
  return scale(a, 1 / length)
}

function scale(a: Vec3, factor: number): Vec3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor]
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
