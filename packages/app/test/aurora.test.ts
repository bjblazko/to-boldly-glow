import { describe, expect, it } from 'vitest'
import { generateSphereMesh } from '../src/bodies/sphereMesh'
import { auroraActivity, bodyFrameDirection, GEOMAGNETIC_POLE, GEOMAGNETIC_POLE_LATITUDE_DEGREES, ovalColatitudeDegrees } from '../src/earthAurora/auroraOval'

describe("a body's own frame", () => {
  it('matches where the sphere mesh puts the texture map', () => {
    // u = 0.5 + longitude / 360 on an equirectangular map centered on longitude 0, v = 0.5 - latitude / 180.
    const mesh = generateSphereMesh(1, 18, 36)
    for (let vertex = 0; vertex < mesh.uvs.length / 2; vertex++) {
      const [u, v] = [mesh.uvs[vertex * 2], mesh.uvs[vertex * 2 + 1]]
      const expected = bodyFrameDirection(90 - v * 180, u * 360 - 180)
      const actual = [mesh.normals[vertex * 3], mesh.normals[vertex * 3 + 1], mesh.normals[vertex * 3 + 2]]
      actual.forEach((component, axis) => expect(component).toBeCloseTo(expected[axis], 6))
    }
  })
})

describe('the auroral ovals', () => {
  it('ring the geomagnetic pole, near Greenland', () => {
    expect(Math.hypot(...GEOMAGNETIC_POLE)).toBeCloseTo(1, 10)
    expect((Math.asin(GEOMAGNETIC_POLE[2]) * 180) / Math.PI).toBeCloseTo(GEOMAGNETIC_POLE_LATITUDE_DEGREES, 6)
  })

  it('reach farther from the pole on the night side than on the day side, and spread with activity', () => {
    const midnight = ovalColatitudeDegrees(0, 0.5)
    const noon = ovalColatitudeDegrees(Math.PI, 0.5)
    expect(midnight).toBeCloseTo(23, 6)
    expect(noon).toBeCloseTo(15, 6)
    expect(ovalColatitudeDegrees(0, 1)).toBeGreaterThan(midnight)
    expect(ovalColatitudeDegrees(0, 0)).toBeLessThan(midnight)
  })

  it('breathe with an activity that stays between quiet and a substorm', () => {
    const samples = Array.from({ length: 2000 }, (_, i) => auroraActivity(i * 1.7))
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.15)
    expect(Math.max(...samples)).toBeLessThanOrEqual(1)
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.4)
    // It changes over minutes, not from one frame to the next.
    expect(Math.abs(auroraActivity(100) - auroraActivity(100 + 1 / 60))).toBeLessThan(0.001)
  })
})
