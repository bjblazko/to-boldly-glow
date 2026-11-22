import type { SimulationClock } from '../../time/simulationClock'

// 1 hr/s: fast enough to see the planets turn and their moons move during a flyby.
export const TOUR_SECONDS_PER_SECOND = 3600

// A paused or real-time clock shows no visible spin or moon motion during a flyby, so a tour speeds
// it up. The narrated tour always flies at its own pace: at a rate the user had set (a year a
// second, say) the inner planets race round the Sun faster than the ship can catch them.
export function setTourTime(clock: SimulationClock, { narrated }: { narrated: boolean }): void {
  if (!narrated && !clock.isPaused() && clock.getTimeScale() !== 1) return
  clock.play()
  clock.setTimeScale(TOUR_SECONDS_PER_SECOND)
}
