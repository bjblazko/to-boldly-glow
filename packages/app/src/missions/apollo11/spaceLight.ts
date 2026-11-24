import type { Vec3 } from '../../math/tuples'

// Light on a craft in space: the Sun, unless a body is in the way (craftPass.ts's sunlit), almost
// no fill - space has nothing to scatter light - and the light the nearest sunlit body throws back:
// as strong as its albedo times how big it looks times how much of its day side faces the craft,
// in its colour (Earth's blue-white, the Moon's grey).

export interface BodyLight {
  centreKm: Vec3
  radiusKm: number
  albedo: number
  color: Vec3
}

export const EARTH_LIGHT = { radiusKm: 6378, albedo: 0.3, color: [0.62, 0.76, 1] as Vec3 }
export const MOON_LIGHT = { radiusKm: 1737.4, albedo: 0.12, color: [1, 0.96, 0.9] as Vec3 }
// The shadowed side's floor: starlight and the camera's own exposure.
export const SPACE_FILL = 0.012

export interface Bounce {
  direction: Vec3
  strength: number
  color: Vec3
  cosRadius: number
}

export function bounceFrom(craftKm: Vec3, bodies: BodyLight[], toSun: Vec3): Bounce | null {
  let best: Bounce | null = null
  for (const body of bodies) {
    const d: Vec3 = [body.centreKm[0] - craftKm[0], body.centreKm[1] - craftKm[1], body.centreKm[2] - craftKm[2]]
    const distance = Math.hypot(...d)
    if (distance <= body.radiusKm) continue
    const direction: Vec3 = [d[0] / distance, d[1] / distance, d[2] / distance]
    // The day side seen from the craft: all of it with the Sun behind the craft, none with the
    // body between the craft and the Sun.
    const day = (1 - (direction[0] * toSun[0] + direction[1] * toSun[1] + direction[2] * toSun[2])) / 2
    const size = (body.radiusKm / distance) ** 2
    const strength = body.albedo * size * day * 1.6
    if (!best || strength > best.strength) best = { direction, strength, color: body.color, cosRadius: Math.sqrt(1 - Math.min(1, (body.radiusKm / distance) ** 2)) }
  }
  return best
}
