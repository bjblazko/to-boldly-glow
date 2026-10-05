import { mat4, vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { TourController } from '../src/camera/tourController'
import { ALL_ENTITIES, type SolarSystemEntity } from '../src/solarSystem/entities'
import { ECLIPTIC_NORTH } from '../src/solarSystem/poleOrientation'

const PLANET_ENTITIES: SolarSystemEntity[] = ALL_ENTITIES.filter((e) => e.kind === 'planet')

// Runs the tour for `simulatedSeconds` of real time in small fixed steps, recording every distinct
// target the controller commits to (in order) by sampling its private currentTarget between steps.
function runTour(controller: TourController, simulatedSeconds: number, T: number, daysSinceEpoch: number, scaleBlend: number): string[] {
  const stepSeconds = 0.1
  const steps = Math.round(simulatedSeconds / stepSeconds)
  const targetSequence: string[] = []
  let lastTargetId: string | null = null
  for (let i = 0; i < steps; i++) {
    controller.update(stepSeconds, T, daysSinceEpoch, scaleBlend)
    const currentId = (controller as unknown as { currentTarget: SolarSystemEntity | null }).currentTarget?.id ?? null
    if (currentId && currentId !== lastTargetId) {
      targetSequence.push(currentId)
      lastTargetId = currentId
    }
  }
  return targetSequence
}

describe('TourController', () => {
  it('visits every planet at least once within the first pass, never re-picking the same target twice before the pass completes', () => {
    const controller = new TourController(PLANET_ENTITIES)
    controller.start([0, 0, 0], 0, 0, 1)
    // Generous ceiling for the whole 8-planet pass: worst case every leg burns its full
    // MAX_APPROACH_SECONDS (45s) giving up, so 8 * 45s = 360s is already a safety-net upper bound;
    // double it for margin without making the test slow.
    const sequence = runTour(controller, 720, 0, 0, 1)

    const firstPass = sequence.slice(0, PLANET_ENTITIES.length)
    const uniqueInFirstPass = new Set(firstPass)
    expect(firstPass).toHaveLength(PLANET_ENTITIES.length)
    expect(uniqueInFirstPass.size).toBe(PLANET_ENTITIES.length)
    for (const planet of PLANET_ENTITIES) {
      expect(uniqueInFirstPass.has(planet.id)).toBe(true)
    }
  })

  it('keeps making progress (never stalls on one target) across multiple passes', () => {
    const controller = new TourController(PLANET_ENTITIES)
    controller.start([0, 0, 0], 0, 0, 1)
    const sequence = runTour(controller, 1800, 0, 0, 1)

    // At ~20s/leg cruise plus a 6s loop, 1800s should comfortably cover at least two full passes
    // (16 target changes) if the controller is making real progress rather than oscillating.
    expect(sequence.length).toBeGreaterThanOrEqual(PLANET_ENTITIES.length * 2)

    // No target should ever repeat back-to-back in the recorded sequence (that would mean the
    // controller "gave up" and immediately re-picked the very same planet).
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]).not.toBe(sequence[i - 1])
    }
  })

  it('produces a finite (non-NaN) position and view matrix throughout an entire pass, even as heading passes near the ecliptic-north axis', () => {
    const controller = new TourController(PLANET_ENTITIES)
    controller.start([0, 0, 0], 0, 0, 1)
    const stepSeconds = 0.1
    for (let i = 0; i < 7200; i++) {
      controller.update(stepSeconds, 0, 0, 1)
      const eye = controller.getEyePosition()
      for (const component of eye) expect(Number.isFinite(component)).toBe(true)
      const view = controller.getViewMatrix()
      for (const value of view) expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('never teleports or snaps the view between frames across two full passes at 60fps', () => {
    // Regression test: entering a loop used to jump the camera 0.2-0.55 loop radii in one frame
    // (to a fixed point on the loop circle), the vertical loop flipped the view ~95 degrees in one
    // frame passing over each planet's pole, and the look-at point could sweep through the camera
    // when a loop ended.
    const controller = new TourController(PLANET_ENTITIES)
    controller.start([0, 0, 0], 0, 0, 1)
    const dt = 1 / 60
    let previousEye = controller.getEyePosition()
    let previousForward: vec3 | null = null
    let maxStepRatio = 0
    let maxTurnDegrees = 0
    for (let i = 0; i < 60 * 400; i++) {
      controller.update(dt, 0, 0, 1)
      const eye = controller.getEyePosition()
      const step = Math.hypot(eye[0] - previousEye[0], eye[1] - previousEye[1], eye[2] - previousEye[2])
      const speed = (controller as unknown as { speed: number }).speed
      maxStepRatio = Math.max(maxStepRatio, step / Math.max(speed * dt, 1e-9))
      previousEye = eye

      const view = controller.getViewMatrix()
      const right = vec3.fromValues(view[0], view[4], view[8])
      const forward = vec3.fromValues(-view[2], -view[6], -view[10])
      if (previousForward) {
        const turn = Math.acos(Math.min(1, vec3.dot(forward, previousForward)))
        maxTurnDegrees = Math.max(maxTurnDegrees, (turn * 180) / Math.PI)
      }
      // A roll flip shows up as the right vector leaving the horizontal plane or reversing.
      expect(Math.abs(right[2])).toBeLessThan(0.05)
      previousForward = forward
    }
    expect(maxStepRatio).toBeLessThan(1.1)
    expect(maxTurnDegrees).toBeLessThan(10)
  })

  it('picks up from the given start position and view direction instead of cutting to a new view', () => {
    const controller = new TourController(PLANET_ENTITIES)
    const startForward: [number, number, number] = [0.6, -0.8, 0]
    controller.start([30, 40, 5], 0, 0, 1, startForward)
    expect(controller.getEyePosition()).toEqual([30, 40, 5])
    const view = controller.getViewMatrix()
    expect(-view[2]).toBeCloseTo(startForward[0], 6)
    expect(-view[6]).toBeCloseTo(startForward[1], 6)
    expect(-view[10]).toBeCloseTo(startForward[2], 6)
  })

  it('orients its view matrix consistently with the rest of the app (ECLIPTIC_NORTH), not a hardcoded world-Y up', () => {
    // Regression test for the reported "90 degree flipped" tour bug: TourController used to build
    // its view matrix (and its loop/lookAt basis) off a hardcoded [0, 1, 0] world-Y up-vector while
    // every other camera in the app (OrbitCamera, and the fly-camera handoff on tour stop) orients
    // off ECLIPTIC_NORTH ([0, 0, 1] - see poleOrientation.ts and
    // docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md). Verify by placing
    // the camera on the ecliptic-north axis itself, looking straight down at the origin: with a
    // correct ECLIPTIC_NORTH up-vector, mat4.lookAt's own up/forward degeneracy check kicks in
    // (forward is parallel to up) and it falls back to an axis-aligned matrix rather than producing
    // a matrix built from an arbitrary, unrelated up-vector.
    const controller = new TourController(PLANET_ENTITIES)
    controller.start([0, 0, 0], 0, 0, 1)
    // Force the camera directly onto the ecliptic-north axis, looking straight down at the origin -
    // only degenerate (forward ∥ up) for a genuinely ECLIPTIC_NORTH-based up-vector.
    const eye = (controller as unknown as { position: vec3 }).position
    vec3.set(eye, ...ECLIPTIC_NORTH.map((c) => c * 10))
    ;(controller as unknown as { lookAt: [number, number, number] }).lookAt = [0, 0, 0]

    const referenceView = mat4.lookAt(mat4.create(), eye, [0, 0, 0], vec3.fromValues(...ECLIPTIC_NORTH))
    const actualView = controller.getViewMatrix()
    for (let i = 0; i < 16; i++) {
      expect(actualView[i]).toBeCloseTo(referenceView[i], 6)
    }
  })
})
