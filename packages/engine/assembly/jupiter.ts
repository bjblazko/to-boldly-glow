import { evalVsop87Coordinate } from './vsop87'
import {
  JUPITER_L0, JUPITER_L1, JUPITER_L2, JUPITER_L3, JUPITER_L4, JUPITER_L5,
  JUPITER_B0, JUPITER_B1, JUPITER_B2, JUPITER_B3, JUPITER_B4, JUPITER_B5,
  JUPITER_R0, JUPITER_R1, JUPITER_R2, JUPITER_R3, JUPITER_R4, JUPITER_R5,
} from './data/vsop87Jupiter'

const JUPITER_L_ORDERS: f64[][] = [JUPITER_L0, JUPITER_L1, JUPITER_L2, JUPITER_L3, JUPITER_L4, JUPITER_L5]
const JUPITER_B_ORDERS: f64[][] = [JUPITER_B0, JUPITER_B1, JUPITER_B2, JUPITER_B3, JUPITER_B4, JUPITER_B5]
const JUPITER_R_ORDERS: f64[][] = [JUPITER_R0, JUPITER_R1, JUPITER_R2, JUPITER_R3, JUPITER_R4, JUPITER_R5]

const TWO_PI: f64 = 2.0 * Math.PI

// T: Julian millennia since J2000.0 (see julianMillenniaSinceJ2000 in time.ts).
// Returns heliocentric ecliptic longitude in radians, normalized to [0, 2*PI).
export function jupiterHeliocentricL(T: f64): f64 {
  let l = evalVsop87Coordinate(JUPITER_L_ORDERS, T) % TWO_PI
  if (l < 0.0) l += TWO_PI
  return l
}

// Returns heliocentric ecliptic latitude in radians.
export function jupiterHeliocentricB(T: f64): f64 {
  return evalVsop87Coordinate(JUPITER_B_ORDERS, T)
}

// Returns heliocentric distance in astronomical units (AU).
export function jupiterHeliocentricR(T: f64): f64 {
  return evalVsop87Coordinate(JUPITER_R_ORDERS, T)
}
