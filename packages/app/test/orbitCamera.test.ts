import { describe, expect, it } from 'vitest'
import {
  EXPLORER_MIN_ORBIT_RADIUS,
  minOrbitRadiusForBlend,
  OrbitCamera,
  REALISTIC_MIN_ORBIT_RADIUS,
} from '../src/camera/orbitCamera'

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

describe('minOrbitRadiusForBlend', () => {
  it('matches the explorer-mode zoom floor at blend=1 (today\'s default minRadius)', () => {
    expect(minOrbitRadiusForBlend(1)).toBeCloseTo(EXPLORER_MIN_ORBIT_RADIUS, 10)
  })

  it('matches the realistic-mode zoom floor at blend=0', () => {
    expect(minOrbitRadiusForBlend(0)).toBeCloseTo(REALISTIC_MIN_ORBIT_RADIUS, 10)
  })

  it('is small enough to get close to the smallest rendered body (Oberon) at blend=0', () => {
    // Oberon: radiusKm 761.4, explorerVisualRadius 0.085 - its own default fly-to framing distance
    // (radius * FRAMING_RADIUS_MULTIPLIER from cameraFollow.ts) at blend=0 is ~0.00061 scene units.
    // The zoom floor must sit below that, or the clamp would override even a real body's own
    // close-up framing.
    const oberonFramingRadiusAtBlend0 = 0.0006107573561874234
    expect(minOrbitRadiusForBlend(0)).toBeLessThan(oberonFramingRadiusAtBlend0)
  })

  it('interpolates geometrically between the two endpoints at blend 0.5', () => {
    const atHalf = minOrbitRadiusForBlend(0.5)
    expect(atHalf).toBeCloseTo(Math.sqrt(REALISTIC_MIN_ORBIT_RADIUS * EXPLORER_MIN_ORBIT_RADIUS), 10)
  })
})
