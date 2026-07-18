import { evalVsop87Coordinate } from './vsop87'
import {
  VENUS_L0, VENUS_L1, VENUS_L2, VENUS_L3, VENUS_L4, VENUS_L5,
  VENUS_B0, VENUS_B1, VENUS_B2, VENUS_B3, VENUS_B4, VENUS_B5,
  VENUS_R0, VENUS_R1, VENUS_R2, VENUS_R3, VENUS_R4, VENUS_R5,
} from './data/vsop87Venus'

const VENUS_L_ORDERS: f64[][] = [VENUS_L0, VENUS_L1, VENUS_L2, VENUS_L3, VENUS_L4, VENUS_L5]
const VENUS_B_ORDERS: f64[][] = [VENUS_B0, VENUS_B1, VENUS_B2, VENUS_B3, VENUS_B4, VENUS_B5]
const VENUS_R_ORDERS: f64[][] = [VENUS_R0, VENUS_R1, VENUS_R2, VENUS_R3, VENUS_R4, VENUS_R5]

const TWO_PI: f64 = 2.0 * Math.PI

export function venusHeliocentricL(T: f64): f64 {
  let l = evalVsop87Coordinate(VENUS_L_ORDERS, T) % TWO_PI
  if (l < 0.0) l += TWO_PI
  return l
}

export function venusHeliocentricB(T: f64): f64 {
  return evalVsop87Coordinate(VENUS_B_ORDERS, T)
}

export function venusHeliocentricR(T: f64): f64 {
  return evalVsop87Coordinate(VENUS_R_ORDERS, T)
}
