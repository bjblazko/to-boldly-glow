import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { DEPARTURE_SECONDS, TourController, type TourPacing } from '../src/camera/tourController'
import { MAX_GAZE_TURN_RATE } from '../src/camera/tour/shipView'
import { RouteItinerary } from '../src/camera/tour/tourItinerary'
import { ALL_ENTITIES, type SolarSystemEntity } from '../src/solarSystem/entities'
import { ephemerisAt, type Ephemeris } from '../src/time/ephemeris'

const PLANETS = ALL_ENTITIES.filter((entity) => entity.kind === 'planet')
const byId = (id: string) => ALL_ENTITIES.find((entity) => entity.id === id)!
const FRAME = 1 / 60
const TOUR_START = Date.parse('2026-03-20T12:00:00Z')
// The app runs the clock at 1 hr/s during a tour.
const clock = (seconds: number): Ephemeris => ephemerisAt(new Date(TOUR_START + seconds * 3_600_000))

interface Internals {
  leg: { target: SolarSystemEntity } | null
  loop: object | null
}
const internals = (controller: TourController) => controller as unknown as Internals

function gazeOf(controller: TourController): vec3 {
  const view = controller.getViewMatrix()
  return vec3.fromValues(-view[2], -view[6], -view[10])
}

// Flies frame by frame, calling `each` after every frame with the time flown so far.
function fly(controller: TourController, seconds: number, each: (t: number) => void = () => {}): void {
  for (let frame = 1; frame <= seconds * 60; frame++) {
    controller.update(FRAME, clock(frame * FRAME), 1)
    each(frame * FRAME)
  }
}

describe('leaving a planet', () => {
  it('lets go of it gently: past the loop’s own momentum, the gaze turns at a fraction of its full rate', () => {
    const controller = new TourController(PLANETS)
    controller.start({ position: [0, 25, 60] }, clock(0), 1)
    let [wasLooping, departedAt, previous, departures] = [false, -Infinity, gazeOf(controller), 0]
    let fastest = 0
    fly(controller, 400, (t) => {
      const looping = internals(controller).loop !== null
      if (wasLooping && !looping) [departedAt, departures] = [t, departures + 1]
      wasLooping = looping
      const gaze = gazeOf(controller)
      const sinceDeparture = t - departedAt
      if (sinceDeparture > 1 && sinceDeparture < DEPARTURE_SECONDS) fastest = Math.max(fastest, Math.acos(Math.min(1, vec3.dot(gaze, previous))) / FRAME)
      previous = gaze
    })
    expect(departures).toBeGreaterThanOrEqual(3)
    expect(fastest).toBeLessThan(MAX_GAZE_TURN_RATE * 0.5)
  })
})

describe('a set route', () => {
  const ROUTE = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'earth'].map(byId)

  function routeFlight(pacing?: TourPacing) {
    const events: string[] = []
    const controller = new TourController(PLANETS)
    controller.start({ position: [0, 25, 60] }, clock(0), 1, {
      itinerary: new RouteItinerary(ROUTE),
      pacing,
      listener: {
        onLegStart: (target) => events.push(`leg ${target.id}`),
        onLoopEnter: (target) => events.push(`loop ${target.id}`),
        onFinished: () => events.push('finished'),
      },
    })
    return { controller, events }
  }

  it('starts at the Sun, circles each stop in turn, and ends circling Earth', () => {
    const { controller, events } = routeFlight()
    fly(controller, 900)
    expect(events.filter((event) => event.startsWith('loop'))).toEqual(ROUTE.map((stop) => `loop ${stop.id}`))
    expect(events.at(-1)).toBe('finished')
    expect(internals(controller).leg!.target.id).toBe('earth')
    expect(internals(controller).loop).not.toBeNull()
  })

  it('leaves the Sun soon after it may - Mercury lies far above or below the Sun’s wide loop, which held the ship for another lap', () => {
    let mayLeaveAt = Infinity
    let flown = 0
    const { controller, events } = routeFlight({ pace: () => ({ transitSeconds: 15, lapSeconds: 30 }), mayDepart: () => flown >= mayLeaveAt })
    fly(controller, 120, (t) => {
      flown = t
      if (events.at(-1) === 'loop sun' && mayLeaveAt === Infinity) mayLeaveAt = t + 30
      if (events.at(-1) === 'leg mercury' && !events.includes('left')) events.push('left', `after ${Math.round(t - mayLeaveAt)}`)
    })
    const after = Number(events.find((event) => event.startsWith('after'))!.split(' ')[1])
    expect(after).toBeLessThan(12)
  })

  it('takes as long at a stop as the pace asks, and stays until it may leave', () => {
    let mayLeaveSun = false
    const { controller, events } = routeFlight({
      pace: (target) => (target.id === 'sun' ? { transitSeconds: 0, lapSeconds: 40 } : { transitSeconds: 0, lapSeconds: 0 }),
      mayDepart: (target) => target.id !== 'sun' || mayLeaveSun,
    })
    let loopEnteredAt = 0
    fly(controller, 200, (t) => {
      if (events.at(-1) === 'loop sun' && loopEnteredAt === 0) loopEnteredAt = t
    })
    expect(loopEnteredAt).toBeGreaterThan(0)
    // A 40 s lap, and held there after it.
    expect(events.at(-1)).toBe('loop sun')
    mayLeaveSun = true
    fly(controller, 40)
    expect(events).toContain('leg mercury')
  })
})
