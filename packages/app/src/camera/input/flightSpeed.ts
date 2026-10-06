import { vec3 } from 'gl-matrix'
import type { Vec3 } from '../../math/tuples'

// A body the ship can fly to and must not fly into.
export interface Obstacle {
  position: Vec3
  radius: number
}

// Full thrust crosses this share of the distance to the nearest surface per second: slow enough
// to land a close look at a moon, fast enough to cross the Solar System in deep space - the same
// controls work at every scale, Realistic or Compact.
const SPEED_PER_SURFACE_DISTANCE = 0.6
const MIN_SPEED = 1e-4
const MAX_SPEED = 600
// The ship stops this far outside a body's surface (in its radii).
const STANDOFF = 1.04
// The pilot's own speed setting: half-steps of a factor of two, 1/32x to 32x.
export const MAX_SPEED_LEVEL = 10

export function cruiseSpeed(position: Readonly<vec3>, obstacles: readonly Obstacle[], speedLevel: number): number {
  const clearance = obstacles.reduce((nearest, body) => Math.min(nearest, vec3.distance(position, body.position) - body.radius), vec3.length(position))
  const automatic = Math.min(Math.max(clearance * SPEED_PER_SURFACE_DISTANCE, MIN_SPEED), MAX_SPEED)
  return automatic * speedFactor(speedLevel)
}

export function speedFactor(speedLevel: number): number {
  return 2 ** (speedLevel / 2)
}

export function clampSpeedLevel(level: number): number {
  return Math.min(Math.max(Math.round(level), -MAX_SPEED_LEVEL), MAX_SPEED_LEVEL)
}

// Planets are solid: the ship comes to rest against one instead of flying through it, keeping its
// motion along the surface.
export function keepOutside(position: vec3, velocity: vec3, obstacles: readonly Obstacle[]): void {
  for (const body of obstacles) {
    const offset = vec3.subtract(vec3.create(), position, body.position)
    const distance = vec3.length(offset)
    const minimum = body.radius * STANDOFF
    if (distance >= minimum || distance === 0) continue
    const normal = vec3.scale(offset, offset, 1 / distance)
    vec3.scaleAndAdd(position, body.position, normal, minimum)
    const inward = vec3.dot(velocity, normal)
    if (inward < 0) vec3.scaleAndAdd(velocity, velocity, normal, -inward)
  }
}
