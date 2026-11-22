import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gmstDegrees, localToInertial, precessionToDate, transposeTimes } from './frames'
import { earthAcceleration, integrate, MOON_MU, type State, SUN_MU, thirdBody, type Vec3 } from './propagate'

// Apollo 11 from translunar injection to the Moon, reconstructed (see
// docs/superpowers/specs/2026-11-22-apollo-mission-data-design.md): the documented state at TLI,
// coasted through Earth's, the Moon's and the Sun's field, and the midcourse correction's 20.9 ft/s
// pointed so that the coast meets the documented lunar orbit insertion. Mission time (GET, s).
//
// Sources: ABTN = "Apollo by the Numbers" (NASA SP-4029), Apollo 11 translunar phase table;
// MR = "Apollo 11 Mission Report" (MSC-00171), table 7-II.

const FT = 0.0003048 // km
const NMI = 1.852 // km
// ABTN: altitudes above a spherical Earth of radius 3,443.934 n mi.
const EARTH_SPHERE = 3443.934 * NMI
export const MOON_RADIUS = 1737.4
// Range zero, 13:32:00 UT on 16 July 1969, as a Julian day.
export const RANGE_ZERO_JD = 2440418.5 + (13 + 32 / 60) / 24

const julianDay = (get: number) => RANGE_ZERO_JD + get / 86400

export const TLI = {
  get: 2 * 3600 + 50 * 60 + 13.03, // ABTN
  altitude: 180.581 * NMI, // ABTN
  speed: 35545.6 * FT, // ABTN, space-fixed
  flightPath: 7.367, // ABTN
  heading: 60.073, // ABTN, E of N
  longitude: -164.84, // MR table 7-II
  // Not printed legibly in either source: from the plane - the S-IVB's orbit after its second burn
  // was inclined 31.386 degrees (ABTN), and on it cos(i) = cos(latitude) sin(heading), going north.
  latitude: (Math.acos(Math.cos(31.386 * (Math.PI / 180)) / Math.sin(60.073 * (Math.PI / 180))) * 180) / Math.PI,
}

export const MIDCOURSE = { get: 26 * 3600 + 44 * 60 + 58.64, deltaV: 20.9 * FT } // ABTN
// The evasive maneuver away from the S-IVB, 19.7 ft/s (ABTN). Its direction isn't in either source;
// against the velocity it brings the coast to the documented state at the midcourse correction
// (speed within 0.2 % instead of 0.6 %) - taken as retrograde.
export const EVASIVE = { get: 4 * 3600 + 40 * 60 + 1.72, deltaV: 19.7 * FT }
// ABTN; the flight-path angle from MR table 7-II (Moon-relative).
export const LOI = { get: 75 * 3600 + 49 * 60 + 50.37, altitude: 86.7 * NMI, speed: 8250.0 * FT, flightPath: -9.99 }

// The documented checkpoints the coast is tested against (ABTN): altitude above Earth, space-fixed speed.
export const CHECKPOINTS = [
  { get: 3 * 3600 + 15 * 60 + 23.0, altitude: 3815.19 * NMI, speed: 24962.5 * FT },
  { get: 4 * 3600 + 40 * 60 + 1.72, altitude: 16620.8 * NMI, speed: 14680.0 * FT },
  { get: MIDCOURSE.get, altitude: 109475.3 * NMI, speed: 5025.0 * FT },
]

interface Ephemeris {
  moon: number[][]
  sun: number[][]
}

const EPHEMERIS: Ephemeris = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../data/apollo11-ephemeris.json'), 'utf8')) as Ephemeris

// A body's position at a Julian day: four-point Lagrange interpolation in the ten-minute table.
function bodyAt(table: number[][], jd: number): Vec3 {
  const step = table[1][0] - table[0][0]
  const i = Math.min(Math.max(Math.floor((jd - table[0][0]) / step) - 1, 0), table.length - 4)
  const rows = table.slice(i, i + 4)
  const weights = rows.map((row, k) => rows.reduce((w, other, m) => (m === k ? w : (w * (jd - other[0])) / (row[0] - other[0])), 1))
  return [1, 2, 3].map((axis) => rows.reduce((sum, row, k) => sum + row[axis] * weights[k], 0)) as Vec3
}

export const moonAt = (get: number): Vec3 => bodyAt(EPHEMERIS.moon, julianDay(get))
const sunAt = (get: number): Vec3 => bodyAt(EPHEMERIS.sun, julianDay(get))

export function acceleration(get: number, position: Vec3): Vec3 {
  const e = earthAcceleration(position)
  const m = thirdBody(MOON_MU, moonAt(get), position)
  const s = thirdBody(SUN_MU, sunAt(get), position)
  return [e[0] + m[0] + s[0], e[1] + m[1] + s[1], e[2] + m[2] + s[2]]
}

// The coast from TLI to the midcourse correction, with the evasive maneuver on the way.
export function toMidcourse(sample?: (state: State) => void): State {
  const before = coast(tliState(), EVASIVE.get, sample)
  const speed = Math.hypot(...before.velocity)
  const after = { ...before, velocity: before.velocity.map((value) => value * (1 - EVASIVE.deltaV / speed)) as Vec3 }
  return coast(after, MIDCOURSE.get, sample)
}

// The TLI state in the J2000 frame.
export function tliState(): State {
  const jd = julianDay(TLI.get)
  const local = localToInertial({ latitude: TLI.latitude, longitude: TLI.longitude, radius: EARTH_SPHERE + TLI.altitude, speed: TLI.speed, flightPath: TLI.flightPath, heading: TLI.heading }, gmstDegrees(jd))
  const p = precessionToDate(jd)
  return { t: TLI.get, position: transposeTimes(p, local.position), velocity: transposeTimes(p, local.velocity) }
}

