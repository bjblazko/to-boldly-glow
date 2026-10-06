import { describe, expect, it } from 'vitest'
import { minOrbitRadiusForBlend, OrbitCamera, orbitBasisForUpAxis } from '../src/camera/orbitCamera'
import { CameraFollowController, defaultFramingAzimuth, interpolateUpAxis } from '../src/camera/cameraFollow'
import { easeInOutCubic } from '../src/math/easing'
import { ALL_ENTITIES, entityPoleDirection, entityWorldPosition } from '../src/solarSystem/entities'
import { ECLIPTIC_NORTH, equatorialToEclipticPoleDirection } from '../src/solarSystem/poleOrientation'
import { AU_KM } from '../src/solarSystem/bodies'
import { scaledBodyRadiusUnits } from '../src/solarSystem/sceneScale'

function findEntity(id: string) {
  const entity = ALL_ENTITIES.find((e) => e.id === id)
  if (!entity) throw new Error(`no entity ${id}`)
  return entity
}

// Steps `update` in small increments totaling well past the fly-to duration, so the tween is
// guaranteed to have completed and the controller has moved into the persistent-lock state.
function runPastFlyTo(controller: CameraFollowController, T: number, daysSinceEpoch: number, scaleBlend: number) {
  for (let i = 0; i < 40; i++) {
    controller.update(0.1, T, daysSinceEpoch, scaleBlend)
  }
}

describe('defaultFramingAzimuth', () => {
  it('faces the eye offset toward the Sun-relative direction for a target on the +X axis', () => {
    const basis = orbitBasisForUpAxis([0, 0, 1]) // default up-axis, ecliptic north
    const azimuth = defaultFramingAzimuth([10, 0, 0], 99, basis)
    expect(Math.sin(azimuth)).toBeCloseTo(0, 10)
    expect(Math.cos(azimuth)).toBeCloseTo(-1, 10)
  })

  it('faces the eye offset toward the Sun-relative direction for a target on the +Y axis', () => {
    const basis = orbitBasisForUpAxis([0, 0, 1])
    const azimuth = defaultFramingAzimuth([0, 5, 0], 99, basis)
    expect(Math.sin(azimuth)).toBeCloseTo(-1, 10)
    expect(Math.cos(azimuth)).toBeCloseTo(0, 10)
  })

  it('falls back to the given azimuth when the target is at the origin (the Sun itself)', () => {
    const basis = orbitBasisForUpAxis([0, 0, 1])
    expect(defaultFramingAzimuth([0, 0, 0], 1.234, basis)).toBe(1.234)
  })
})

