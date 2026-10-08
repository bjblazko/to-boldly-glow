import { describe, expect, it } from 'vitest'
import { coronaStructure, MAX_PROMINENCE_LATITUDE_DEGREES, MAX_STREAMER_LATITUDE_DEGREES, PROMINENCE_COUNT, STREAMER_COUNT, wgslVec4Array } from '../src/sunCorona/coronaStructure'
import { CORONA_EXTENT_RADII, coronaExposure, coronaQuad, quadHalfSizeRadii, seenAcross } from '../src/sunCorona/coronaView'
import type { Vec3 } from '../src/math/tuples'

const DEGREES = Math.PI / 180

function latitudeDegrees(direction: Vec3): number {
  return Math.asin(direction[2]) / DEGREES
}

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

describe("the corona's structure", () => {
  it('is the same on every visit', () => {
    expect(coronaStructure()).toEqual(coronaStructure())
    expect(coronaStructure(1)).not.toEqual(coronaStructure(2))
  })

  it('places streamers all around the Sun, in both hemispheres and clear of the poles', () => {
    const { streamers } = coronaStructure()
    expect(streamers).toHaveLength(STREAMER_COUNT)
    for (const streamer of streamers) {
      expect(Math.hypot(...streamer.direction)).toBeCloseTo(1, 10)
      expect(Math.abs(latitudeDegrees(streamer.direction))).toBeLessThanOrEqual(MAX_STREAMER_LATITUDE_DEGREES)
    }
    expect(streamers.filter((streamer) => streamer.direction[2] > 0)).toHaveLength(STREAMER_COUNT / 2)
    // Every quarter of the Sun's longitudes has at least one.
    const quarters = new Set(streamers.map((streamer) => Math.floor(((Math.atan2(streamer.direction[1], streamer.direction[0]) / DEGREES + 360) % 360) / 90)))
    expect(quarters.size).toBe(4)
  })

  it('raises prominences from the active belts, tens of thousands of kilometres high', () => {
    const { prominences } = coronaStructure()
    expect(prominences).toHaveLength(PROMINENCE_COUNT)
    for (const prominence of prominences) {
      expect(Math.abs(latitudeDegrees(prominence.direction))).toBeLessThanOrEqual(MAX_PROMINENCE_LATITUDE_DEGREES)
      // 0.03-0.15 solar radii: about 20,000-100,000 km.
      expect(prominence.height).toBeGreaterThanOrEqual(0.03)
      expect(prominence.height).toBeLessThanOrEqual(0.15)
    }
  })

  it('writes its tables as WGSL arrays', () => {
    expect(wgslVec4Array('A', [[1, 2, 3, 4], [0.5, 0, 0, 1]])).toBe(
      'var<private> A: array<vec4f, 2> = array<vec4f, 2>(vec4f(1.00000, 2.00000, 3.00000, 4.00000), vec4f(0.50000, 0.00000, 0.00000, 1.00000));',
    )
  })
})

describe("the corona's quad", () => {
  const sun = { position: [0, 0, 0], radius: 2 }

  it('stands square to the line of sight through the Sun, from any side', () => {
    for (const camera of [[100, 0, 0], [0, -40, 3], [1, 2, 300]]) {
      const quad = coronaQuad(sun, camera)
      expect(dot(quad.axisU, quad.lineOfSight)).toBeCloseTo(0, 6)
      expect(dot(quad.axisV, quad.lineOfSight)).toBeCloseTo(0, 6)
      expect(dot(quad.axisU, quad.axisV)).toBeCloseTo(0, 6)
      expect(Math.hypot(...quad.lineOfSight)).toBeCloseTo(1, 10)
      expect(quad.distanceRadii).toBeCloseTo(Math.hypot(...camera) / sun.radius, 10)
    }
  })

  it('reaches exactly as far out as the corona is drawn, seen from afar', () => {
    const d = 50
    const rho = quadHalfSizeRadii(d)
    // The line of sight through the quad's edge passes the Sun's center at the corona's extent.
    expect((rho * d) / Math.hypot(d, rho)).toBeCloseTo(CORONA_EXTENT_RADII, 6)
    expect(Math.hypot(...coronaQuad(sun, [d * sun.radius, 0, 0]).axisU)).toBeCloseTo(rho * sun.radius, 6)
  })

  it('surrounds the camera once it is inside the corona', () => {
    // Its edge is then about 87 degrees off the Sun's direction.
    const d = 3
    expect(Math.atan(quadHalfSizeRadii(d) / d) / DEGREES).toBeGreaterThan(85)
  })
})

describe('where a direction on the Sun shows up in the sky', () => {
  const lineOfSight: Vec3 = [0, 0, -1]

  it('lies wholly across the line of sight at the limb, and not at all pointing at the camera', () => {
    expect(seenAcross([1, 0, 0], lineOfSight)).toEqual([1, 0, 0, 1])
    expect(seenAcross([0, 0, 1], lineOfSight)).toEqual([0, 0, 0, 0])
    const tilted = seenAcross([0, Math.SQRT1_2, Math.SQRT1_2], lineOfSight)
    expect(tilted[1]).toBeCloseTo(1, 10)
    expect(tilted[3]).toBeCloseTo(Math.SQRT1_2, 10)
  })
})

describe("the corona's exposure", () => {
  it('keeps the corona faint beside the visible disc and opens up only once the disc is gone', () => {
    const open = coronaExposure(1, 1)
    const partial = coronaExposure(0.3, 1)
    const total = coronaExposure(0, 1)
    expect(partial).toEqual(open)
    expect(open.hydrogen).toBe(0)
    expect(total.corona).toBeGreaterThan(open.corona * 4)
    expect(total.hydrogen).toBeGreaterThan(0)
    // The last sliver of the disc still outshines the corona.
    expect(coronaExposure(0.1, 1).corona).toBeLessThan(total.corona)
  })

  it('stops down with the camera when the Sun fills the picture', () => {
    expect(coronaExposure(0, 0.25).corona).toBeCloseTo(coronaExposure(0, 1).corona * 0.25, 10)
  })
})