const STEP = 20 // s

export function coast(from: State, until: number, sample?: (state: State) => void): State {
  return integrate(from, until, { step: STEP, acceleration, sample })
}

// The midcourse correction as a velocity change (km/s, J2000).
export function correction(state: State, deltaV: Vec3): State {
  return { ...state, velocity: state.velocity.map((value, k) => value + deltaV[k]) as Vec3 }
}

// Moon-relative altitude (km), speed (km/s) and flight-path angle (degrees) at a state, the Moon's
// own velocity from its positions.
export function lunarArrival(state: State): { altitude: number; speed: number; flightPath: number } {
  const moon = moonAt(state.t)
  const ahead = moonAt(state.t + 1)
  const behind = moonAt(state.t - 1)
  const r = state.position.map((value, k) => value - moon[k])
  const v = state.velocity.map((value, k) => value - (ahead[k] - behind[k]) / 2)
  const radius = Math.hypot(...r)
  const speed = Math.hypot(...v)
  const flightPath = (Math.asin((r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) / (radius * speed)) * 180) / Math.PI
  return { altitude: radius - MOON_RADIUS, speed, flightPath }
}

// The approach's pericynthion, from the documented LOI ignition state (altitude, speed and
// flight-path angle, Moon-relative) on its Keplerian hyperbola: when (GET, s) and how high (km).
export function pericynthionFromLoi(): { get: number; altitude: number } {
  const r = MOON_RADIUS + LOI.altitude
  const gamma = (LOI.flightPath * Math.PI) / 180
  const energy = (LOI.speed * LOI.speed) / 2 - MOON_MU / r
  const h = r * LOI.speed * Math.cos(gamma)
  const p = (h * h) / MOON_MU
  const e = Math.sqrt(1 + (2 * energy * h * h) / (MOON_MU * MOON_MU))
  const nu = -Math.acos((p / r - 1) / e) // still approaching
  const f = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2))
  const meanAnomaly = e * Math.sinh(f) - f
  const a = -MOON_MU / (2 * energy)
  return { get: LOI.get - meanAnomaly / Math.sqrt(MOON_MU / (-a) ** 3), altitude: p / (1 + e) - MOON_RADIUS }
}

// The closest approach to the Moon of a coast (GET and altitude, refined between samples).
export function closestApproach(from: State): { get: number; altitude: number } {
  const samples: { t: number; altitude: number }[] = []
  coast(from, LOI.get + 2 * 3600, (state) => {
    if (state.t > LOI.get - 6 * 3600) samples.push({ t: state.t, altitude: lunarArrival(state).altitude })
  })
  const i = samples.reduce((best, sample, k) => (sample.altitude < samples[best].altitude ? k : best), 0)
  const [a, b, c] = [samples[Math.max(i - 1, 0)], samples[i], samples[Math.min(i + 1, samples.length - 1)]]
  const denominator = a.altitude - 2 * b.altitude + c.altitude
  const shift = denominator > 0 ? (0.5 * (a.altitude - c.altitude)) / denominator : 0
  return { get: b.t + shift * (c.t - b.t), altitude: b.altitude - 0.25 * (a.altitude - c.altitude) * shift }
}

// The correction, in the orbit plane (along the velocity and across it, toward the radius), that
// brings the pericynthion to where and when the documented LOI puts it (Newton's method on finite
// differences). The model's errors - the evasive maneuver left out, the TLI latitude derived - land
// in it too: its size, against the documented 20.9 ft/s, says how close the rest is.
export function solveCorrection(atMidcourse: State): Vec3 {
  const target = pericynthionFromLoi()
  const along = unit(atMidcourse.velocity)
  const across = unit(cross(cross(atMidcourse.position, atMidcourse.velocity), atMidcourse.velocity))
  const toDeltaV = ([u, w]: number[]): Vec3 => [0, 1, 2].map((k) => u * along[k] + w * across[k]) as Vec3
  const miss = (x: number[]) => {
    const { get, altitude } = closestApproach(correction(atMidcourse, toDeltaV(x)))
    return [(get - target.get) / 60, (altitude - target.altitude) / 20]
  }
  let x = [0, 0]
  for (let round = 0; round < 30; round++) {
    const f = miss(x)
    if (Math.hypot(...f) < 0.01) break
    x = newtonStep(miss, x, f)
  }
  return toDeltaV(x)
}

// One damped step of Newton's method in two unknowns (km/s), the Jacobian by finite differences;
// a step is held to 3 m/s.
export function newtonStep(miss: (x: number[]) => number[], x: number[], f: number[]): number[] {
  const h = 1e-4
  const j = [0, 1].map((k) => miss(x.map((value, m) => (m === k ? value + h : value))).map((value, i) => (value - f[i]) / h))
  const det = j[0][0] * j[1][1] - j[1][0] * j[0][1]
  const step = [(f[0] * j[1][1] - f[1] * j[1][0]) / det, (j[0][0] * f[1] - j[0][1] * f[0]) / det]
  const scale = Math.min(1, 0.003 / Math.max(1e-12, Math.hypot(...step)))
  return [x[0] - step[0] * scale, x[1] - step[1] * scale]
}

function cross(a: Vec3 | number[], b: Vec3 | number[]): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function unit(v: Vec3 | number[]): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2])
  return [v[0] / n, v[1] / n, v[2] / n]
}
