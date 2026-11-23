import { acceleration, closestApproach, coast, correction, moonAt, MOON_RADIUS, RANGE_ZERO_JD, solveCorrection, toMidcourse } from './apollo11Translunar'
import { type GravityField, harmonicAcceleration } from './lunarGravity'
import { moonFrame, rotate, rotateBack } from './moonOrientation'
import { integrate, MOON_MU, type State, type Vec3 } from './propagate'

// Apollo 11 into lunar orbit: the lunar orbit insertion taken as one impulse at the approach's
// pericynthion, down to the documented 169.7 by 60.0 n mi orbit (ABTN), coasted two revolutions to
// the circularization burn. Checked against the documented state at that burn's ignition (ABTN:
// 61.8 n mi, 5,477.3 ft/s at 080:11:36.75) and the documented LOI's size (2,917.5 ft/s, a finite
// burn of 357.53 s). Then the 59½ hours in lunar orbit (inLunarOrbit), in the Moon's own gravity
// field - its mascons pull a 60 n mi orbit about - to the transearth injection.

const NMI = 1.852
export const LOI_APOCYNTHION = 169.7 * NMI // ABTN
export const CIRCULARIZATION_IGNITION = 80 * 3600 + 11 * 60 + 36.75 // ABTN

function moonVelocity(t: number): Vec3 {
  const [ahead, behind] = [moonAt(t + 1), moonAt(t - 1)]
  return [(ahead[0] - behind[0]) / 2, (ahead[1] - behind[1]) / 2, (ahead[2] - behind[2]) / 2]
}


// Where Columbia's orbit lies over the Moon, fitted (apollo11LunarFit.ts): at the insertion its plane
// turned by `turnDegrees` about the line to the Moon's centre, and the circularized orbit `raise`
// n mi higher at both ends than ABTN's 66.1 by 54.5 (its period, and so where Columbia is when) - so
// that 27 hours later the orbit runs over Tranquility Base, Eagle starting its powered descent about
// 300 miles before it. The reconstructed approach fixes only the pericynthion's height, not where the
// plane lies over the Moon, which was the mission's target; and ABTN's orbits are a point-mass
// Moon's, at one moment, where the Moon's field makes the mean orbit differ.
export interface Insertion {
  turnDegrees: number
  raise: number
}
// Solved by fitInsertion (apollo11LunarFit.ts) with GRAIL to degree 60.
export const INSERTION: Insertion = { turnDegrees: 5.6417, raise: -1.1702 }

// The way from TLI to the Moon (with its correction), then the LOI impulse into the documented
// 169.7 by 60.0 n mi orbit.
export function intoLunarOrbit(sample?: (state: State) => void, insertion: Insertion = INSERTION): { state: State; deltaV: number } {
  const atMidcourse = toMidcourse(sample)
  const corrected = correction(atMidcourse, solveCorrection(atMidcourse))
  const closest = closestApproach(corrected)
  const atBurn = coast(corrected, closest.get, sample)
  // The orbit's low point where the approach came closest (its documented height is 60.0 n mi).
  const inserted = turnPlane(ontoOrbit(atBurn, LOI_APOCYNTHION / 1.852, (Math.hypot(...moonRelative(coast(corrected, closest.get)).r) - MOON_RADIUS) / 1.852), insertion.turnDegrees)
  return { state: inserted, deltaV: Math.hypot(...inserted.velocity.map((value, k) => value - atBurn.velocity[k])) }
}

// The Moon-relative velocity turned about the line from the Moon's centre to the craft.
function turnPlane(state: State, degrees: number): State {
  if (degrees === 0) return state
  const { r, v } = moonRelative(state)
  const radius = Math.hypot(...r)
  const k = r.map((value) => value / radius)
  const angle = (degrees * Math.PI) / 180
  const [c, s] = [Math.cos(angle), Math.sin(angle)]
  const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2]
  const kxv = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]
  const moonV = moonVelocity(state.t)
  return { ...state, velocity: v.map((value, i) => value * c + kxv[i] * s + k[i] * kv * (1 - c) + moonV[i]) as Vec3 }
}

