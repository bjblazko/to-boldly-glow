import { smoothstep } from '../../math/easing'
import { SPEED_LAG_SECONDS } from './shipMotion'
import type { Leg } from './tourLeg'

// The arithmetic of a leg flown in powers of ten (see planLeg), for the tour controller.

// Roughly how long the ship still needs to its stop: while it is still pulling away, the distance
// from the stop it left doubling at the warped log rate until the approach takes over, where the
// two speeds meet; then the distance left halving at the log rate - plus the speed's lag behind the
// throttle. `fromLeft` is Infinity on a leg that didn't start from a loop.
export function arrivalSeconds(leg: Leg, { distance, fromLeft, warp }: { distance: number; fromLeft: number; warp: number }): number {
  const halvings = (from: number) => Math.log(Math.max(from / leg.loopRadius, 1)) / leg.logRate
  const handover = (fromLeft + distance) / (1 + warp)
  if (fromLeft >= handover) return halvings(distance) + SPEED_LAG_SECONDS
  return Math.log(handover / Math.max(fromLeft, 1e-12)) / (warp * leg.logRate) + halvings(warp * handover) + SPEED_LAG_SECONDS
}

// How far the ship has taken up its next stop's motion, from 0 (moving with the stop it left) to 1:
// all of it half way there, counted in doublings of the distances.
export function motionHandover(leg: Leg, { fromLeft, leftLoopRadius, distance }: { fromLeft: number; leftLoopRadius: number; distance: number }): number {
  const out = Math.log(Math.max(fromLeft / leftLoopRadius, 1))
  const remaining = Math.log(Math.max(distance / leg.loopRadius, 1))
  return smoothstep((2 * out) / Math.max(out + remaining, 1e-9))
}
