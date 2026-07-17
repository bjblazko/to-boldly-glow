import { describe, expect, it } from 'vitest'
import { OrbitCamera } from '../src/camera/orbitCamera'

describe('OrbitCamera', () => {
  it('places the eye directly on the +Z axis at azimuth 0, elevation 0', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: 0, elevation: 0 })
    const eye = camera.getEyePosition()
    expect(eye[0]).toBeCloseTo(0, 10)
    expect(eye[1]).toBeCloseTo(0, 10)
    expect(eye[2]).toBeCloseTo(10, 10)
  })

  it('places the eye on the +X axis at azimuth PI/2, elevation 0', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: Math.PI / 2, elevation: 0 })
    const eye = camera.getEyePosition()
    expect(eye[0]).toBeCloseTo(10, 5)
    expect(eye[1]).toBeCloseTo(0, 10)
    expect(eye[2]).toBeCloseTo(0, 5)
  })

  it('raises the eye above the target as elevation increases', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: 0, elevation: Math.PI / 4 })
    const eye = camera.getEyePosition()
    expect(eye[1]).toBeCloseTo(10 * Math.sin(Math.PI / 4), 5)
  })

  it('clamps elevation to avoid flipping past the poles', () => {
    const camera = new OrbitCamera({ elevation: 0 })
    camera.applyDrag(0, 100000, 1)
    expect(camera.elevation).toBeLessThanOrEqual(Math.PI / 2)
    expect(camera.elevation).toBeGreaterThan(0)
  })

  it('clamps radius to the configured min/max on zoom', () => {
    const camera = new OrbitCamera({ radius: 65, minRadius: 5, maxRadius: 500 })
    camera.applyZoom(-1000000, 1)
    expect(camera.radius).toBeGreaterThanOrEqual(5)
    camera.applyZoom(1000000, 1)
    expect(camera.radius).toBeLessThanOrEqual(500)
  })

  it('produces a view matrix with 16 finite entries', () => {
    const camera = new OrbitCamera()
    const view = camera.getViewMatrix()
    expect(view.length).toBe(16)
    for (const value of view) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })
})
