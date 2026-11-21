import { mat4, vec3, vec4 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { clientToNdc, panByPixels, zoomToward, type ScreenFrame } from '../src/camera/input/orbitPan'
import { OrbitCamera } from '../src/camera/orbitCamera'
import { perspectiveProjection, VERTICAL_FOV_RADIANS } from '../src/camera/viewpoint'

const screen: ScreenFrame = { heightPx: 800, aspect: 1.6, lensShift: { x: -0.3, y: 0.1 }, tanHalfFov: Math.tan(Math.PI / 8) }

function camera(): OrbitCamera {
  return new OrbitCamera({ target: [1, 2, 3], radius: 20, azimuth: 0.6, elevation: 0.3, minRadius: 5 })
}

// Where a world point lands on screen (NDC), as the renderer draws it.
function toNdc(orbit: OrbitCamera, point: vec3): [number, number] {
  const viewProjection = mat4.multiply(mat4.create(), perspectiveProjection(screen.aspect, orbit.minRadius, screen.lensShift), orbit.getViewMatrix())
  const clip = vec4.transformMat4(vec4.create(), [point[0], point[1], point[2], 1], viewProjection)
  return [clip[0] / clip[3], clip[1] / clip[3]]
}

describe('panByPixels', () => {
  it('pans so the scene follows the pointer', () => {
    const orbit = camera()
    const k = (2 * orbit.radius * Math.tan(VERTICAL_FOV_RADIANS / 2)) / screen.heightPx
    const { right, up } = orbit.screenAxes()
    const before = orbit.pivot()
    panByPixels(orbit, 100, 0, screen)
    const afterRight = orbit.pivot()
    for (let i = 0; i < 3; i++) expect(afterRight[i] - before[i]).toBeCloseTo(-right[i] * 100 * k, 4)
    panByPixels(orbit, 0, 100, screen)
    const afterDown = orbit.pivot()
    for (let i = 0; i < 3; i++) expect(afterDown[i] - afterRight[i]).toBeCloseTo(up[i] * 100 * k, 4)
  })
})

describe('zoomToward', () => {
  it('keeps the point under the pointer fixed while zooming', () => {
    const orbit = camera()
    const ndc: [number, number] = [0.4, -0.3]
    // The world point under the pointer, on the plane through the pivot facing the camera.
    const tanHalf = Math.tan(VERTICAL_FOV_RADIANS / 2)
    const { right, up } = orbit.screenAxes()
    const point = vec3.clone(orbit.pivot())
    vec3.scaleAndAdd(point, point, right, (ndc[0] - screen.lensShift.x) * tanHalf * screen.aspect * orbit.radius)
    vec3.scaleAndAdd(point, point, up, (ndc[1] - screen.lensShift.y) * tanHalf * orbit.radius)
    const before = toNdc(orbit, point)
    zoomToward(orbit, 0.5, ndc, screen)
    const after = toNdc(orbit, point)
    expect(before[0]).toBeCloseTo(ndc[0], 4)
    expect(after[0]).toBeCloseTo(before[0], 4)
    expect(after[1]).toBeCloseTo(before[1], 4)
    expect(orbit.radius).toBeCloseTo(10, 6)
  })

  it('does not move the pivot when the radius is already at its floor', () => {
    const orbit = camera()
    orbit.radius = orbit.minRadius
    const before = vec3.clone(orbit.pivot())
    zoomToward(orbit, 0.5, [0.9, 0.9], screen)
    expect(vec3.distance(orbit.pivot(), before)).toBeCloseTo(0, 6)
  })

  it('zooms toward the middle when there is no pointer', () => {
    const orbit = camera()
    const before = vec3.clone(orbit.pivot())
    zoomToward(orbit, 0.5, null, screen)
    expect(vec3.distance(orbit.pivot(), before)).toBeCloseTo(0, 6)
    expect(orbit.radius).toBeCloseTo(10, 6)
  })
})

describe('clientToNdc', () => {
  it('maps the corners and middle of the canvas', () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 }
    expect(clientToNdc(10, 20, rect)).toEqual([-1, 1])
    expect(clientToNdc(110, 70, rect)).toEqual([0, 0])
    expect(clientToNdc(210, 120, rect)).toEqual([1, -1])
  })
})
