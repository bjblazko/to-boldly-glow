import { gmstDegrees, localToInertial, precessionToDate, transposeTimes } from './frames'
import { coast, lunarArrival, MOON_RADIUS, newtonStep, RANGE_ZERO_JD } from './apollo11Translunar'
import { MOON_MU, type State, type Vec3 } from './propagate'

// Apollo 11's way home, reconstructed backward: the documented state at entry interface (MR table
// 7-VII) coasted back through the same field to the transearth midcourse correction, and that
// correction - its size not fitted, only its effect - solved so that the coast back meets the
// documented state after the transearth injection (ABTN). Validation: the coast back meets the
// documented altitude and speed at the correction unaided, and the solved correction's size
// against the documented 4.8 ft/s.
//
// Sources: ABTN = "Apollo by the Numbers" (NASA SP-4029), Apollo 11 transearth phase table;
// MR = "Apollo 11 Mission Report" (MSC-00171), table 7-VII.

const FT = 0.0003048
const NMI = 1.852
const EARTH_SPHERE = 3443.934 * NMI

export const ENTRY_INTERFACE = {
  get: 195 * 3600 + 3 * 60 + 5.7,
  latitude: -3.19, // geodetic (MR); the geocentric differs by about 0.02 deg here
  longitude: 171.96,
  altitude: 65.8 * NMI, // 400,000 ft
  speed: 36194.4 * FT, // space-fixed
  flightPath: -6.48,
  heading: 50.18,
}

export const TRANSEARTH_MIDCOURSE = { get: 150 * 3600 + 29 * 60 + 57.4, altitude: 169087.2 * NMI, speed: 4075.0 * FT, deltaV: 4.8 * FT } // ABTN
// After the transearth injection, Moon-relative (ABTN).
export const TEI_CUTOFF = { get: 135 * 3600 + 26 * 60 + 13.69, altitude: 58.1 * NMI, speed: 8589.0 * FT, flightPath: 5.13 }
export const TEI_IGNITION = 135 * 3600 + 23 * 60 + 42.28

export function entryInterfaceState(): State {
  const jd = RANGE_ZERO_JD + ENTRY_INTERFACE.get / 86400
  const local = localToInertial({ ...ENTRY_INTERFACE, radius: EARTH_SPHERE + ENTRY_INTERFACE.altitude }, gmstDegrees(jd))
  const p = precessionToDate(jd)
  return { t: ENTRY_INTERFACE.get, position: transposeTimes(p, local.position), velocity: transposeTimes(p, local.velocity) }
}

// The correction (km/s) taken off the velocity going back through it.
function undo(state: State, deltaV: Vec3): State {
  return { ...state, velocity: state.velocity.map((value, k) => value - deltaV[k]) as Vec3 }
}

// The coast back from the correction to the TEI cutoff, given the correction.
export function backToTei(atCorrection: State, deltaV: Vec3, sample?: (state: State) => void): State {
  return coast(undo(atCorrection, deltaV), TEI_CUTOFF.get, sample)
}

// The departure's pericynthion, from the documented state after TEI on its Keplerian hyperbola
// (Moon-relative, already leaving): when (GET, s) and how high (km).
export function departurePericynthion(): { get: number; altitude: number } {
  const r = MOON_RADIUS + TEI_CUTOFF.altitude
  const gamma = (TEI_CUTOFF.flightPath * Math.PI) / 180
  const energy = (TEI_CUTOFF.speed * TEI_CUTOFF.speed) / 2 - MOON_MU / r
  const h = r * TEI_CUTOFF.speed * Math.cos(gamma)
  const p = (h * h) / MOON_MU
  const e = Math.sqrt(1 + (2 * energy * h * h) / (MOON_MU * MOON_MU))
  const nu = Math.acos((p / r - 1) / e) // already past it
  const f = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2))
  const meanAnomaly = e * Math.sinh(f) - f
  const a = -MOON_MU / (2 * energy)
  return { get: TEI_CUTOFF.get - meanAnomaly / Math.sqrt(MOON_MU / (-a) ** 3), altitude: p / (1 + e) - MOON_RADIUS }
}

// The coast back's closest approach to the Moon (GET and altitude, refined between samples).
export function closestBack(atCorrection: State, deltaV: Vec3): { get: number; altitude: number } {
  const samples: { t: number; altitude: number }[] = []
  coast(undo(atCorrection, deltaV), TEI_CUTOFF.get - 3 * 3600, (state) => {
    if (state.t < TEI_CUTOFF.get + 6 * 3600) samples.push({ t: state.t, altitude: lunarArrival(state).altitude })
  })
  const i = samples.reduce((best, sample, k) => (sample.altitude < samples[best].altitude ? k : best), 0)
  const [a, b, c] = [samples[Math.max(i - 1, 0)], samples[i], samples[Math.min(i + 1, samples.length - 1)]]
  const denominator = a.altitude - 2 * b.altitude + c.altitude
  const shift = denominator > 0 ? (0.5 * (a.altitude - c.altitude)) / denominator : 0
  return { get: b.t + shift * (c.t - b.t), altitude: b.altitude - 0.25 * (a.altitude - c.altitude) * shift }
}

// The correction, in the orbit plane (along the velocity and across it), that brings the coast
// back to the departure's pericynthion, when and where the documented state after TEI puts it.
export function solveTransearthCorrection(atCorrection: State): Vec3 {
  const target = departurePericynthion()
  const along = unit(atCorrection.velocity)
  const across = unit(cross(cross(atCorrection.position, atCorrection.velocity), atCorrection.velocity))
  const toDeltaV = ([u, w]: number[]): Vec3 => [0, 1, 2].map((k) => u * along[k] + w * across[k]) as Vec3
  const miss = (x: number[]) => {
    const { get, altitude } = closestBack(atCorrection, toDeltaV(x))
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

function cross(a: number[], b: number[]): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function unit(v: number[]): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2])
  return [v[0] / n, v[1] / n, v[2] / n]
}
