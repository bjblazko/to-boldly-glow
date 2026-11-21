import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { OrbitCamera, WALK_RADIUS } from '../src/camera/orbitCamera'
import { WalkFlight, type Pose } from '../src/learn/walkFlight'

function walkingCamera(): OrbitCamera {
  const camera = new OrbitCamera({ radius: WALK_RADIUS, upAxis: [0, 1, 0], minRadius: 0.001 })
  camera.walk = (_eye, delta) => vec3.clone(delta)
  camera.panLimit = 100
  return camera
}

const OUTSIDE: Pose = { eye: [0, 0, 10], ahead: [0, 0, -1], head: [0, 1, 0] }
const LYING: Pose = { eye: [0, 0, 0], ahead: [0, 1, 0], head: [0, 0, 1] }

describe('flying into a cabin', () => {
  it('passes the hatch on the way and arrives lying, looking up', () => {
    const camera = walkingCamera()
    const flight = new WalkFlight(OUTSIDE, [[0, 0, 3], [0, 0, 1]], LYING)
    let passedHatch = false
    while (flight.update(1 / 60, camera)) {
      const eye = camera.getEyePosition()
      if (Math.abs(eye[2] - 3) < 0.05) passedHatch = Math.abs(eye[0]) < 1e-6 && Math.abs(eye[1]) < 1e-6
    }
    expect(passedHatch).toBe(true)
    const eye = camera.getEyePosition()
    for (let i = 0; i < 3; i++) expect(eye[i]).toBeCloseTo(LYING.eye[i], 4)
    expect(camera.forward()[1]).toBeCloseTo(1, 4)
    expect(camera.screenAxes().up[2]).toBeCloseTo(1, 4)
  })

  it('tilts the head with Q/E while walking, and only then', () => {
    const camera = walkingCamera()
    camera.lookFrom([0, 0, 0], [0, 0, -1], [0, 1, 0])
    camera.roll(Math.PI / 2)
    expect(camera.forward()[2]).toBeCloseTo(-1, 6)
    expect(Math.abs(camera.screenAxes().up[0])).toBeCloseTo(1, 6)
    const outside = new OrbitCamera()
    const before = outside.getEyePosition()
    outside.roll(1)
    expect(vec3.distance(before, outside.getEyePosition())).toBe(0)
  })
})