// Moon-relative altitude (km) and speed (km/s).
export function lunarAltitudeSpeed(state: State): { altitude: number; speed: number } {
  const [moon, moonV] = [moonAt(state.t), moonVelocity(state.t)]
  return {
    altitude: Math.hypot(...state.position.map((value, k) => value - moon[k])) - MOON_RADIUS,
    speed: Math.hypot(...state.velocity.map((value, k) => value - moonV[k])),
  }
}

const FT = 0.0003048 // km
const T = (hours: number, minutes: number, seconds: number) => hours * 3600 + minutes * 60 + seconds
// ABTN: the circularization burn's cutoff and the orbit it left; the CSM's separation burn (9.0 s,
// 2.7 ft/s, radially down) and its final separation from the ascent stage (7.2 s, 2.2 ft/s; its
// direction APPROX: radially up - separation burns in lunar orbit were radial, and up meets the
// documented height at TEI; along the motion would miss it by about 2 n mi), each taken as an
// impulse at its middle; the events checked.
const CIRCULARIZED = { get: T(80, 11, 53.63), apocynthion: 66.1, pericynthion: 54.5 }
const SEPARATION = { get: T(100, 39, 57.4), deltaV: 2.7 * FT }
const FINAL_SEPARATION = { get: T(130, 30, 4.55), deltaV: 2.2 * FT }
const EVENTS = { undocked: T(100, 12, 0), separated: T(100, 40, 1.9), docked: T(128, 3, 0), jettisoned: T(130, 9, 31.2), tei: T(135, 23, 42.28) }
const LUNAR_STEP = 10 // s

export interface Osculating {
  // n mi above the Moon's mean radius, ft/s Moon-relative, the orbit's apocynthion and
  // pericynthion (n mi) for a point-mass Moon at that moment.
  altitude: number
  speed: number
  apocynthion: number
  pericynthion: number
}

export interface LunarOrbitCheckpoints {
  circularized: Osculating
  undocked: Osculating
  separated: Osculating
  docked: Osculating
  jettisoned: Osculating
  atTei: Osculating
}

// Earth, the Moon and the Sun as before, and the Moon's field beyond its point mass (null: none).
export function lunarOrbitAcceleration(field: GravityField | null) {
  return (get: number, position: Vec3): Vec3 => {
    const base = acceleration(get, position)
    if (!field) return base
    const moon = moonAt(get)
    const frame = moonFrame(RANGE_ZERO_JD + get / 86400)
    const extra = rotateBack(frame, harmonicAcceleration(field, rotate(frame, position.map((value, k) => value - moon[k]) as Vec3), 2))
    return [base[0] + extra[0], base[1] + extra[1], base[2] + extra[2]]
  }
}

export function moonRelative(state: State): { r: Vec3; v: Vec3 } {
  const [moon, moonV] = [moonAt(state.t), moonVelocity(state.t)]
  return { r: state.position.map((value, k) => value - moon[k]) as Vec3, v: state.velocity.map((value, k) => value - moonV[k]) as Vec3 }
}

export function osculating(state: State): Osculating {
  const { r, v } = moonRelative(state)
  const [radius, speed] = [Math.hypot(...r), Math.hypot(...v)]
  const a = 1 / (2 / radius - (speed * speed) / MOON_MU)
  const h = Math.hypot(r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0])
  const e = Math.sqrt(Math.max(0, 1 - (h * h) / (MOON_MU * a)))
  const nmi = (km: number) => (km - MOON_RADIUS) / 1.852
  return { altitude: nmi(radius), speed: speed / FT, apocynthion: nmi(a * (1 + e)), pericynthion: nmi(a * (1 - e)) }
}

