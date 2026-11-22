import { closestApproach, coast, correction, moonAt, MOON_RADIUS, solveCorrection, toMidcourse } from './apollo11Translunar'
import { MOON_MU, type State, type Vec3 } from './propagate'

// Apollo 11 into lunar orbit: the lunar orbit insertion taken as one impulse at the approach's
// pericynthion, down to the documented 169.7 by 60.0 n mi orbit (ABTN), coasted two revolutions to
// the circularization burn. Checked against the documented state at that burn's ignition (ABTN:
// 61.8 n mi, 5,477.3 ft/s at 080:11:36.75) and the documented LOI's size (2,917.5 ft/s, a finite
// burn of 357.53 s). The longer stay in lunar orbit needs the Moon's own gravity field (its
// oblateness, its mascons), which this model leaves out: a later step.

const NMI = 1.852
export const LOI_APOCYNTHION = 169.7 * NMI // ABTN
export const CIRCULARIZATION_IGNITION = 80 * 3600 + 11 * 60 + 36.75 // ABTN

function moonVelocity(t: number): Vec3 {
  const [ahead, behind] = [moonAt(t + 1), moonAt(t - 1)]
  return [(ahead[0] - behind[0]) / 2, (ahead[1] - behind[1]) / 2, (ahead[2] - behind[2]) / 2]
}

// The state with its Moon-relative speed set (the direction kept), and the change it took (km/s).
function withLunarSpeed(state: State, speed: number): { state: State; deltaV: number } {
  const moonV = moonVelocity(state.t)
  const v = state.velocity.map((value, k) => value - moonV[k])
  const now = Math.hypot(...v)
  return { state: { ...state, velocity: v.map((value, k) => (value * speed) / now + moonV[k]) as Vec3 }, deltaV: now - speed }
}

// The way from TLI to the Moon (with its correction), then the LOI impulse at pericynthion.
export function intoLunarOrbit(sample?: (state: State) => void): { state: State; deltaV: number } {
  const atMidcourse = toMidcourse(sample)
  const corrected = correction(atMidcourse, solveCorrection(atMidcourse))
  const atPericynthion = coast(corrected, closestApproach(corrected).get, sample)
  const moon = moonAt(atPericynthion.t)
  const r = Math.hypot(...atPericynthion.position.map((value, k) => value - moon[k]))
  const apo = MOON_RADIUS + LOI_APOCYNTHION
  return withLunarSpeed(atPericynthion, Math.sqrt((MOON_MU * 2 * apo) / (r * (r + apo))))
}

// Moon-relative altitude (km) and speed (km/s).
export function lunarAltitudeSpeed(state: State): { altitude: number; speed: number } {
  const [moon, moonV] = [moonAt(state.t), moonVelocity(state.t)]
  return {
    altitude: Math.hypot(...state.position.map((value, k) => value - moon[k])) - MOON_RADIUS,
    speed: Math.hypot(...state.velocity.map((value, k) => value - moonV[k])),
  }
}
