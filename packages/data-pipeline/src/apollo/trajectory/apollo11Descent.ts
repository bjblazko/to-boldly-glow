import { moonAt, RANGE_ZERO_JD } from './apollo11Translunar'
import { PDI, TRANQUILITY_BASE } from './apollo11LunarFit'
import { moonFrame, rotate, rotateBack } from './moonOrientation'
import type { State, Vec3 } from './propagate'

// Eagle's powered descent, from its ignition (where the reconstructed coast leaves it) to
// Tranquility Base: not a model of the LM's guidance, but a smooth, never-climbing profile of height
// and distance to the site through what the crew called out on the way down (NASA's technical
// air-to-ground transcript; its times read off the transcript's pages, APPROX by a few seconds),
// joined without a step to the coast at ignition. High gate (the switch to the approach program,
// P64, at 102:41:32) about 26,000 ft from the site (APPROX, Apollo's planned high gate); the last
// stretch from the forward speeds Aldrin read out (47, 13, 9 ft/s): Armstrong flew on, past a
// crater's boulder field, and set down at 102:45:40-42.

const FT = 0.0003048 // km
const DEG = Math.PI / 180
const T = (hours: number, minutes: number, seconds: number) => hours * 3600 + minutes * 60 + seconds
// The site's distance from the Moon's centre (APPROX: about 1.9 km below the mean radius).
export const SITE_RADIUS = 1735.5
// The probes touched at 102:45:40 ("Contact light"); the footpads a moment later.
export const TOUCHDOWN = T(102, 45, 42)
export const CALLOUTS: readonly { get: number; feet: number }[] = [
  { get: T(102, 41, 0), feet: 7000 },
  { get: T(102, 42, 13), feet: 3000 },
  { get: T(102, 42, 43), feet: 2000 },
  { get: T(102, 43, 8), feet: 700 },
  { get: T(102, 43, 20), feet: 540 },
  { get: T(102, 43, 35), feet: 350 },
  { get: T(102, 43, 52), feet: 300 },
  { get: T(102, 44, 24), feet: 220 },
  { get: T(102, 44, 31), feet: 200 },
  { get: T(102, 44, 40), feet: 160 },
  { get: T(102, 44, 45), feet: 100 },
  { get: T(102, 44, 52), feet: 75 },
  { get: T(102, 45, 17), feet: 40 },
  { get: T(102, 45, 21), feet: 30 },
]
// Distance to the site (ft): high gate, then from the called-out forward speeds.
const RANGES: readonly { get: number; feet: number }[] = [
  { get: T(102, 41, 32), feet: 26000 },
  { get: T(102, 43, 52), feet: 1500 },
  { get: T(102, 44, 24), feet: 540 },
  { get: T(102, 44, 51), feet: 240 },
]

// A monotone cubic through knots (Fritsch-Carlson), its first slope given (the coast's), its last
// zero (at rest on the ground).
export class Monotone {
  private readonly slopes: number[]

  constructor(
    private readonly t: number[],
    private readonly y: number[],
    firstSlope: number,
  ) {
    const secants = t.slice(1).map((value, i) => (y[i + 1] - y[i]) / (value - t[i]))
    this.slopes = t.map((_, i) => {
      if (i === 0) return firstSlope
      if (i === t.length - 1) return 0
      const [a, b] = [secants[i - 1], secants[i]]
      return a * b <= 0 ? 0 : (2 * a * b) / (a + b)
    })
  }

  at(time: number): number {
    const { t, y, slopes } = this
    const i = Math.max(0, Math.min(t.length - 2, t.findIndex((value, k) => k > 0 && time <= value) - 1))
    const h = t[i + 1] - t[i]
    // Past either end the end piece runs on smoothly (a derivative taken across the ignition).
    const s = (time - t[i]) / h
    const [h00, h10, h01, h11] = [2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s, -2 * s ** 3 + 3 * s ** 2, s ** 3 - s ** 2]
    return h00 * y[i] + h10 * h * slopes[i] + h01 * y[i + 1] + h11 * h * slopes[i + 1]
  }
}

export interface Descent {
  // Height above the site's level and distance along the ground to it (km), at a mission time.
  height(get: number): number
  range(get: number): number
  // The site's own frame (in the Moon's frame): up through it, forward along Eagle's track.
  up: Vec3
  forward: Vec3
}

const julian = (get: number) => RANGE_ZERO_JD + get / 86400
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (v: Vec3): Vec3 => v.map((value) => value / Math.hypot(...v)) as Vec3

// Eagle's place in the Moon's frame (km from its centre), from a J2000 state at a moment `dt` on.
function moonFixed(state: State, dt: number): Vec3 {
  const t = state.t + dt
  const moon = moonAt(t)
  return rotate(moonFrame(julian(t)), state.position.map((value, k) => value + state.velocity[k] * dt - moon[k]) as Vec3)
}

export function poweredDescent(atPdi: State): Descent {
  const up: Vec3 = [Math.cos(TRANQUILITY_BASE.latitude * DEG) * Math.cos(TRANQUILITY_BASE.longitude * DEG), Math.cos(TRANQUILITY_BASE.latitude * DEG) * Math.sin(TRANQUILITY_BASE.longitude * DEG), Math.sin(TRANQUILITY_BASE.latitude * DEG)]
  const [before, here, after] = [moonFixed(atPdi, -0.5), moonFixed(atPdi, 0), moonFixed(atPdi, 0.5)]
  const direction = unit(here)
  // Forward: at the site, away from where the descent starts, along the great circle through both.
  const forward = unit(up.map((value, k) => value * dot(direction, up) - direction[k]) as Vec3)
  const ground = (p: Vec3) => SITE_RADIUS * Math.acos(Math.min(1, dot(unit(p), up)))
  const height = (p: Vec3) => Math.hypot(...p) - SITE_RADIUS
  const heights = new Monotone([PDI, ...CALLOUTS.map((c) => c.get), TOUCHDOWN], [height(here), ...CALLOUTS.map((c) => c.feet * FT), 0], height(after) - height(before))
  const ranges = new Monotone([PDI, ...RANGES.map((r) => r.get), TOUCHDOWN], [ground(here), ...RANGES.map((r) => r.feet * FT), 0], ground(after) - ground(before))
  return { height: (get) => heights.at(get), range: (get) => ranges.at(get), up, forward }
}

// Eagle's J2000 state at a moment of its powered descent (geocentric, km and km/s).
export function descentAt(descent: Descent, get: number): State {
  const place = (t: number): Vec3 => {
    const s = descent.range(t) / SITE_RADIUS
    const fixed = descent.up.map((value, k) => (SITE_RADIUS + descent.height(t)) * (Math.cos(s) * value - Math.sin(s) * descent.forward[k])) as Vec3
    const moon = moonAt(t)
    return rotateBack(moonFrame(julian(t)), fixed).map((value, k) => value + moon[k]) as Vec3
  }
  const [before, after] = [place(get - 0.5), place(get + 0.5)]
  return { t: get, position: place(get), velocity: after.map((value, k) => value - before[k]) as Vec3 }
}

// Eagle standing on the site at a moment after the landing: the site, carried round with the Moon.
export function onSurface(descent: Descent, get: number): State {
  const place = (t: number): Vec3 => {
    const moon = moonAt(t)
    return rotateBack(moonFrame(julian(t)), descent.up.map((value) => value * SITE_RADIUS) as Vec3).map((value, k) => value + moon[k]) as Vec3
  }
  const [before, after] = [place(get - 0.5), place(get + 0.5)]
  return { t: get, position: place(get), velocity: after.map((value, k) => value - before[k]) as Vec3 }
}
