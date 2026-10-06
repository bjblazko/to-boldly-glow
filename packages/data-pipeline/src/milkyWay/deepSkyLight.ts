import { equatorialToGalactic, equatorialVector, type UnitVector } from '../skyFrames'
import type { DeepSkyObject } from './deepSky'
import type { Rgb, SkyNoise } from './galaxyLight'
import { fbm, ridged } from './noise'

const RADIANS = Math.PI / 180

// A deep-sky object placed on the galactic sphere, with its own tangent frame for the shape.
export interface PlacedObject {
  object: DeepSkyObject
  center: UnitVector
  // Unit vectors along the object's major and minor axes, tangent to the sky at its center.
  major: UnitVector
  minor: UnitVector
  // Directions farther than this from the center (as a cosine) get none of its light.
  cosExtent: number
  // Noise frequency giving detail about a third of the object's size.
  detail: number
}

export function placeObject(object: DeepSkyObject): PlacedObject {
  const ra = object.raHours * 15 * RADIANS
  const dec = object.decDegrees * RADIANS
  const east = equatorialToGalactic([-Math.sin(ra), Math.cos(ra), 0])
  const north = equatorialToGalactic([-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)])
  const angle = (object.positionAngleDegrees ?? 0) * RADIANS
  const major = combine(north, Math.cos(angle), east, Math.sin(angle))
  const minor = combine(east, Math.cos(angle), north, -Math.sin(angle))
  const reach = object.kind === 'shell' ? 1 + 3 * (object.rimWidth ?? 0.2) : 2.5
  return {
    object,
    center: equatorialToGalactic(equatorialVector(object.raHours, object.decDegrees)),
    major,
    minor,
    cosExtent: Math.cos(Math.min(object.radiusDegrees * reach, 90) * RADIANS),
    detail: 170 / object.radiusDegrees,
  }
}

// Where a direction falls in the object's ellipse: 0 at its center, 1 at its rim (or the edge of
// its glow), and the angle around the center (radians, from the major axis toward the minor).
export function ellipticalRadius(placed: PlacedObject, direction: UnitVector): { radius: number; angle: number } {
  const radiusSine = Math.sin(placed.object.radiusDegrees * RADIANS)
  const along = dot(direction, placed.major) / radiusSine
  const across = dot(direction, placed.minor) / (radiusSine * (placed.object.axisRatio ?? 1))
  return { radius: Math.hypot(along, across), angle: Math.atan2(across, along) }
}

// The object's glow toward this direction (display units), or for a dark cloud its optical depth
// in the first channel.
export function objectLight(placed: PlacedObject, direction: UnitVector, noise: SkyNoise): Rgb | null {
  if (dot(direction, placed.center) < placed.cosExtent) return null
  const { radius, angle } = ellipticalRadius(placed, direction)
  const intensity = placed.object.brightness * profile(placed, radius * outlineWobble(placed, direction, noise), angle) * texture(placed, direction, noise)
  if (intensity <= 0) return null
  const [r, g, b] = placed.object.color
  return [r * intensity, g * intensity, b * intensity]
}

function profile(placed: PlacedObject, radius: number, angle: number): number {
  const { kind, rimWidth = 0.2, arcDirectionDegrees } = placed.object
  if (kind === 'galaxy') return Math.exp(-3.2 * radius ** 0.6) / Math.exp(-3.2 * 0.05 ** 0.6)
  if (kind !== 'shell') return Math.exp(-2.5 * radius * radius)
  const rim = Math.exp(-(((radius - 1) / rimWidth) ** 2))
  if (arcDirectionDegrees === undefined) return rim
  return rim * Math.min(Math.max(0.35 + Math.cos(angle - arcDirectionDegrees * RADIANS), 0), 1)
}

// No cloud of gas is a perfect ellipse or ring: its outline wanders by up to a third of its size.
function outlineWobble(placed: PlacedObject, [x, y, z]: UnitVector, noise: SkyNoise): number {
  const f = placed.detail / 4
  return 1 + 0.3 * fbm(noise.warp, [x * f + 1.3, y * f, z * f], 3)
}

// Gas clouds are clumpy and wispy, shells filamentary, galaxies and reflection nebulae smoother.
function texture(placed: PlacedObject, [x, y, z]: UnitVector, noise: SkyNoise): number {
  const f = placed.detail
  switch (placed.object.kind) {
    case 'shell':
      return Math.max(1.8 * ridged(noise.dust, [x * f, y * f, z * f], 4) ** 3 * (0.3 + fbm(noise.clouds, [x * f * 0.3, y * f * 0.3, z * f * 0.3], 2)), 0)
    case 'emission':
    case 'dark':
      return Math.max(0.5 + 0.9 * fbm(noise.clouds, [x * f, y * f, z * f], 5), 0)
    case 'starCloud':
      return Math.max(0.6 + 0.8 * fbm(noise.clouds, [x * f, y * f, z * f], 4), 0)
    default:
      return Math.max(0.8 + 0.4 * fbm(noise.warp, [x * f, y * f, z * f], 3), 0)
  }
}

function combine(a: UnitVector, wa: number, b: UnitVector, wb: number): UnitVector {
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]
}

function dot(a: UnitVector, b: UnitVector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
