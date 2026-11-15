import { mat4, vec3 } from 'gl-matrix'
import type { Vec3 } from '../math/tuples'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'

// Turns a spacecraft model (its dish along +Y) so the dish points along `toSun`: a deep-space probe
// keeps its antenna on Earth, which from out there is nearly the Sun's direction.
export function dishTowardSun(toSun: Vec3): mat4 {
  const y = vec3.normalize(vec3.create(), toSun)
  const reference: Vec3 = Math.abs(y[2]) > 0.95 ? [1, 0, 0] : [...ECLIPTIC_NORTH]
  const x = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), y, reference))
  const z = vec3.cross(vec3.create(), x, y)
  return mat4.fromValues(x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1)
}