describe('CameraFollowController', () => {
  it('flies to and locks onto the selected entity\'s position', () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const earth = findEntity('earth')
    const T = 0.1
    const daysSinceEpoch = 500
    const scaleBlend = 0.5

    controller.selectEntity(earth, T, daysSinceEpoch, scaleBlend)
    runPastFlyTo(controller, T, daysSinceEpoch, scaleBlend)

    const expected = entityWorldPosition(earth, T, daysSinceEpoch, scaleBlend)
    expect(camera.target[0]).toBeCloseTo(expected[0], 6)
    expect(camera.target[1]).toBeCloseTo(expected[1], 6)
    expect(camera.target[2]).toBeCloseTo(expected[2], 6)
    expect(controller.followedEntityId).toBe('earth')
  })

  it('keeps re-tracking the live position after lock, as time advances', () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const earth = findEntity('earth')
    const scaleBlend = 0.5

    controller.selectEntity(earth, 0.1, 500, scaleBlend)
    runPastFlyTo(controller, 0.1, 500, scaleBlend)

    // Advance to a meaningfully later time and tick for a couple of real seconds - already
    // locked, so no more tween, but the position is now smoothed/eased toward rather than
    // snapped to instantly (see the dedicated damping tests below), so this needs enough ticks
    // to let it converge rather than a single call.
    const laterT = 0.2
    const laterDays = 40000
    for (let i = 0; i < 40; i++) {
      controller.update(0.1, laterT, laterDays, scaleBlend)
    }

    const expected = entityWorldPosition(earth, laterT, laterDays, scaleBlend)
    expect(camera.target[0]).toBeCloseTo(expected[0], 6)
    expect(camera.target[1]).toBeCloseTo(expected[1], 6)
    expect(camera.target[2]).toBeCloseTo(expected[2], 6)
  })

  it('eases toward a sudden position change rather than snapping instantly (damped following)', () => {
    // Reproduces the reported bug: following a fast-orbiting moon under time acceleration caused
    // the camera to whip around in lockstep with the moon's exact position every frame. A single
    // small-deltaSeconds tick after a big jump in the target's position should move only PART of
    // the way there, not snap exactly onto it.
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const europa = findEntity('europa')
    const scaleBlend = 0.5

    controller.selectEntity(europa, 0.1, 500, scaleBlend)
    runPastFlyTo(controller, 0.1, 500, scaleBlend)
    const positionBeforeJump: [number, number, number] = [camera.target[0], camera.target[1], camera.target[2]]

    // A large days-since-epoch jump, simulating a big step of accelerated sim time between frames.
    const laterDays = 40000
    const expectedNewPosition = entityWorldPosition(europa, 0.1, laterDays, scaleBlend)
    controller.update(0.016, 0.1, laterDays, scaleBlend)

    const distanceToOld = Math.hypot(
      camera.target[0] - positionBeforeJump[0],
      camera.target[1] - positionBeforeJump[1],
      camera.target[2] - positionBeforeJump[2],
    )
    const distanceToNew = Math.hypot(
      camera.target[0] - expectedNewPosition[0],
      camera.target[1] - expectedNewPosition[1],
      camera.target[2] - expectedNewPosition[2],
    )
    const fullJumpDistance = Math.hypot(
      expectedNewPosition[0] - positionBeforeJump[0],
      expectedNewPosition[1] - positionBeforeJump[1],
      expectedNewPosition[2] - positionBeforeJump[2],
    )

    expect(fullJumpDistance).toBeGreaterThan(0.01) // sanity: the jump is actually meaningful
    expect(distanceToOld).toBeGreaterThan(0) // it moved at all
    expect(distanceToNew).toBeGreaterThan(fullJumpDistance * 0.01) // ...but didn't snap all the way
  })

  it('eventually converges to the live position after enough real time passes', () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const europa = findEntity('europa')
    const scaleBlend = 0.5

    controller.selectEntity(europa, 0.1, 500, scaleBlend)
    runPastFlyTo(controller, 0.1, 500, scaleBlend)

    const laterDays = 40000
    for (let i = 0; i < 200; i++) {
      controller.update(0.05, 0.1, laterDays, scaleBlend)
    }

    const expected = entityWorldPosition(europa, 0.1, laterDays, scaleBlend)
    expect(camera.target[0]).toBeCloseTo(expected[0], 3)
    expect(camera.target[1]).toBeCloseTo(expected[1], 3)
    expect(camera.target[2]).toBeCloseTo(expected[2], 3)
  })

  it('keeps a followed body framed as scaleBlend changes, instead of leaving it at a stale Compact-mode zoom distance', () => {
    // Reproduces the reported bug: follow a planet, then toggle Realistic<->Compact. Jupiter's true
    // physical radius in scene units is ~100x smaller than its hand-tuned Compact visual radius
    // (see geometricBlend's comment in sceneScale.ts), so if orbitCamera.radius is never rescaled
    // for the new scale, the planet shrinks to an invisible speck while the camera sits exactly
    // where it was, still framed for the old (much larger) Compact-mode sphere.
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const jupiter = findEntity('jupiter')
    const T = 0.1
    const daysSinceEpoch = 500

    camera.minRadius = minOrbitRadiusForBlend(1)
    controller.selectEntity(jupiter, T, daysSinceEpoch, 1) // start fully Compact
    runPastFlyTo(controller, T, daysSinceEpoch, 1)
    const radiusAtCompact = camera.radius

    // Animate scaleBlend from Compact (1) down to Realistic (0), the same way the app's
    // scale switch drives it frame by frame - including the app's own per-frame
    // refreshCameraZoomLimits() call, which is what actually lets the camera zoom in this close
    // (see minOrbitRadiusForBlend's own comment: the zoom-in floor must shrink with scaleBlend too,
    // or it - not this fix - becomes the bottleneck preventing a close Realistic-mode framing).
    for (let i = 0; i <= 20; i++) {
      const scaleBlend = 1 - i / 20
      camera.minRadius = minOrbitRadiusForBlend(scaleBlend)
      controller.update(0.05, T, daysSinceEpoch, scaleBlend)
    }

    const bodyRadiusAtRealistic = scaledBodyRadiusUnits(
      jupiter.definition.radiusKm,
      (jupiter.definition as { compactVisualRadius: number }).compactVisualRadius,
      0,
      AU_KM,
    )

    // The camera should have zoomed in to stay proportionally framed on the now-tiny real body,
    // not stayed at (or anywhere near) its old Compact-mode distance.
    expect(camera.radius).toBeLessThan(radiusAtCompact * 0.5)
    // And it should still be a sane, positive multiple of the body's actual (now tiny) radius -
    // i.e. actually framed on it, not just "smaller than before" by coincidence.
    expect(camera.radius).toBeGreaterThan(0)
    expect(camera.radius / bodyRadiusAtRealistic).toBeGreaterThan(1)
    expect(camera.radius / bodyRadiusAtRealistic).toBeLessThan(50)
  })

  it('leaves azimuth/elevation/radius free for manual orbiting once locked', () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const earth = findEntity('earth')

    controller.selectEntity(earth, 0.1, 500, 0.5)
    runPastFlyTo(controller, 0.1, 500, 0.5)

    camera.applyDrag(50, 20)
    camera.applyZoom(-500)
    const azimuthAfterDrag = camera.azimuth
    const elevationAfterDrag = camera.elevation
    const radiusAfterZoom = camera.radius

    controller.update(0.1, 0.1, 500, 0.5)

    expect(camera.azimuth).toBe(azimuthAfterDrag)
    expect(camera.elevation).toBe(elevationAfterDrag)
    expect(camera.radius).toBe(radiusAfterZoom)
  })

  it('reorients azimuth toward the target during the fly-to, so the view direction actually changes', () => {
    const camera = new OrbitCamera({ azimuth: 0 })
    const controller = new CameraFollowController(camera)
    const earth = findEntity('earth')
    const T = 0.1
    const daysSinceEpoch = 500
    const scaleBlend = 0.5

    controller.selectEntity(earth, T, daysSinceEpoch, scaleBlend)
    runPastFlyTo(controller, T, daysSinceEpoch, scaleBlend)

    const expectedTarget = entityWorldPosition(earth, T, daysSinceEpoch, scaleBlend)
    const basis = orbitBasisForUpAxis(entityPoleDirection(earth)) // the up-axis the flight ends on
    const expectedAzimuth = defaultFramingAzimuth(expectedTarget, 0, basis)
    expect(Math.sin(camera.azimuth)).toBeCloseTo(Math.sin(expectedAzimuth), 6)
    expect(Math.cos(camera.azimuth)).toBeCloseTo(Math.cos(expectedAzimuth), 6)
  })

  it("ends with the eye swung toward the Sun around the target's own pole, even when chaining from a steeply tilted body", () => {
    // Regression test: the framing azimuth was computed in the STARTING up-axis basis but applied
    // once upAxis had turned to the target's own pole. Starting from a fresh camera (up = ecliptic
    // north) most poles are close enough that this hid; flying on from Uranus (pole ~98 degrees
    // away) left the eye nowhere near the sunward side.
    for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'neptune', 'triton']) {
      const camera = new OrbitCamera({ radius: 65, azimuth: 0, elevation: 0.5 })
      const controller = new CameraFollowController(camera)
      controller.selectEntity(findEntity('uranus'), 0.0259, 9460, 1)
      runPastFlyTo(controller, 0.0259, 9460, 1)
      controller.selectEntity(findEntity(id), 0.0259, 9460, 1)
      runPastFlyTo(controller, 0.0259, 9460, 1)

      // Azimuth only controls the eye's direction around the up-axis, so compare the components
      // perpendicular to it: eye offset vs. direction to the Sun.
      const up = camera.upAxis
      const eye = camera.getEyePosition()
      const target = camera.target
      const perpendicular = (v: number[]) => {
        const along = v[0] * up[0] + v[1] * up[1] + v[2] * up[2]
        return [v[0] - along * up[0], v[1] - along * up[1], v[2] - along * up[2]]
      }
      const toEye = perpendicular([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]])
      const toSun = perpendicular([-target[0], -target[1], -target[2]])
      const cosine =
        (toEye[0] * toSun[0] + toEye[1] * toSun[1] + toEye[2] * toSun[2]) /
        (Math.hypot(toEye[0], toEye[1], toEye[2]) * Math.hypot(toSun[0], toSun[1], toSun[2]))
      expect(cosine).toBeGreaterThan(0.99)
    }
  })

  it('arrives on the entity\'s live position when simulated time advances during the flight', () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera, { flyToDurationSeconds: 1.5 })
    const mercury = findEntity('mercury')
    controller.selectEntity(mercury, 0.02, 7300, 1)
    // 1 month/s: ~1.25 simulated days per 0.05s step.
    let days = 7300
    for (let i = 0; i < 30; i++) {
      days += 1.25
      controller.update(0.05, days / 365250, days, 1)
    }
    const live = entityWorldPosition(mercury, days / 365250, days, 1)
    expect(camera.target[0]).toBeCloseTo(live[0], 6)
    expect(camera.target[1]).toBeCloseTo(live[1], 6)
    expect(camera.target[2]).toBeCloseTo(live[2], 6)
  })

  it('leaves azimuth unchanged when flying to the Sun itself', () => {
    const camera = new OrbitCamera({ azimuth: 0.77 })
    const controller = new CameraFollowController(camera)
    const sun = findEntity('sun')

    controller.selectEntity(sun, 0.1, 500, 0.5)
    runPastFlyTo(controller, 0.1, 500, 0.5)

    expect(camera.azimuth).toBeCloseTo(0.77, 10)
  })

  it('stops re-targeting once stopFollowing is called', () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const earth = findEntity('earth')

    controller.selectEntity(earth, 0.1, 500, 0.5)
    runPastFlyTo(controller, 0.1, 500, 0.5)

    controller.stopFollowing()
    const targetAfterStop: [number, number, number] = [camera.target[0], camera.target[1], camera.target[2]]

    controller.update(0.1, 0.9, 90000, 0.5)

    expect(controller.followedEntityId).toBeNull()
    expect(camera.target[0]).toBe(targetAfterStop[0])
    expect(camera.target[1]).toBe(targetAfterStop[1])
    expect(camera.target[2]).toBe(targetAfterStop[2])
  })

  it("orients the camera's up-axis to the followed entity's own pole after the fly-to", () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const earth = findEntity('earth')

    controller.selectEntity(earth, 0.1, 500, 0.5)
    runPastFlyTo(controller, 0.1, 500, 0.5)

    const expectedPole = entityPoleDirection(earth)
    expect(camera.upAxis[0]).toBeCloseTo(expectedPole[0], 6)
    expect(camera.upAxis[1]).toBeCloseTo(expectedPole[1], 6)
    expect(camera.upAxis[2]).toBeCloseTo(expectedPole[2], 6)
  })

  it('leaves the up-axis wherever it was after stopFollowing, matching target/radius/azimuth', () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const earth = findEntity('earth')

    controller.selectEntity(earth, 0.1, 500, 0.5)
    runPastFlyTo(controller, 0.1, 500, 0.5)

    const upAxisAfterFlyTo: [number, number, number] = [camera.upAxis[0], camera.upAxis[1], camera.upAxis[2]]
    controller.stopFollowing()

    expect(camera.upAxis[0]).toBe(upAxisAfterFlyTo[0])
    expect(camera.upAxis[1]).toBe(upAxisAfterFlyTo[1])
    expect(camera.upAxis[2]).toBe(upAxisAfterFlyTo[2])
  })
})

