import { describe, expect, it } from 'vitest'
import { OrbitCamera, orbitBasisForUpAxis } from '../src/camera/orbitCamera'
import { CameraFollowController, defaultFramingAzimuth } from '../src/camera/cameraFollow'
import { ALL_ENTITIES, entityPoleDirection, entityWorldPosition } from '../src/solarSystem/entities'

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
    const basis = orbitBasisForUpAxis([0, 0, 1]) // camera's up-axis before this fly-to started
    const expectedAzimuth = defaultFramingAzimuth(expectedTarget, 0, basis)
    expect(Math.sin(camera.azimuth)).toBeCloseTo(Math.sin(expectedAzimuth), 6)
    expect(Math.cos(camera.azimuth)).toBeCloseTo(Math.cos(expectedAzimuth), 6)
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
