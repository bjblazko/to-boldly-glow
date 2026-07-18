import { evalVsop87Coordinate } from './vsop87'
import {
  MERCURY_L0, MERCURY_L1, MERCURY_L2, MERCURY_L3, MERCURY_L4, MERCURY_L5,
  MERCURY_B0, MERCURY_B1, MERCURY_B2, MERCURY_B3, MERCURY_B4, MERCURY_B5,
  MERCURY_R0, MERCURY_R1, MERCURY_R2, MERCURY_R3, MERCURY_R4, MERCURY_R5,
} from './data/vsop87Mercury'

const MERCURY_L_ORDERS: f64[][] = [MERCURY_L0, MERCURY_L1, MERCURY_L2, MERCURY_L3, MERCURY_L4, MERCURY_L5]
const MERCURY_B_ORDERS: f64[][] = [MERCURY_B0, MERCURY_B1, MERCURY_B2, MERCURY_B3, MERCURY_B4, MERCURY_B5]
const MERCURY_R_ORDERS: f64[][] = [MERCURY_R0, MERCURY_R1, MERCURY_R2, MERCURY_R3, MERCURY_R4, MERCURY_R5]

const TWO_PI: f64 = 2.0 * Math.PI

// T: Julian millennia since J2000.0 (see julianMillenniaSinceJ2000 in time.ts).
// Returns heliocentric ecliptic longitude in radians, normalized to [0, 2*PI).
export function mercuryHeliocentricL(T: f64): f64 {
  let l = evalVsop87Coordinate(MERCURY_L_ORDERS, T) % TWO_PI
  if (l < 0.0) l += TWO_PI
  return l
}

// Returns heliocentric ecliptic latitude in radians.
export function mercuryHeliocentricB(T: f64): f64 {
  return evalVsop87Coordinate(MERCURY_B_ORDERS, T)
}

// Returns heliocentric distance in astronomical units (AU).
export function mercuryHeliocentricR(T: f64): f64 {
  return evalVsop87Coordinate(MERCURY_R_ORDERS, T)
}
