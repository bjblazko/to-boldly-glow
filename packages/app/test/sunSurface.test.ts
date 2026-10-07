import { mat4, vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { VERTICAL_FOV_RADIANS, type Viewpoint } from '../src/camera/viewpoint'
import { closeUpBrightness, granulationAt, sunScreenCoverage } from '../src/bodies/sunSurface'
import type { SunPose } from '../src/scene/sceneLayout'

const LIFETIME_SECONDS = 600

describe("the Sun's granulation", () => {
  it('gives each generation of granules a new seed only while the shader weighs it at zero', () => {
    // Generation A weighs cos²(π·phase): zero at phase 0.5, where its seed changes.
    const [seedABefore] = granulationAt(LIFETIME_SECONDS * 10.49, 0)
    const [seedAAfter] = granulationAt(LIFETIME_SECONDS * 10.51, 0)
    expect(seedAAfter).not.toBe(seedABefore)
    // Generation B weighs sin²(π·phase): zero at phase 0, where its seed changes.
    const [, seedBBefore] = granulationAt(LIFETIME_SECONDS * 10.99, 0)
    const [, seedBAfter] = granulationAt(LIFETIME_SECONDS * 11.01, 0)
    expect(seedBAfter).not.toBe(seedBBefore)
    // Neither changes anywhere else.
    expect(granulationAt(LIFETIME_SECONDS * 10.1, 0).slice(0, 2)).toEqual(granulationAt(LIFETIME_SECONDS * 10.4, 0).slice(0, 2))
  })

  it('keeps seeds and phase in a range 32-bit floats resolve, decades after J2000', () => {
    const [seedA, seedB, phase] = granulationAt(26 * 365.25 * 86_400 + 123.4, 0)
    for (const seed of [seedA, seedB]) {
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(64)
    }
    expect(phase).toBeGreaterThanOrEqual(0)
    expect(phase).toBeLessThan(1)
    // Before J2000 too.
    expect(granulationAt(-1_000_000, 0)[0]).toBeGreaterThanOrEqual(0)
  })

  it('shows full contrast while time stands still or crawls, and averages out when granules come and go within a frame', () => {
    const [, , , paused] = granulationAt(0, 0)
    const [, , , realTime] = granulationAt(0, 1 / 60)
    const [, , , hourPerSecond] = granulationAt(0, 3600 / 60)
    const [, , , dayPerSecond] = granulationAt(0, 86_400 / 60)
    expect(paused).toBeCloseTo(0.12)
    expect(realTime).toBeCloseTo(paused)
    expect(hourPerSecond).toBeLessThan(paused)
    expect(hourPerSecond).toBeGreaterThan(0)
    expect(dayPerSecond).toBe(0)
  })
})

describe("the camera's exposure for the Sun", () => {
  it('leaves a Sun that covers little of the picture over-bright, so it blooms', () => {
    expect(closeUpBrightness(4, 0.02)).toBe(4)
    expect(closeUpBrightness(4, 0.15)).toBe(4)
  })

  it('stops down smoothly as the Sun fills the picture, to normal brightness once it covers most of it', () => {
    const coverages = [0.15, 0.3, 0.45, 0.6]
    const brightnesses = coverages.map((coverage) => closeUpBrightness(4, coverage))
    for (let i = 1; i < brightnesses.length; i++) expect(brightnesses[i]).toBeLessThan(brightnesses[i - 1])
    expect(closeUpBrightness(4, 0.6)).toBeCloseTo(1)
    expect(closeUpBrightness(4, 1)).toBeCloseTo(1)
  })

  it('never brightens a Sun that is not over-bright to begin with (no bloom)', () => {
    expect(closeUpBrightness(1, 0.05)).toBe(1)
    expect(closeUpBrightness(1, 1)).toBe(1)
  })
})

describe("the Sun's coverage of the picture", () => {
  const sunAt = (position: [number, number, number], radius: number): SunPose => ({ position, radius, tilt: mat4.create(), spinRadians: 0 })

  it('is small for a distant Sun, and the area of its disc when it is near', () => {
    const viewpoint = viewpointAt([0, 0, 0], [0, 0, -1])
    expect(sunScreenCoverage(sunAt([0, 0, -100], 1), viewpoint)).toBeLessThan(0.01)
    // A disc whose radius is half the screen's height: pi * 0.5^2 of a 2 x 2 (square) screen.
    const halfHeight = Math.tan(VERTICAL_FOV_RADIANS / 2) * 0.5
    const distance = 10
    const radius = distance * Math.sin(Math.atan(halfHeight))
    expect(sunScreenCoverage(sunAt([0, 0, -distance], radius), viewpoint)).toBeCloseTo((Math.PI * 0.25) / 4, 1)
  })

  it('covers the whole picture from inside or right above the surface, and nothing from behind the camera', () => {
    const viewpoint = viewpointAt([0, 0, 0], [0, 0, -1])
    expect(sunScreenCoverage(sunAt([0, 0, -1.05], 1), viewpoint)).toBe(1)
    expect(sunScreenCoverage(sunAt([0, 0, 0.5], 1), viewpoint)).toBe(1)
    expect(sunScreenCoverage(sunAt([0, 0, 10], 1), viewpoint)).toBe(0)
  })

  it('counts only the part of a huge Sun that reaches into the picture from the side', () => {
    // The size lineup: a giant Sun whose center lies off screen to the left.
    const viewpoint = viewpointAt([0, 0, 0], [0, 0, -1])
    const coverage = sunScreenCoverage(sunAt([-30, 0, -10], 26), viewpoint)
    expect(coverage).toBeGreaterThan(0)
    expect(coverage).toBeLessThan(0.15)
  })
})

// A square viewport at `eye`, looking toward `direction`.
function viewpointAt(eye: [number, number, number], direction: [number, number, number]): Viewpoint {
  const view = mat4.lookAt(mat4.create(), eye, [eye[0] + direction[0], eye[1] + direction[1], eye[2] + direction[2]], [0, 1, 0])
  const projection = mat4.perspective(mat4.create(), VERTICAL_FOV_RADIANS, 1, 0.01, 1000)
  return {
    view,
    projection,
    viewProjection: mat4.multiply(mat4.create(), projection, view),
    position: vec3.fromValues(...eye),
    pixels: { width: 400, height: 400 },
    cssPixels: { width: 400, height: 400 },
  }
}
