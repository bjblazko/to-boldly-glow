import { evalVsop87Coordinate } from './vsop87'
import {
  EARTH_L0, EARTH_L1, EARTH_L2, EARTH_L3, EARTH_L4, EARTH_L5,
  EARTH_B0, EARTH_B1, EARTH_B2, EARTH_B3, EARTH_B4, EARTH_B5,
  EARTH_R0, EARTH_R1, EARTH_R2, EARTH_R3, EARTH_R4, EARTH_R5,
} from './data/vsop87Earth'

const EARTH_L_ORDERS: f64[][] = [EARTH_L0, EARTH_L1, EARTH_L2, EARTH_L3, EARTH_L4, EARTH_L5]
const EARTH_B_ORDERS: f64[][] = [EARTH_B0, EARTH_B1, EARTH_B2, EARTH_B3, EARTH_B4, EARTH_B5]
const EARTH_R_ORDERS: f64[][] = [EARTH_R0, EARTH_R1, EARTH_R2, EARTH_R3, EARTH_R4, EARTH_R5]

const TWO_PI: f64 = 2.0 * Math.PI

// T: Julian millennia since J2000.0 (see julianMillenniaSinceJ2000 in time.ts).
// Returns heliocentric ecliptic longitude in radians, normalized to [0, 2*PI).
export function earthHeliocentricL(T: f64): f64 {
  let l = evalVsop87Coordinate(EARTH_L_ORDERS, T) % TWO_PI
  if (l < 0.0) l += TWO_PI
  return l
}

// Returns heliocentric ecliptic latitude in radians.
export function earthHeliocentricB(T: f64): f64 {
  return evalVsop87Coordinate(EARTH_B_ORDERS, T)
}

// Returns heliocentric distance in astronomical units (AU).
export function earthHeliocentricR(T: f64): f64 {
  return evalVsop87Coordinate(EARTH_R_ORDERS, T)
}
