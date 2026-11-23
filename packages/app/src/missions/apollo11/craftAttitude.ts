import { mat4, quat, vec3 } from 'gl-matrix'
import type { Vec3 } from '../../math/tuples'

// Which way Columbia and Eagle point (their models' +Y: Columbia's nose, Eagle's roof), as a
// rotation from the model's frame to the scene's (ecliptic). The burns as flown: TLI and TEI
// forward, LOI and DOI braking (the engine forward), Eagle's descent engine-first until it pitches
// up near the ground, upright on it, the ascent climbing off upward and tipping forward. Between
// burns the attitudes are plausible, not documented (APPROX): forward in orbit, the passive thermal
// control roll on the coasts (the long axis across the ecliptic, about 0.3 degrees a second),
// Eagle's roof to Columbia for the rendezvous. Changes of attitude take two minutes.

const T = (hours: number, minutes: number, seconds = 0) => hours * 3600 + minutes * 60 + seconds
const TURN_SECONDS = 120
const PTC_DEGREES_PER_SECOND = 0.3
const NORTH: Vec3 = [0, 0, 1]

export interface Kinematics {
  get: number
  // Relative to the body flown round (Earth, or the Moon there), km/s; and straight up from it.
  velocity: Vec3
  up: Vec3
  // Toward the other craft, when both fly apart.
  toOther: Vec3 | null
  altitudeKm?: number
}

type Rule = (k: Kinematics) => quat

const unit = (v: ArrayLike<number>): vec3 => vec3.normalize(vec3.create(), v as vec3)

// The rotation whose +Y is `axis`, its +Z as near `toward` as can be.
function pointing(axis: ArrayLike<number>, toward: ArrayLike<number>): quat {
  const y = unit(axis)
  let x = vec3.cross(vec3.create(), y, toward as vec3)
  if (vec3.length(x) < 1e-6) x = vec3.cross(vec3.create(), y, Math.abs(y[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])
  vec3.normalize(x, x)
  const z = vec3.cross(vec3.create(), x, y)
  const m = mat4.fromValues(x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1)
  return quat.normalize(quat.create(), mat4.getRotation(quat.create(), m))
}

const forward: Rule = (k) => pointing(k.velocity, k.up)
const backward: Rule = (k) => pointing(vec3.negate(vec3.create(), k.velocity), k.up)
const ptc: Rule = (k) => {
  const base = pointing(NORTH, [1, 0, 0])
  return quat.multiply(quat.create(), base, quat.setAxisAngle(quat.create(), [0, 1, 0], ((PTC_DEGREES_PER_SECOND * k.get) % 360) * (Math.PI / 180)))
}

// Columbia: (from GET, rule).
const COLUMBIA: [number, Rule][] = [
  [0, forward],
  [T(5, 0), ptc],
  [T(75, 41), backward],
  [T(76, 0), forward],
  [T(135, 13), forward],
  [T(136, 0), ptc],
  [T(194, 30), forward],
]

const blend = (t: number) => t * t * (3 - 2 * t)

function attitude(rules: [number, Rule][], k: Kinematics): mat4 {
  const i = rules.reduce((found, [from], index) => (k.get >= from ? index : found), 0)
  let q = rules[i][1](k)
  const into = (k.get - rules[i][0]) / TURN_SECONDS
  if (i > 0 && into < 1) q = quat.slerp(quat.create(), rules[i - 1][1](k), q, blend(Math.max(0, into)))
  return mat4.fromQuat(mat4.create(), q)
}

export function columbiaAttitude(k: Kinematics): mat4 {
  return attitude(COLUMBIA, k)
}

// Eagle: engine-first while braking high up, rising to upright below about 2.5 km; upright on the
// ground; climbing, tipping toward its way along; then its roof to Columbia.
const descending: Rule = (k) => {
  const w = blend(Math.min(1, Math.max(0, (2.5 - (k.altitudeKm ?? 100)) / 2.4)))
  const braking = vec3.negate(vec3.create(), unit(k.velocity))
  return pointing(vec3.lerp(vec3.create(), braking, k.up, w), k.velocity)
}
const upright: Rule = (k) => pointing(k.up, k.velocity)
const climbing: Rule = (k) => {
  const w = 0.85 * blend(Math.min(1, Math.max(0, (k.get - T(124, 22, 10)) / 60)))
  return pointing(vec3.lerp(vec3.create(), k.up, unit(k.velocity), w), k.velocity)
}
const toColumbia: Rule = (k) => pointing(k.toOther ?? k.up, k.up)

const EAGLE: [number, Rule][] = [
  [0, descending],
  [T(102, 45, 40), upright],
  [T(124, 22, 0.79), climbing],
  [T(124, 40), toColumbia],
]

export function eagleAttitude(k: Kinematics): mat4 {
  return attitude(EAGLE, k)
}
