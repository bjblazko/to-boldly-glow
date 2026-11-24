import { atUndocking, INSERTION, type Insertion, lunarOrbitAcceleration, moonRelative } from './apollo11LunarOrbit'
import { RANGE_ZERO_JD } from './apollo11Translunar'
import type { GravityField } from './lunarGravity'
import { moonFrame, rotateBack } from './moonOrientation'
import { integrate, type State, type Vec3 } from './propagate'

// Where Columbia's orbit lies over the Moon, fitted to Eagle's landing: Eagle stays on Columbia's
// orbit after the undocking, brakes into its descent orbit (DOI, ABTN: 101:36:14, 30 s, 76.4 ft/s,
// taken as a retrograde impulse at its middle) and starts its powered descent at 102:33:05.01
// "about 300 miles uprange" of the site (NASA's Apollo 11 mission overview: taken as 300 statute
// miles, 483 km, APPROX); it lands at 102:45:40 at Tranquility Base (LROC: 0.67416° N, 23.47314°
// E). The fit turns the orbit's plane and raises the circularized orbit (apollo11LunarOrbit.ts,
// INSERTION) until the site lies in Eagle's orbit plane and that far ahead at powered descent.

const FT = 0.0003048
const DEG = Math.PI / 180
const T = (hours: number, minutes: number, seconds: number) => hours * 3600 + minutes * 60 + seconds
export const TRANQUILITY_BASE = { latitude: 0.67416, longitude: 23.47314 }
export const DOI = { get: T(101, 36, 29), deltaV: 76.4 * FT }
export const PDI = T(102, 33, 5.01)
export const LANDING = T(102, 45, 40)
export const PDI_RANGE_DEGREES = 483 / 1737.4 / DEG

// The site, a unit vector in the J2000 frame at a mission time.
function siteAt(get: number): Vec3 {
  const [lat, lon] = [TRANQUILITY_BASE.latitude * DEG, TRANQUILITY_BASE.longitude * DEG]
  return rotateBack(moonFrame(RANGE_ZERO_JD + get / 86400), [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)])
}

// Eagle at powered descent initiation: from the undocking, through its DOI.
export function eagleAtPdi(field: GravityField | null, insertion: Insertion = INSERTION, sample?: (state: State) => void): State {
  const fly = (from: State, until: number) => integrate(from, until, { step: 10, acceleration: lunarOrbitAcceleration(field), sample })
  const beforeDoi = fly(atUndocking(field, insertion), DOI.get)
  const { v } = moonRelative(beforeDoi)
  const speed = Math.hypot(...v)
  const braked = { ...beforeDoi, velocity: beforeDoi.velocity.map((value, k) => value - (v[k] / speed) * DOI.deltaV) as Vec3 }
  return fly(braked, PDI)
}

// How far the site lies off Eagle's orbit plane at the landing, and how far ahead of Eagle at powered
// descent (degrees of arc).
export function landingGeometry(eagle: State): { crossTrack: number; range: number } {
  const { r, v } = moonRelative(eagle)
  const n = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]]
  const nLength = Math.hypot(...n)
  const site = siteAt(LANDING)
  const crossTrack = Math.asin(site.reduce((sum, value, k) => sum + (value * n[k]) / nLength, 0)) / DEG
  const radius = Math.hypot(...r)
  const range = Math.acos(site.reduce((sum, value, k) => sum + (value * r[k]) / radius, 0)) / DEG
  return { crossTrack, range }
}

// Newton's method on the plane's turn (degrees) and the orbit's raise (n mi).
export function fitInsertion(field: GravityField | null, start: Insertion = { turnDegrees: 0, raise: 0 }): Insertion {
  const miss = (x: Insertion) => {
    const { crossTrack, range } = landingGeometry(eagleAtPdi(field, x))
    return [crossTrack, range - PDI_RANGE_DEGREES]
  }
  let x = start
  for (let iteration = 0; iteration < 8; iteration++) {
    const f = miss(x)
    if (Math.hypot(...f) < 0.01) break
    const [dt, dr] = [0.05, 0.1]
    const ft = miss({ ...x, turnDegrees: x.turnDegrees + dt })
    const fr = miss({ ...x, raise: x.raise + dr })
    const j = [[(ft[0] - f[0]) / dt, (fr[0] - f[0]) / dr], [(ft[1] - f[1]) / dt, (fr[1] - f[1]) / dr]]
    const det = j[0][0] * j[1][1] - j[0][1] * j[1][0]
    x = { turnDegrees: x.turnDegrees - (f[0] * j[1][1] - f[1] * j[0][1]) / det, raise: x.raise - (j[0][0] * f[1] - j[1][0] * f[0]) / det }
  }
  return x
}
