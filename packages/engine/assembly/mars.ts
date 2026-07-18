import { evalVsop87Coordinate } from './vsop87'
import {
  MARS_L0, MARS_L1, MARS_L2, MARS_L3, MARS_L4, MARS_L5,
  MARS_B0, MARS_B1, MARS_B2, MARS_B3, MARS_B4, MARS_B5,
  MARS_R0, MARS_R1, MARS_R2, MARS_R3, MARS_R4, MARS_R5,
} from './data/vsop87Mars'

const MARS_L_ORDERS: f64[][] = [MARS_L0, MARS_L1, MARS_L2, MARS_L3, MARS_L4, MARS_L5]
const MARS_B_ORDERS: f64[][] = [MARS_B0, MARS_B1, MARS_B2, MARS_B3, MARS_B4, MARS_B5]
const MARS_R_ORDERS: f64[][] = [MARS_R0, MARS_R1, MARS_R2, MARS_R3, MARS_R4, MARS_R5]

const TWO_PI: f64 = 2.0 * Math.PI

export function marsHeliocentricL(T: f64): f64 {
  let l = evalVsop87Coordinate(MARS_L_ORDERS, T) % TWO_PI
  if (l < 0.0) l += TWO_PI
  return l
}

export function marsHeliocentricB(T: f64): f64 {
  return evalVsop87Coordinate(MARS_B_ORDERS, T)
}

export function marsHeliocentricR(T: f64): f64 {
  return evalVsop87Coordinate(MARS_R_ORDERS, T)
}
