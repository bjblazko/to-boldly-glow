import { mat4, vec3 } from 'gl-matrix'
import type { Vec3 } from '../../math/tuples'
import type { Framing } from './chaseShot'

// The tour's shots: what a camera does for a few seconds. Lenses as on 35 mm film (vertical field
// of view 2 atan(12 / f)). Kinds:
// - orbit: a camera beside the craft in its orbit's frame (along its way, up, aside) - standing
//   still there (a fixed camera: the craft hangs in the picture) or drifting slowly round it;
// - body: far off, a long lens or a wide one, the craft small, Earth, the Moon or the Sun behind it;
// - hull: a wide lens right against the hull, the hull itself in the foreground;
// - detail: a close-up of a part (an engine bell, the docking probe, a footpad);
// - ground: a camera standing on the Moon near Tranquility Base;
// - watch: from one craft at the other (the rendezvous, the undocking).

export const LENSES = { ultraWide: 14, wide: 24, normal: 50, tele: 200, longTele: 800 } as const
export type Lens = keyof typeof LENSES

export function lensFov(lens: Lens): number {
  return 2 * Math.atan(12 / LENSES[lens])
}

export type ShotSpec =
  | { kind: 'orbit'; lens: Lens; distance: number; azimuth: number; elevation: number; drift?: number }
  // aside: where the body sits, a share of half the picture's height off the middle (0.5 if not given).
  | { kind: 'body'; lens: Lens; body: 'earth' | 'moon' | 'sun'; share: number; aside?: number }
  | { kind: 'hull'; lens: Lens; eye: Vec3; look: Vec3 }
  | { kind: 'detail'; lens: Lens; point: Vec3; distance: number; azimuth: number; elevation: number }
  | { kind: 'ground'; lens: Lens; east: number; north: number; height: number }
  | { kind: 'watch'; lens: Lens; from: Vec3 }

// What a shot needs to know at a moment (km relative to the scene's origin).
export interface ShotContext {
  // Tour seconds into the shot.
  seconds: number
  subjectKm: Vec3
  // The subject's attitude: its model frame to the scene's (rotation).
  turn: mat4
  velocity: Vec3
  up: Vec3
  // The subject's size (m): what a share of the picture is measured by; and its middle (m, model
  // frame) - what the camera aims at.
  size: number
  centre: Vec3
  earthKm: Vec3
  moonKm: Vec3
  toSun: Vec3
  // The other craft (the watching one, for a watch shot), the landing site and its up, if any.
  otherKm: Vec3 | null
  otherTurn: mat4 | null
  siteKm: Vec3 | null
  siteUp: Vec3 | null
  // The ground's height (m over the site's level) a way east and north of the site, if known.
  groundAt?: (east: number, north: number) => number | null
}

const DEG = Math.PI / 180
const unit = (v: ArrayLike<number>): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}
const add = (a: Vec3, b: Vec3, scale = 1): Vec3 => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

// A direction in the craft's orbit frame: azimuth from straight behind (degrees, toward its side),
// elevation above its way (degrees).
function orbitDirection(c: ShotContext, azimuth: number, elevation: number): Vec3 {
  const forward = unit(c.velocity)
  const side = unit(cross(forward, c.up))
  const up = unit(cross(side, forward))
  const [a, e] = [azimuth * DEG, elevation * DEG]
  return unit([0, 1, 2].map((k) => (-forward[k] * Math.cos(a) + side[k] * Math.sin(a)) * Math.cos(e) + up[k] * Math.sin(e)))
}

// A point of the subject's model (m) in the scene (km from the origin).
function modelPoint(c: ShotContext, point: Vec3, turn = c.turn, at = c.subjectKm): Vec3 {
  const turned = vec3.transformMat4(vec3.create(), point, turn)
  return add(at, [turned[0], turned[1], turned[2]], 1 / 1000)
}

const at = (eyeKm: Vec3, lookKm: Vec3, up: Vec3, lens: Lens): Framing => ({ eyeKm, lookKm, up, fov: lensFov(lens) })
const aim = (c: ShotContext): Vec3 => modelPoint(c, c.centre)

