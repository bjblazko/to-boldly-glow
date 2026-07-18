import { evalVsop87Coordinate } from './vsop87'
import {
  NEPTUNE_L0, NEPTUNE_L1, NEPTUNE_L2, NEPTUNE_L3,
  NEPTUNE_B0, NEPTUNE_B1, NEPTUNE_B2, NEPTUNE_B3,
  NEPTUNE_R0, NEPTUNE_R1, NEPTUNE_R2, NEPTUNE_R3, NEPTUNE_R4,
} from './data/vsop87Neptune'

const NEPTUNE_L_ORDERS: f64[][] = [NEPTUNE_L0, NEPTUNE_L1, NEPTUNE_L2, NEPTUNE_L3]
const NEPTUNE_B_ORDERS: f64[][] = [NEPTUNE_B0, NEPTUNE_B1, NEPTUNE_B2, NEPTUNE_B3]
const NEPTUNE_R_ORDERS: f64[][] = [NEPTUNE_R0, NEPTUNE_R1, NEPTUNE_R2, NEPTUNE_R3, NEPTUNE_R4]

const TWO_PI: f64 = 2.0 * Math.PI

export function neptuneHeliocentricL(T: f64): f64 {
  let l = evalVsop87Coordinate(NEPTUNE_L_ORDERS, T) % TWO_PI
  if (l < 0.0) l += TWO_PI
  return l
}

export function neptuneHeliocentricB(T: f64): f64 {
  return evalVsop87Coordinate(NEPTUNE_B_ORDERS, T)
}

export function neptuneHeliocentricR(T: f64): f64 {
  return evalVsop87Coordinate(NEPTUNE_R_ORDERS, T)
}
