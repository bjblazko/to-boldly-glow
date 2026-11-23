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

const CHASE_M = { back: 28, above: 9, side: 6 }
// A 50 mm lens on 35 mm film: 2 atan(12 / 50).
export const NORMAL_FOV = 2 * Math.atan(12 / 50)

const unit = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

export function chaseShot(craftKm: Vec3, motion: Motion): Framing {
  const forward = unit(motion.velocity)
  const up = motion.up
  const side = unit([forward[1] * up[2] - forward[2] * up[1], forward[2] * up[0] - forward[0] * up[2], forward[0] * up[1] - forward[1] * up[0]])
  const eyeKm = craftKm.map((value, k) => value + (-forward[k] * CHASE_M.back + up[k] * CHASE_M.above + side[k] * CHASE_M.side) / 1000) as Vec3
  return { eyeKm, lookKm: craftKm, up, fov: NORMAL_FOV }
}

// The orbit camera's zoom floor (scene units) for a shot: no more than the camera's distance to
// what it looks at (it would push the camera back), and small enough that the near plane (4% of
// it, see camera/viewpoint.ts) stays a tenth of the way to the nearest ground.
export function nearFloorUnits(lookDistanceUnits: number, groundKm: number): number {
  return Math.min(lookDistanceUnits, (groundKm / 1000) * 2.5) * 0.999
}
