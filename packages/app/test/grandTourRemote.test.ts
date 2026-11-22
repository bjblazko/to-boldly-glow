import { describe, expect, it } from 'vitest'
import { GRAND_TOUR } from '../src/camera/tour/grandTour'
import { GrandTourRemote } from '../src/narration/grandTourRemote'

function remote(at = 3) {
  const log: string[] = []
  const state = { stop: at, clockPaused: false, tourPaused: false, voicePaused: false }
  const r = new GrandTourRemote({
    narrator: { get stopIndex() { return state.stop }, seek: (stop) => log.push(`narrator ${stop}`), setPaused: (p) => (state.voicePaused = p) },
    itinerary: { seek: (stop) => log.push(`route ${stop}`) },
    tour: { redirect: () => log.push('redirect'), setPaused: (p) => (state.tourPaused = p) },
    clock: { isPaused: () => state.clockPaused, pause: () => (state.clockPaused = true), play: () => (state.clockPaused = false) },
  })
  return { r, log, state }
}

describe('the grand tour’s back, next and pause', () => {
  it('flies on to the next stop, or back to the one before, with the narrator', () => {
    const { r, log } = remote(3)
    r.next()
    expect(log).toEqual(['route 4', 'narrator 4', 'redirect'])
    log.length = 0
    r.previous()
    expect(log).toEqual(['route 2', 'narrator 2', 'redirect'])
  })

  it('goes no further than the first and the last stop', () => {
    expect(remote(0).r.canGoBack).toBe(false)
    const last = remote(GRAND_TOUR.length - 1)
    expect(last.r.canGoOn).toBe(false)
    last.r.next()
    expect(last.log).toEqual([])
  })

  it('holds the ship, the voice and the clock while paused, and lets them go on together', () => {
    const { r, state } = remote()
    r.togglePause()
    expect(r.paused).toBe(true)
    expect(state).toMatchObject({ clockPaused: true, tourPaused: true, voicePaused: true })
    r.togglePause()
    expect(state).toMatchObject({ clockPaused: false, tourPaused: false, voicePaused: false })
  })

  it('leaves a clock the user had paused paused', () => {
    const { r, state } = remote()
    state.clockPaused = true
    r.togglePause()
    r.togglePause()
    expect(state.clockPaused).toBe(true)
  })

  it('carries on when told to skip while paused', () => {
    const { r, state } = remote()
    r.togglePause()
    r.next()
    expect(r.paused).toBe(false)
    expect(state.tourPaused).toBe(false)
  })
})