// The velocity that puts the craft, where it is, on an orbit of the given apocynthion and
// pericynthion (n mi), in its plane, still climbing or falling as it was.
export function ontoOrbit(state: State, apocynthion: number, pericynthion: number): State {
  const { r, v } = moonRelative(state)
  const radius = Math.hypot(...r)
  const [ra, rp] = [apocynthion * 1.852 + MOON_RADIUS, pericynthion * 1.852 + MOON_RADIUS]
  const [a, e] = [(ra + rp) / 2, (ra - rp) / (ra + rp)]
  const speed = Math.sqrt(MOON_MU * (2 / radius - 1 / a))
  const tangential = Math.sqrt(MOON_MU * a * (1 - e * e)) / radius
  const up = r.map((value) => value / radius)
  const climb = v.reduce((sum, value, k) => sum + value * up[k], 0)
  const level = v.map((value, k) => value - climb * up[k])
  const levelLength = Math.hypot(...level)
  const radial = Math.sign(climb || 1) * Math.sqrt(Math.max(0, speed * speed - tangential * tangential))
  const moonV = moonVelocity(state.t)
  return { ...state, velocity: up.map((u, k) => radial * u + (tangential * level[k]) / levelLength + moonV[k]) as Vec3 }
}

// A small burn as an impulse, radially down toward the Moon or up away from it.
function impulse(state: State, deltaV: number, direction: 'down' | 'up'): State {
  const { r } = moonRelative(state)
  const along = r.map((value) => ((direction === 'down' ? -1 : 1) * value) / Math.hypot(...r))
  return { ...state, velocity: state.velocity.map((value, k) => value + along[k] * deltaV) as Vec3 }
}

// Columbia from the insertion to its circularized orbit, in the given field.
function circularize(field: GravityField | null, insertion: Insertion, sample?: (state: State) => void): State {
  const flown = integrate(intoLunarOrbit(undefined, insertion).state, CIRCULARIZED.get, { step: LUNAR_STEP, acceleration: lunarOrbitAcceleration(field), sample })
  return ontoOrbit(flown, CIRCULARIZED.apocynthion + insertion.raise, CIRCULARIZED.pericynthion + insertion.raise)
}

// Columbia (and Eagle with it) at the undocking.
export function atUndocking(field: GravityField | null, insertion: Insertion = INSERTION): State {
  return integrate(circularize(field, insertion), EVENTS.undocked, { step: LUNAR_STEP, acceleration: lunarOrbitAcceleration(field) })
}

// Columbia flying alone after its separation burn, from the undocking state (atUndocking).
export function columbiaSeparated(field: GravityField | null, undocked: State): State {
  const fly = (from: State, until: number) => integrate(from, until, { step: LUNAR_STEP, acceleration: lunarOrbitAcceleration(field) })
  return fly(impulse(fly(undocked, SEPARATION.get), SEPARATION.deltaV, 'down'), EVENTS.separated)
}

// From the lunar orbit insertion to the transearth injection's ignition, in the given field.
export function inLunarOrbit(field: GravityField | null, sample?: (state: State) => void, insertion: Insertion = INSERTION): LunarOrbitCheckpoints {
  const fly = (from: State, until: number) => integrate(from, until, { step: LUNAR_STEP, acceleration: lunarOrbitAcceleration(field), sample })
  const circularized = circularize(field, insertion, sample)
  const undocked = fly(circularized, EVENTS.undocked)
  const separated = fly(impulse(fly(undocked, SEPARATION.get), SEPARATION.deltaV, 'down'), EVENTS.separated)
  const docked = fly(separated, EVENTS.docked)
  const jettisoned = fly(docked, EVENTS.jettisoned)
  const atTei = fly(impulse(fly(jettisoned, FINAL_SEPARATION.get), FINAL_SEPARATION.deltaV, 'up'), EVENTS.tei)
  return { circularized: osculating(circularized), undocked: osculating(undocked), separated: osculating(separated), docked: osculating(docked), jettisoned: osculating(jettisoned), atTei: osculating(atTei) }
}
