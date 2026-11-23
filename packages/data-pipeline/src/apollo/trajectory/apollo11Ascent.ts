import { Monotone, onSurface, poweredDescent, SITE_RADIUS } from './apollo11Descent'
import { eagleAtPdi } from './apollo11LunarFit'
import { atUndocking, columbiaSeparated, lunarOrbitAcceleration, moonRelative, ontoOrbit } from './apollo11LunarOrbit'
import { moonAt, MOON_RADIUS, RANGE_ZERO_JD } from './apollo11Translunar'
import type { GravityField } from './lunarGravity'
import { moonFrame, rotate, rotateBack } from './moonOrientation'
import { integrate, type State, type Vec3 } from './propagate'

// Eagle's ascent stage back up to Columbia. The powered ascent (ABTN: 124:22:00.79 to 124:29:15.67,
// into a 48.0 by 9.4 n mi orbit) as a smooth climb from the site at rest to the orbit's low point -
// how far on from the site it got there is solved so that the rendezvous works out; then the
// rendezvous burns, each putting Eagle on the orbit ABTN gives after it (taken at the burn's
// middle): coelliptic sequence initiation (125:19:35, 47 s: 49.3 by 45.7), constant differential
// height (126:17:49.6, 17.8 s: 47.4 by 42.1), terminal phase initiation (127:03:51.8, 22.7 s: 61.7
// by 43.7), terminal phase finalize (127:46:09.8, 28.4 s: 63.0 by 56.5); docking at 128:03:00.
// The two small midcourse corrections (1.0 and 1.5 ft/s) are left out. After the last burn's
// cutoff (127:46:38.2) the crew closed by eye to stationkeeping (127:52:05.3) and docked: Eagle's
// path there joins Columbia's smoothly, 30 m off at stationkeeping, together at the docking.

const T = (hours: number, minutes: number, seconds: number) => hours * 3600 + minutes * 60 + seconds
const DEG = Math.PI / 180
const NMI = 1.852
export const LIFTOFF = T(124, 22, 0.79)
export const INSERTION_CUTOFF = T(124, 29, 15.67)
export const DOCKED = T(128, 3, 0)
const BRAKED = T(127, 46, 38.2)
const STATIONKEEPING = T(127, 52, 5.3)
const STATIONKEEPING_KM = 0.03
const INSERTION_ORBIT = { apocynthion: 48.0, pericynthion: 9.4 }
const BURNS: readonly { get: number; apocynthion: number; pericynthion: number }[] = [
  { get: T(125, 19, 58.5), apocynthion: 49.3, pericynthion: 45.7 },
  { get: T(126, 17, 58.5), apocynthion: 47.4, pericynthion: 42.1 },
  { get: T(127, 4, 3.15), apocynthion: 61.7, pericynthion: 43.7 },
  { get: T(127, 46, 24), apocynthion: 63.0, pericynthion: 56.5 },
]
const STEP = 5

export interface Ascent {
  height(get: number): number
  range(get: number): number
  // Sideways off the great circle from the site toward the insertion, as an angle (radians).
  aside(get: number): number
  // The site and the direction of the climb, in the Moon's frame.
  up: Vec3
  forward: Vec3
  site: State
  insertion: State
  insertionDegrees: number
  columbiaAtDock: State
}

const julian = (get: number) => RANGE_ZERO_JD + get / 86400
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (v: readonly number[]): Vec3 => v.map((value) => value / Math.hypot(...v)) as Vec3
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// Eagle at the cutoff: `degrees` on from the site along Columbia's plane, at the low point of the
// insertion orbit.
function insertionAt(columbia: State, site: Vec3, degrees: number): State {
  const { r, v } = moonRelative(columbia)
  const normal = unit(cross(r, v))
  const inPlane = unit(site.map((value, k) => value - dot(site, normal) * normal[k]))
  const along = cross(normal, inPlane)
  const a = degrees * DEG
  const direction = inPlane.map((value, k) => Math.cos(a) * value + Math.sin(a) * along[k])
  const heading = inPlane.map((value, k) => -Math.sin(a) * value + Math.cos(a) * along[k])
  const [moon, ahead, behind] = [moonAt(columbia.t), moonAt(columbia.t + 1), moonAt(columbia.t - 1)]
  const radius = MOON_RADIUS + INSERTION_ORBIT.pericynthion * NMI
  const rough: State = { t: columbia.t, position: direction.map((value, k) => value * radius + moon[k]) as Vec3, velocity: heading.map((value, k) => value * 1.6 + (ahead[k] - behind[k]) / 2) as Vec3 }
  return ontoOrbit(rough, INSERTION_ORBIT.apocynthion, INSERTION_ORBIT.pericynthion)
}

