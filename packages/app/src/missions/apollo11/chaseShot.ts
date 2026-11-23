import type { Vec3 } from '../../math/tuples'
import type { Motion } from './apollo11Scene'

// The tour's first, plain camera: behind the craft along its way, a little above it, a normal lens.
// (The film's shots and their director come next: plan 2026-11-23, task 7.)

export interface Framing {
  // Relative to the scene's origin (km).
  eyeKm: Vec3
  lookKm: Vec3
  up: Vec3
  // Vertical field of view (radians).
  fov: number
}

const CHASE_M = { distance: 34, breathe: 12 }
// The camera drifts round the craft (degrees a second) and in and out, so the picture never stands.
const DRIFT_DEGREES_PER_SECOND = 5
const BREATHE_SECONDS = 23
// A 50 mm lens on 35 mm film: 2 atan(12 / 50).
export const NORMAL_FOV = 2 * Math.atan(12 / 50)

const unit = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

// `seconds`: the tour's own time, for the drift.
export function chaseShot(craftKm: Vec3, motion: Motion, seconds = 0): Framing {
  const forward = unit(motion.velocity)
  const up = motion.up
  const side = unit([forward[1] * up[2] - forward[2] * up[1], forward[2] * up[0] - forward[0] * up[2], forward[0] * up[1] - forward[1] * up[0]])
  const turn = (DRIFT_DEGREES_PER_SECOND * seconds * Math.PI) / 180
  const rise = 0.35 + 0.25 * Math.sin(seconds / 17)
  const distance = CHASE_M.distance + CHASE_M.breathe * Math.sin((2 * Math.PI * seconds) / BREATHE_SECONDS)
  const around = [0, 1, 2].map((k) => -forward[k] * Math.cos(turn) + side[k] * Math.sin(turn))
  const direction = unit(around.map((value, k) => value * Math.cos(rise) + up[k] * Math.sin(rise)) as Vec3)
  const eyeKm = craftKm.map((value, k) => value + (direction[k] * distance) / 1000) as Vec3
  return { eyeKm, lookKm: craftKm, up, fov: NORMAL_FOV }
}

// The orbit camera's zoom floor (scene units) for a camera this far from the nearest ground (km):
// the world's near plane (4% of the floor, see camera/viewpoint.ts) then lies a third of the way
// there - as far out as it can, for the depth buffer's sake (the craft have a pass of their own).
export function worldFloorUnits(groundKm: number): number {
  return (Math.max(0.001, groundKm) / 1000) * 7.5
}