// A camera beside the craft sees it lit from the side, a little from behind - not from its dark
// side: of the shot's azimuth and the one opposite, the one whose view has the Sun nearer to 60
// degrees off it.
function litDirection(c: ShotContext, azimuth: number, elevation: number): Vec3 {
  const [a, b] = [orbitDirection(c, azimuth, elevation), orbitDirection(c, azimuth + 180, elevation)]
  const off = (d: Vec3) => Math.abs(d[0] * c.toSun[0] + d[1] * c.toSun[1] + d[2] * c.toSun[2] - 0.5)
  return off(a) <= off(b) ? a : b
}

const FRAMINGS: { [K in ShotSpec['kind']]: (spec: Extract<ShotSpec, { kind: K }>, c: ShotContext) => Framing } = {
  orbit: (spec, c) => {
    const direction = litDirection(c, spec.azimuth + (spec.drift ?? 0) * c.seconds, spec.elevation)
    return at(add(aim(c), direction, spec.distance / 1000), aim(c), c.up, spec.lens)
  },
  body: (spec, c) => {
    const middle = aim(c)
    const target = spec.body === 'sun' ? add(middle, c.toSun, 1e6) : spec.body === 'earth' ? c.earthKm : c.moonKm
    // The craft `share` of the picture's height: that far off, on the far side from the body, the
    // body `aside` (a share of half the picture's height) off the middle - toward the Sun's side, so
    // the craft shows lit rather than black against it.
    const fov = lensFov(spec.lens)
    const distance = c.size / (spec.share * 2 * Math.tan(fov / 2))
    const toBody = unit([target[0] - middle[0], target[1] - middle[1], target[2] - middle[2]])
    const sunward = [0, 1, 2].map((k) => c.toSun[k] - toBody[k] * (c.toSun[0] * toBody[0] + c.toSun[1] * toBody[1] + c.toSun[2] * toBody[2]))
    const side = Math.hypot(sunward[0], sunward[1], sunward[2]) > 1e-3 ? unit(sunward) : unit(cross(toBody, c.up))
    const aside = (spec.aside ?? 0.5) * (fov / 2)
    const back = unit([0, 1, 2].map((k) => -toBody[k] * Math.cos(aside) + side[k] * Math.sin(aside)))
    return at(add(middle, back, distance / 1000), middle, c.up, spec.lens)
  },
  hull: (spec, c) => at(modelPoint(c, spec.eye), modelPoint(c, spec.look), c.up, spec.lens),
  detail: (spec, c) => {
    const point = modelPoint(c, spec.point)
    return at(add(point, litDirection(c, spec.azimuth, spec.elevation), spec.distance / 1000), point, c.up, spec.lens)
  },
  ground: (spec, c) => {
    if (!c.siteKm || !c.siteUp) return FRAMINGS.orbit({ kind: 'orbit', lens: spec.lens, distance: 60, azimuth: 30, elevation: 10 }, c)
    const east = unit(cross([0, 0, 1], c.siteUp))
    const north = unit(cross(c.siteUp, east))
    const standing = spec.height + (c.groundAt?.(spec.east, spec.north) ?? 0)
    const eye = add(add(add(c.siteKm, east, spec.east / 1000), north, spec.north / 1000), c.siteUp, standing / 1000)
    return at(eye, aim(c), c.siteUp, spec.lens)
  },
  watch: (spec, c) => {
    if (!c.otherKm || !c.otherTurn) return FRAMINGS.orbit({ kind: 'orbit', lens: spec.lens, distance: 40, azimuth: 0, elevation: 15 }, c)
    return at(modelPoint(c, spec.from, c.otherTurn, c.otherKm), aim(c), c.up, spec.lens)
  },
}

export function frame(spec: ShotSpec, context: ShotContext): Framing {
  return (FRAMINGS[spec.kind] as (spec: ShotSpec, c: ShotContext) => Framing)(spec, context)
}
