import { evalVsop87Coordinate } from './vsop87'
import {
  URANUS_L0, URANUS_L1, URANUS_L2, URANUS_L3, URANUS_L4,
  URANUS_B0, URANUS_B1, URANUS_B2, URANUS_B3,
  URANUS_R0, URANUS_R1, URANUS_R2, URANUS_R3, URANUS_R4,
} from './data/vsop87Uranus'

const URANUS_L_ORDERS: f64[][] = [URANUS_L0, URANUS_L1, URANUS_L2, URANUS_L3, URANUS_L4]
const URANUS_B_ORDERS: f64[][] = [URANUS_B0, URANUS_B1, URANUS_B2, URANUS_B3]
const URANUS_R_ORDERS: f64[][] = [URANUS_R0, URANUS_R1, URANUS_R2, URANUS_R3, URANUS_R4]

const TWO_PI: f64 = 2.0 * Math.PI

// T: Julian millennia since J2000.0 (see julianMillenniaSinceJ2000 in time.ts).
// Returns heliocentric ecliptic longitude in radians, normalized to [0, 2*PI).
export function uranusHeliocentricL(T: f64): f64 {
  let l = evalVsop87Coordinate(URANUS_L_ORDERS, T) % TWO_PI
  if (l < 0.0) l += TWO_PI
  return l
}

// Returns heliocentric ecliptic latitude in radians.
export function uranusHeliocentricB(T: f64): f64 {
  return evalVsop87Coordinate(URANUS_B_ORDERS, T)
}

// Returns heliocentric distance in astronomical units (AU).
export function uranusHeliocentricR(T: f64): f64 {
  return evalVsop87Coordinate(URANUS_R_ORDERS, T)
}
