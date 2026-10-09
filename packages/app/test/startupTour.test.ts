import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STARTUP_TOUR_DELAY_MS, scheduleStartupTour, startupTourWanted } from '../src/app/startupTour'

describe('scheduleStartupTour', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts the tour once the delay has passed, not before', () => {
    const start = vi.fn()
    scheduleStartupTour(start, () => true, new EventTarget())
    vi.advanceTimersByTime(STARTUP_TOUR_DELAY_MS - 1)
    expect(start).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(start).toHaveBeenCalledOnce()
  })

  it.each(['pointerdown', 'wheel', 'keydown'])('stays still when the user acts first (%s)', (type) => {
    const start = vi.fn()
    const input = new EventTarget()
    scheduleStartupTour(start, () => true, input)
    input.dispatchEvent(new Event(type))
    vi.advanceTimersByTime(STARTUP_TOUR_DELAY_MS)
    expect(start).not.toHaveBeenCalled()
  })

  it('stays still when by then the user is somewhere else (a lesson, a followed body)', () => {
    const start = vi.fn()
    scheduleStartupTour(start, () => false, new EventTarget())
    vi.advanceTimersByTime(STARTUP_TOUR_DELAY_MS)
    expect(start).not.toHaveBeenCalled()
  })
})

describe('startupTourWanted', () => {
  it('is wanted unless the address says ?tour=off', () => {
    expect(startupTourWanted('')).toBe(true)
    expect(startupTourWanted('?scale=compact')).toBe(true)
    expect(startupTourWanted('?tour=off')).toBe(false)
  })
})
