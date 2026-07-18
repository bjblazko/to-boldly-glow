import { evalVsop87Coordinate } from './vsop87'
import {
  SATURN_L0, SATURN_L1, SATURN_L2, SATURN_L3, SATURN_L4, SATURN_L5,
  SATURN_B0, SATURN_B1, SATURN_B2, SATURN_B3, SATURN_B4, SATURN_B5,
  SATURN_R0, SATURN_R1, SATURN_R2, SATURN_R3, SATURN_R4, SATURN_R5,
} from './data/vsop87Saturn'

const SATURN_L_ORDERS: f64[][] = [SATURN_L0, SATURN_L1, SATURN_L2, SATURN_L3, SATURN_L4, SATURN_L5]
const SATURN_B_ORDERS: f64[][] = [SATURN_B0, SATURN_B1, SATURN_B2, SATURN_B3, SATURN_B4, SATURN_B5]
const SATURN_R_ORDERS: f64[][] = [SATURN_R0, SATURN_R1, SATURN_R2, SATURN_R3, SATURN_R4, SATURN_R5]

const TWO_PI: f64 = 2.0 * Math.PI

export function saturnHeliocentricL(T: f64): f64 {
  let l = evalVsop87Coordinate(SATURN_L_ORDERS, T) % TWO_PI
  if (l < 0.0) l += TWO_PI
  return l
}

export function saturnHeliocentricB(T: f64): f64 {
  return evalVsop87Coordinate(SATURN_B_ORDERS, T)
}

export function saturnHeliocentricR(T: f64): f64 {
  return evalVsop87Coordinate(SATURN_R_ORDERS, T)
}
