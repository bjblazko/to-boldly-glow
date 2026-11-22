import { describe, expect, it } from 'vitest'
import { setTourTime, TOUR_SECONDS_PER_SECOND } from '../src/camera/tour/tourTime'
import { SimulationClock } from '../src/time/simulationClock'

describe('the clock on a tour', () => {
  it('runs the narrated tour at its own pace, whatever rate the user had set', () => {
    for (const rate of [-86_400, 0.5, 31_556_952]) {
      const clock = new SimulationClock(new Date(), rate)
      clock.pause()
      setTourTime(clock, { narrated: true })
      expect(clock.getTimeScale()).toBe(TOUR_SECONDS_PER_SECOND)
      expect(clock.isPaused()).toBe(false)
    }
  })

  it('keeps a rate the user picked for the sightseeing tour, but speeds up a paused or real-time clock', () => {
    const fast = new SimulationClock(new Date(), 86_400)
    setTourTime(fast, { narrated: false })
    expect(fast.getTimeScale()).toBe(86_400)
    const real = new SimulationClock(new Date(), 1)
    setTourTime(real, { narrated: false })
    expect(real.getTimeScale()).toBe(TOUR_SECONDS_PER_SECOND)
  })
})
