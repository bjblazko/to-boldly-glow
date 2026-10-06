import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { ACCELERATION_SECONDS, TourController } from '../src/camera/tourController'
import { MAX_BANK_RADIANS, MAX_GAZE_TURN_RATE } from '../src/camera/tour/shipView'
import { ALL_ENTITIES, type SolarSystemEntity } from '../src/solarSystem/entities'
import type { Ephemeris } from '../src/time/ephemeris'

const PLANET_ENTITIES: SolarSystemEntity[] = ALL_ENTITIES.filter((e) => e.kind === 'planet')
const J2000: Ephemeris = { julianMillennia: 0, daysSinceEpoch: 0 }
const COMPACT = 1

interface TourInternals {
  speed: number
  leg: { target: SolarSystemEntity; cruiseSpeed: number } | null
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
    expect(worst.gazeTurnRate).toBeLessThanOrEqual(MAX_GAZE_TURN_RATE * 1.001)
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
})
