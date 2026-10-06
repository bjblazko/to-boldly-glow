import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { ACCELERATION_SECONDS, TourController } from '../src/camera/tourController'
import { THRUST_RESPONSE_SECONDS } from '../src/camera/tour/shipMotion'
import { MAX_BANK_RADIANS, MAX_GAZE_TURN_ACCELERATION, MAX_GAZE_TURN_RATE } from '../src/camera/tour/shipView'
import { planetPosition } from '../src/camera/tour/tourLeg'
import { EasedTween } from '../src/math/easedTween'
import { ALL_ENTITIES, type SolarSystemEntity } from '../src/solarSystem/entities'
import { ephemerisAt, type Ephemeris } from '../src/time/ephemeris'

const PLANET_ENTITIES: SolarSystemEntity[] = ALL_ENTITIES.filter((e) => e.kind === 'planet')
const J2000: Ephemeris = { julianMillennia: 0, daysSinceEpoch: 0 }
const COMPACT = 1
const REALISTIC = 0
const FRAME = 1 / 60

interface TourInternals {
  speed: number
  leg: { target: SolarSystemEntity; cruiseSpeed: number; loopRadius: number } | null
  loop: object | null
  throttle: { thrust: number }
  view: { look: { angularVelocity: vec3 } }
}

function internals(controller: TourController): TourInternals {
  return controller as unknown as TourInternals
}

function startedTour(start: [number, number, number] = [0, 0, 0]): TourController {
  const controller = new TourController(PLANET_ENTITIES)
  controller.start({ position: start }, J2000, COMPACT)
  return controller
}

// Runs the tour in fixed steps, recording every target it commits to, in order.
function runTour(controller: TourController, simulatedSeconds: number, stepSeconds = 0.1): string[] {
  const targets: string[] = []
  for (let i = 0; i < Math.round(simulatedSeconds / stepSeconds); i++) {
    controller.update(stepSeconds, J2000, COMPACT)
    const id = internals(controller).leg?.target.id
    if (id && id !== targets.at(-1)) targets.push(id)
  }
  return targets
}

function viewAxes(controller: TourController) {
  const view = controller.getViewMatrix()
  return {
    right: vec3.fromValues(view[0], view[4], view[8]),
    up: vec3.fromValues(view[1], view[5], view[9]),
    forward: vec3.fromValues(-view[2], -view[6], -view[10]),
  }
}

// The roll around the line of sight, measured against a level horizon.
function rollRadians(axes: ReturnType<typeof viewAxes>): number {
  return Math.asin(Math.min(1, Math.abs(axes.right[2]) / Math.max(Math.hypot(axes.forward[0], axes.forward[1]), 1e-9)))
}

// The app runs the clock at 1 hr/s during a tour (see app.ts), so the planets move on as they do there.
const TOUR_START = Date.parse('2026-03-20T12:00:00Z')
function tourClock(seconds: number): Ephemeris {
  return ephemerisAt(new Date(TOUR_START + seconds * 3_600_000))
}

interface Flight {
  loops: number
  givenUp: string[]
  // How far the ship strayed from its loop radius while circling (1 = right on it).
  loopDistanceRange: [number, number]
}

// Flies the tour with the clock running, switching the scale (eased, as the app does) at the given
// times, and records each planet it circled or gave up on.
function flyTour(seconds: number, startScale: number, scaleSwitches: Array<[number, number]> = []): Flight {
  const controller = new TourController(PLANET_ENTITIES)
  const scale = new EasedTween(startScale)
  let blend = startScale
  controller.start({ position: [0, 25, 60] }, tourClock(0), blend)
  const flight: Flight = { loops: 0, givenUp: [], loopDistanceRange: [1, 1] }
  let [target, looped] = [internals(controller).leg!.target.id, false]
  for (let frame = 0; frame < seconds * 60; frame++) {
    const switchTo = scaleSwitches.find(([at]) => Math.round(at * 60) === frame)
    if (switchTo) scale.retarget(switchTo[1], blend)
    if (scale.isAnimating) blend = scale.update(FRAME)
    controller.update(FRAME, tourClock(frame * FRAME), blend)
    const { leg, loop } = internals(controller)
    if (leg!.target.id !== target) {
      if (looped) flight.loops++
      else flight.givenUp.push(target)
      ;[target, looped] = [leg!.target.id, false]
    }
    if (loop) {
      looped = true
      const distance = vec3.distance(vec3.fromValues(...controller.getEyePosition()), planetPosition(leg!.target, tourClock(frame * FRAME), blend))
      const ratio = distance / leg!.loopRadius
      flight.loopDistanceRange = [Math.min(flight.loopDistanceRange[0], ratio), Math.max(flight.loopDistanceRange[1], ratio)]
    }
  }
  return flight
}