describe('interpolateUpAxis', () => {
  it('rotates smoothly at unit length even between nearly opposite up-axes', () => {
    // Venus's right-hand-rule pole is ~178.76 degrees from ecliptic north. lerp + normalize stays
    // unit length there too, but its direction swings wildly near the antipodal crossing (a ~173
    // degree jump in one step); slerp moves along the great circle at a bounded rate.
    const from: [number, number, number] = [...ECLIPTIC_NORTH]
    const to = equatorialToEclipticPoleDirection(92.76, -67.16)
    let previous = interpolateUpAxis(from, to, 0)
    let maxStepAngleDegrees = 0
    for (let step = 1; step <= 15; step++) {
      const current = interpolateUpAxis(from, to, easeInOutCubic(step / 15))
      expect(Math.hypot(current[0], current[1], current[2])).toBeCloseTo(1, 6)
      const dot = previous[0] * current[0] + previous[1] * current[1] + previous[2] * current[2]
      maxStepAngleDegrees = Math.max(maxStepAngleDegrees, (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI)
      previous = current
    }
    expect(maxStepAngleDegrees).toBeLessThan(90)
  })

  it('returns the axis unchanged when start and end are identical', () => {
    // vec3.slerp divides by sin(angle) = 0 here; the resulting NaN once blanked the whole scene.
    const axis = interpolateUpAxis(ECLIPTIC_NORTH, ECLIPTIC_NORTH, 0.5)
    for (let i = 0; i < 3; i++) expect(axis[i]).toBeCloseTo(ECLIPTIC_NORTH[i], 6)
  })
})