// From the insertion through the rendezvous burns to the docking time (unjoined: for the solve).
function rendezvous(field: GravityField | null, insertion: State, sample?: (state: State) => void): State {
  const fly = (from: State, until: number) => integrate(from, until, { step: STEP, acceleration: lunarOrbitAcceleration(field), sample })
  const afterBurns = BURNS.reduce((state, burn) => ontoOrbit(fly(state, burn.get), burn.apocynthion, burn.pericynthion), insertion)
  return fly(afterBurns, DOCKED)
}

// After the braking, Eagle's own path eased into Columbia's: an offset from Columbia that shrinks
// (cubic, smooth at both ends) to 30 m at stationkeeping and to nothing at the docking.
function closeIn(eagle: State[], columbia: (get: number) => State): State[] {
  const braked = eagle.find((state) => state.t >= BRAKED)!
  const offset0 = braked.position.map((value, k) => value - columbia(braked.t).position[k])
  const rate0 = braked.velocity.map((value, k) => value - columbia(braked.t).velocity[k])
  const keep = unit(offset0).map((value) => value * STATIONKEEPING_KM)
  const offsetAt = (get: number): number[] => {
    if (get >= STATIONKEEPING) return keep.map((value) => value * (1 - smooth((get - STATIONKEEPING) / (DOCKED - STATIONKEEPING))))
    const span = STATIONKEEPING - braked.t
    const s = (get - braked.t) / span
    const [h00, h10, h01] = [2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s, -2 * s ** 3 + 3 * s ** 2]
    return offset0.map((value, k) => h00 * value + h10 * span * rate0[k] + h01 * keep[k])
  }
  const joined = (get: number): State => {
    const c = columbia(get)
    const [o, ahead, behind] = [offsetAt(get), offsetAt(get + 0.5), offsetAt(get - 0.5)]
    return { t: get, position: c.position.map((value, k) => value + o[k]) as Vec3, velocity: c.velocity.map((value, k) => value + ahead[k] - behind[k]) as Vec3 }
  }
  const after: State[] = []
  for (let get = braked.t + STEP; get < DOCKED; get += STEP) after.push(joined(get))
  return [...eagle.filter((state) => state.t <= braked.t), ...after, joined(DOCKED)]
}

const smooth = (s: number) => s * s * (3 - 2 * s)

interface Setting {
  field: GravityField | null
  columbiaAtCutoff: State
  columbiaAtDock: State
  // The site, in the J2000 frame at the cutoff.
  site: Vec3
}

// How far Eagle ends up ahead of Columbia at the docking time, along Columbia's motion (km).
function miss(setting: Setting, degrees: number): number {
  const eagle = rendezvous(setting.field, insertionAt(setting.columbiaAtCutoff, setting.site, degrees))
  const velocity = unit(setting.columbiaAtDock.velocity)
  return dot(eagle.position.map((value, k) => value - setting.columbiaAtDock.position[k]), velocity)
}

// How far on from the site Eagle reached orbit: the secant method on the miss.
function insertionDegrees(setting: Setting): number {
  let [a, b] = [7, 9]
  let [fa, fb] = [miss(setting, a), miss(setting, b)]
  for (let i = 0; i < 8 && Math.abs(fb) > 0.05; i++) {
    const next = b - (fb * (b - a)) / (fb - fa)
    ;[a, fa, b] = [b, fb, next]
    fb = miss(setting, b)
  }
  return b
}

