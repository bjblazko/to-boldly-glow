import { gmstDegrees, localToInertial, precessionToDate, transposeTimes } from './frames'
import { coast, RANGE_ZERO_JD } from './apollo11Translunar'
import type { State } from './propagate'

// Apollo 11 in its parking orbit, from the S-IVB's first cutoff to the second burn's ignition: the
// documented state at cutoff ("Apollo by the Numbers", NASA SP-4029, Apollo 11 ascent phase table)
// coasted through the same field as the way to the Moon.

const FT = 0.0003048
const NMI = 1.852
const EARTH_SPHERE = 3443.934 * NMI

export const FIRST_CUTOFF = {
  get: 11 * 60 + 39.33,
  altitude: 103.202 * NMI,
  speed: 25561.6 * FT, // space-fixed
  latitude: 32.4865, // geocentric
  longitude: -53.4588,
  flightPath: 0.011,
  heading: 88.414,
}

// The second burn's ignition (ABTN), where the coast in the parking orbit ends.
export const TLI_IGNITION = 2 * 3600 + 44 * 60 + 16.2

export function firstCutoffState(): State {
  const jd = RANGE_ZERO_JD + FIRST_CUTOFF.get / 86400
  const local = localToInertial({ ...FIRST_CUTOFF, radius: EARTH_SPHERE + FIRST_CUTOFF.altitude }, gmstDegrees(jd))
  const p = precessionToDate(jd)
  return { t: FIRST_CUTOFF.get, position: transposeTimes(p, local.position), velocity: transposeTimes(p, local.velocity) }
}

export function parkingOrbit(sample?: (state: State) => void): State {
  return coast(firstCutoffState(), TLI_IGNITION, sample)
}

// The geocentric longitude (degrees east) under a state, for comparing with the record.
export function longitudeOf(state: State): number {
  const jd = RANGE_ZERO_JD + state.t / 86400
  const p = precessionToDate(jd)
  const [x, y] = [p[0] * state.position[0] + p[1] * state.position[1] + p[2] * state.position[2], p[3] * state.position[0] + p[4] * state.position[1] + p[5] * state.position[2]]
  const longitude = (Math.atan2(y, x) * 180) / Math.PI - gmstDegrees(jd)
  return ((longitude + 540) % 360) - 180
}
