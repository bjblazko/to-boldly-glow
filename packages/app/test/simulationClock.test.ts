import { describe, expect, it } from 'vitest'
import { SimulationClock, shuttleValueToTimeScale, TIME_SCALE_PRESETS } from '../src/time/simulationClock'

describe('SimulationClock', () => {
  it('starts at the given initial date', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime())
  })

  it('advances simulated time by realDeltaSeconds at timeScale 1', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start, 1)
    clock.update(10)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime() + 10000)
  })

  it('does not advance while paused', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start, 1)
    clock.pause()
    clock.update(100)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime())
  })

  it('resumes advancing after play()', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start, 1)
    clock.pause()
    clock.update(100)
    clock.play()
    clock.update(5)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime() + 5000)
  })

  it('scales elapsed time by the configured timeScale', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start, 1)
    clock.setTimeScale(3600)
    clock.update(2)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime() + 2 * 3600 * 1000)
  })

  it('moves simulated time backward with a negative timeScale', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start, -1)
    clock.update(10)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime() - 10000)
  })

  it('reports whether it is paused', () => {
    const clock = new SimulationClock()
    expect(clock.isPaused()).toBe(false)
    clock.pause()
    expect(clock.isPaused()).toBe(true)
    clock.play()
    expect(clock.isPaused()).toBe(false)
  })

  it('reports the current time scale', () => {
    const clock = new SimulationClock(new Date(), 1)
    expect(clock.getTimeScale()).toBe(1)
    clock.setTimeScale(86400)
    expect(clock.getTimeScale()).toBe(86400)
  })
})

describe('TIME_SCALE_PRESETS', () => {
  it('is ordered from slowest to fastest and starts at real-time', () => {
    expect(TIME_SCALE_PRESETS[0].secondsPerSecond).toBe(1)
    for (let i = 1; i < TIME_SCALE_PRESETS.length; i++) {
      expect(TIME_SCALE_PRESETS[i].secondsPerSecond).toBeGreaterThan(TIME_SCALE_PRESETS[i - 1].secondsPerSecond)
    }
  })
})

describe('shuttleValueToTimeScale', () => {
  it('maps 0 to a stopped (zero) time scale', () => {
    expect(shuttleValueToTimeScale(0, 1000)).toBe(0)
  })

  it('maps the maximum value to the full configured rate', () => {
    expect(shuttleValueToTimeScale(100, 1000)).toBeCloseTo(1000, 5)
  })

  it('maps the minimum value to the negative full configured rate', () => {
    expect(shuttleValueToTimeScale(-100, 1000)).toBeCloseTo(-1000, 5)
  })

  it('gives small deflections a disproportionately small rate (fine control near center)', () => {
    const halfway = shuttleValueToTimeScale(50, 1000)
    expect(halfway).toBeLessThan(500) // cubic easing: less than half of max at half deflection
    expect(halfway).toBeGreaterThan(0)
  })

  it('preserves sign for negative input', () => {
    expect(shuttleValueToTimeScale(-50, 1000)).toBeLessThan(0)
  })
})