// Columbia second by second from the cutoff to the docking.
function columbiaTrack(field: GravityField | null, atCutoff: State): (get: number) => State {
  const path: State[] = []
  integrate(atCutoff, DOCKED, { step: 1, acceleration: lunarOrbitAcceleration(field), sample: (state) => path.push(state) })
  return (get) => path[Math.min(path.length - 1, Math.max(0, Math.round(get - atCutoff.t)))]
}

export function eagleUp(field: GravityField | null): { ascent: Ascent; coast: State[] } {
  const descent = poweredDescent(eagleAtPdi(field))
  const columbiaAtCutoff = integrate(columbiaSeparated(field, atUndocking(field)), INSERTION_CUTOFF, { step: STEP, acceleration: lunarOrbitAcceleration(field) })
  const columbiaAtDock = integrate(columbiaAtCutoff, DOCKED, { step: STEP, acceleration: lunarOrbitAcceleration(field) })
  const setting = { field, columbiaAtCutoff, columbiaAtDock, site: rotateBack(moonFrame(julian(INSERTION_CUTOFF)), descent.up) }
  const degrees = insertionDegrees(setting)
  const insertion = insertionAt(columbiaAtCutoff, setting.site, degrees)
  const flown: State[] = []
  rendezvous(field, insertion, (state) => flown.push(state))
  return { ascent: { ...poweredAscent(descent, insertion), insertionDegrees: degrees, columbiaAtDock }, coast: closeIn(flown, columbiaTrack(field, columbiaAtCutoff)) }
}

// The climb in the Moon's frame: height over the site's level and distance along the ground, from
// rest at the site to the insertion state.
function poweredAscent(descent: ReturnType<typeof poweredDescent>, insertion: State): Omit<Ascent, 'insertionDegrees' | 'columbiaAtDock'> {
  // (The insertion lies on the great circle from the site by construction; its velocity need not.)
  const fixed = (dt: number): Vec3 => {
    const t = insertion.t + dt
    const moon = moonAt(t)
    return rotate(moonFrame(julian(t)), insertion.position.map((value, k) => value + insertion.velocity[k] * dt - moon[k]) as Vec3)
  }
  const [before, here, after] = [fixed(-0.5), fixed(0), fixed(0.5)]
  const up = descent.up
  const direction = unit(here)
  const forward = unit(direction.map((value, k) => value - dot(direction, up) * up[k]))
  const ground = (p: Vec3) => SITE_RADIUS * Math.acos(Math.min(1, dot(unit(p), up)))
  const height = (p: Vec3) => Math.hypot(...p) - SITE_RADIUS
  const heights = new Monotone([LIFTOFF, INSERTION_CUTOFF], [0, height(here)], 0, height(after) - height(before))
  const ranges = new Monotone([LIFTOFF, INSERTION_CUTOFF], [0, ground(here)], 0, ground(after) - ground(before))
  const side = cross(up, forward)
  const sideRate = dot(after.map((value, k) => value - before[k]), side) / Math.hypot(...here)
  const span = INSERTION_CUTOFF - LIFTOFF
  const aside = (get: number) => {
    const s = (get - LIFTOFF) / span
    return (s ** 3 - s ** 2) * span * sideRate
  }
  return { height: (get) => heights.at(get), range: (get) => ranges.at(get), aside, up, forward, site: onSurface(descent, LIFTOFF), insertion }
}

// Eagle's J2000 state at a moment of its powered ascent.
export function ascentAt(ascent: Ascent, get: number): State {
  const place = (t: number): Vec3 => {
    const [s, g] = [ascent.range(t) / SITE_RADIUS, ascent.aside(t)]
    const side = cross(ascent.up, ascent.forward)
    const fixed = ascent.up.map((value, k) => (SITE_RADIUS + ascent.height(t)) * (Math.cos(g) * (Math.cos(s) * value + Math.sin(s) * ascent.forward[k]) + Math.sin(g) * side[k])) as Vec3
    const moon = moonAt(t)
    return rotateBack(moonFrame(julian(t)), fixed).map((value, k) => value + moon[k]) as Vec3
  }
  const [before, after] = [place(get - 0.5), place(get + 0.5)]
  return { t: get, position: place(get), velocity: after.map((value, k) => value - before[k]) as Vec3 }
}
