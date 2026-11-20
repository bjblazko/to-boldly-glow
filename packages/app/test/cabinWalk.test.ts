import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { OrbitCamera, WALK_RADIUS } from '../src/camera/orbitCamera'
import { startWalking, walkLimit, walkUpTo, type Obstacle } from '../src/learn/cabinWalk'

// A wall across the room at x = 1 (the eye starts at the origin).
const wallAtX1: Obstacle = (origin, direction, within) => {
  if (direction[0] <= 0) return null
  const distance = (1 - origin[0]) / direction[0]
  return distance <= within ? distance : null
}

function walker(): OrbitCamera {
  // Upright (+Y up), the pivot 2 m ahead of the eye.
  const camera = new OrbitCamera({ target: [2, 0, 0], radius: 2, azimuth: 0, elevation: 0, upAxis: [0, 1, 0], minRadius: 0.001 })
  const eye = camera.getEyePosition()
  const toEye = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), eye, camera.target))
  // Move the pivot so the eye sits at the origin, whatever way the basis looks.
  camera.target = vec3.scale(vec3.create(), toEye, -2)
  camera.panLimit = 10
  startWalking(camera, walkLimit(wallAtX1))
  return camera
}

describe('walking through a cabin', () => {
  it('keeps the eye where the shot put it, the pivot just ahead', () => {
    const camera = walker()
    expect(vec3.length(camera.getEyePosition())).toBeCloseTo(0, 6)
    expect(camera.radius).toBe(WALK_RADIUS)
  })

  it('steps forward when zooming in, and stops short of the wall', () => {
    const camera = walker()
    const ahead = camera.forward()
    camera.zoomBy(Math.exp(-0.5))
    const walked = vec3.length(camera.getEyePosition())
    expect(walked).toBeGreaterThan(0.1)
    for (let i = 0; i < 50; i++) camera.zoomBy(Math.exp(-0.5))
    const eye = camera.getEyePosition()
    // Toward the wall only if the look runs toward it; never through it.
    expect(eye[0]).toBeLessThan(1)
    expect(vec3.dot(eye, ahead)).toBeGreaterThan(walked - 1e-9)
  })

  it('turns the view against a drag, from where one stands', () => {
    const camera = walker()
    const before = camera.forward()
    camera.applyDrag(100, 0)
    expect(vec3.length(camera.getEyePosition())).toBeLessThan(2 * WALK_RADIUS)
    expect(vec3.dot(before, camera.forward())).toBeLessThan(0.999)
  })

  it('walks up to a spot and looks at it from a little way off', () => {
    const camera = walker()
    walkUpTo(camera, [0, 0, 2])
    const eye = camera.getEyePosition()
    expect(Math.hypot(eye[0], eye[1], eye[2] - 2)).toBeCloseTo(0.35, 2)
    expect(camera.forward()[2]).toBeCloseTo(1, 4)
  })
})