describe('TourController', () => {
  it('visits every planet once in the first pass', () => {
    const firstPass = runTour(startedTour(), 720).slice(0, PLANET_ENTITIES.length)
    expect(new Set(firstPass).size).toBe(PLANET_ENTITIES.length)
  })

  it('keeps making progress across passes, never re-picking the planet it just left', () => {
    const targets = runTour(startedTour(), 1800)
    expect(targets.length).toBeGreaterThanOrEqual(PLANET_ENTITIES.length * 2)
    for (let i = 1; i < targets.length; i++) expect(targets[i]).not.toBe(targets[i - 1])
  })

  it('stays finite throughout a long flight', () => {
    const controller = startedTour()
    for (let i = 0; i < 7200; i++) {
      controller.update(0.1, J2000, COMPACT)
      for (const value of [...controller.getEyePosition(), ...controller.getViewMatrix()]) expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('flies like a ship at 60 fps: no teleports, bounded acceleration, gaze turn rate and banking', () => {
    const controller = startedTour()
    const dt = 1 / 60
    let previousEye = controller.getEyePosition()
    let previousSpeed = internals(controller).speed
    let previous = viewAxes(controller)
    const worst = { stepRatio: 0, acceleration: 0, gazeTurnRate: 0, roll: 0, rollRate: 0 }
    for (let i = 0; i < 60 * 300; i++) {
      const engine = internals(controller).leg!.cruiseSpeed / ACCELERATION_SECONDS
      controller.update(dt, J2000, COMPACT)
      const eye = controller.getEyePosition()
      const { speed } = internals(controller)
      const step = Math.hypot(eye[0] - previousEye[0], eye[1] - previousEye[1], eye[2] - previousEye[2])
      worst.stepRatio = Math.max(worst.stepRatio, step / Math.max(speed * dt, 1e-9))
      // Relative to the leg's own engine (legs are scaled to their length).
      worst.acceleration = Math.max(worst.acceleration, Math.abs(speed - previousSpeed) / dt / engine)
      const axes = viewAxes(controller)
      worst.gazeTurnRate = Math.max(worst.gazeTurnRate, Math.acos(Math.min(1, vec3.dot(axes.forward, previous.forward))) / dt)
      worst.roll = Math.max(worst.roll, rollRadians(axes))
      worst.rollRate = Math.max(worst.rollRate, Math.abs(rollRadians(axes) - rollRadians(previous)) / dt)
      ;[previousEye, previousSpeed, previous] = [eye, speed, axes]
    }
    expect(worst.stepRatio).toBeLessThan(1.05)
    expect(worst.acceleration).toBeLessThan(1.05)
    expect(worst.gazeTurnRate).toBeLessThanOrEqual(MAX_GAZE_TURN_RATE * 1.01)
    expect(worst.roll).toBeLessThanOrEqual(MAX_BANK_RADIANS * 1.05)
    expect(worst.rollRate).toBeLessThan(1)
  })

  it('starts at rest and accelerates gradually', () => {
    const controller = startedTour([30, 40, 5])
    expect(internals(controller).speed).toBe(0)
    controller.update(1, J2000, COMPACT)
    const { speed, leg } = internals(controller)
    expect(speed).toBeGreaterThan(0)
    expect(speed).toBeLessThanOrEqual((leg!.cruiseSpeed / ACCELERATION_SECONDS) * 1.001)
  })

  it('picks up from the given start position and view direction instead of cutting to a new view', () => {
    const controller = new TourController(PLANET_ENTITIES)
    const forward: [number, number, number] = [0.6, -0.8, 0]
    controller.start({ position: [30, 40, 5], forward }, J2000, COMPACT)
    expect(controller.getEyePosition()).toEqual([30, 40, 5])
    const axes = viewAxes(controller)
    for (let i = 0; i < 3; i++) expect(axes.forward[i]).toBeCloseTo(forward[i], 5)
  })

  it('keeps a level horizon around ecliptic north while flying straight', () => {
    const controller = new TourController(PLANET_ENTITIES)
    controller.start({ position: [30, 40, 5], forward: [0.6, -0.8, 0] }, J2000, COMPACT)
    const axes = viewAxes(controller)
    expect(axes.right[2]).toBeCloseTo(0, 6)
    expect(axes.up[2]).toBeCloseTo(1, 6)
  })

  // At Realistic scale the planets are tiny and the inner ones orbit faster than a ship circling
  // them at loop speed: it has to match their motion to catch them at all.
  it('circles one planet after another at Realistic scale, catching even the fast inner planets', () => {
    const flight = flyTour(400, REALISTIC)
    expect(flight.givenUp).toEqual([])
    expect(flight.loops).toBeGreaterThanOrEqual(6)
  })

  it('carries on across scale switches in either direction, mid-flight and mid-loop', () => {
    for (const [startScale, switches] of [
      [COMPACT, [[30, REALISTIC]]],
      [REALISTIC, [[30, COMPACT]]],
      [COMPACT, [[15, REALISTIC], [60, COMPACT], [100, REALISTIC]]],
    ] as Array<[number, Array<[number, number]>]>) {
      const flight = flyTour(300, startScale, switches)
      expect(flight.givenUp).toEqual([])
      expect(flight.loops).toBeGreaterThanOrEqual(5)
      // Circling a planet while the scale changes, the ship keeps its distance in planet radii.
      expect(flight.loopDistanceRange[0]).toBeGreaterThan(0.95)
      expect(flight.loopDistanceRange[1]).toBeLessThan(1.05)
    }
  })

  it('turns and changes speed with inertia: no jolt when a turn or a burn starts, stops or reverses', () => {
    const controller = new TourController(PLANET_ENTITIES)
    controller.start({ position: [0, 25, 60] }, tourClock(0), COMPACT)
    let previousTurn = vec3.clone(internals(controller).view.look.angularVelocity)
    let previousThrust = internals(controller).throttle.thrust
    const worst = { gazeTurnAcceleration: 0, jerk: 0 }
    for (let frame = 0; frame < 60 * 300; frame++) {
      const engine = internals(controller).leg!.cruiseSpeed / ACCELERATION_SECONDS
      controller.update(FRAME, tourClock(frame * FRAME), COMPACT)
      const { view, throttle, loop } = internals(controller)
      worst.gazeTurnAcceleration = Math.max(worst.gazeTurnAcceleration, vec3.distance(view.look.angularVelocity, previousTurn) / FRAME)
      // Relative to the leg's own engine (legs are scaled to their length); the loop is scripted.
      if (!loop) worst.jerk = Math.max(worst.jerk, (Math.abs(throttle.thrust - previousThrust) / FRAME / engine) * THRUST_RESPONSE_SECONDS)
      ;[previousTurn, previousThrust] = [vec3.clone(view.look.angularVelocity), throttle.thrust]
    }
    expect(worst.gazeTurnAcceleration).toBeLessThanOrEqual(MAX_GAZE_TURN_ACCELERATION * 1.001)
    expect(worst.jerk).toBeLessThanOrEqual(1.001)
  })

  // The clock can run at any rate, stand still, or jump to another date: the tour flies on.
  it('flies on through jumps in the simulated time, forward and back', () => {
    const controller = new TourController(PLANET_ENTITIES)
    controller.start({ position: [0, 25, 60] }, tourClock(0), COMPACT)
    const jumps = new Map([[40 * 60, 2_000], [90 * 60, -5_000], [150 * 60, 30_000]])
    let [clockOffset, previousEye, worstStep] = [0, controller.getEyePosition(), 0]
    const targets = new Set<string>()
    for (let frame = 0; frame < 60 * 240; frame++) {
      clockOffset += jumps.get(frame) ?? 0
      controller.update(FRAME, tourClock(frame * FRAME + clockOffset), COMPACT)
      const eye = controller.getEyePosition()
      for (const value of eye) expect(Number.isFinite(value)).toBe(true)
      if (!jumps.has(frame)) worstStep = Math.max(worstStep, Math.hypot(eye[0] - previousEye[0], eye[1] - previousEye[1], eye[2] - previousEye[2]))
      targets.add(internals(controller).leg!.target.id)
      previousEye = eye
    }
    // Never faster than the fastest leg's cruise speed (about 10 units/s in Compact) on a frame without a jump.
    expect(worstStep / FRAME).toBeLessThan(15)
    expect(targets.size).toBeGreaterThanOrEqual(6)
  })
})
