import { mat4, vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import type { Viewpoint } from '../src/camera/viewpoint'
import { FLARE_ELEMENTS } from '../src/lensFlare/flareElements'
import { elementCenter, FLOATS_PER_ELEMENT, frameFade, MAX_FLARE_ELEMENTS, packFlareElements } from '../src/lensFlare/flareLayout'
import { flarePipelineSpec } from '../src/lensFlare/lensFlare'
import { sunVisibleFraction } from '../src/lensFlare/sunVisibility'
import type { PlanetPose, SceneLayout } from '../src/scene/sceneLayout'
import { PLANETS } from '../src/solarSystem/bodies'

// A camera 30 units in front of the Sun, looking straight at it.
function viewpointLookingAtSun(): Viewpoint {
  const view = mat4.lookAt(mat4.create(), [0, 0, 30], [0, 0, 0], [0, 1, 0])
  const projection = mat4.perspective(mat4.create(), Math.PI / 4, 1, 0.1, 100)
  return {
    view,
    projection,
    viewProjection: mat4.multiply(mat4.create(), projection, view),
    position: vec3.fromValues(0, 0, 30),
    pixels: { width: 800, height: 800 },
    cssPixels: { width: 800, height: 800 },
  }
}

function layoutWithPlanetAt(position: [number, number, number], radius: number): SceneLayout {
  const planet: PlanetPose = { definition: PLANETS[0], position, radius, tilt: mat4.create(), spinRadians: 0, poleDirection: [0, 0, 1] }
  return { sun: { position: [0, 0, 0], radius: 1, tilt: mat4.create(), spinRadians: 0 }, planets: [planet], moons: [] }
}

describe('lens flare layout', () => {
  it('places elements on the line from the Sun through the screen center', () => {
    expect(elementCenter([0.4, -0.2], 0)).toEqual([0.4, -0.2])
    expect(elementCenter([0.4, -0.2], 0.5)).toEqual([0, -0])
    const mirrored = elementCenter([0.4, -0.2], 1)
    expect(mirrored[0]).toBeCloseTo(-0.4, 12)
    expect(mirrored[1]).toBeCloseTo(0.2, 12)
  })

  it('is at full strength while the Sun is in frame and fades out just beyond the edge', () => {
    expect(frameFade([0, 0])).toBe(1)
    expect(frameFade([0.99, -0.99])).toBe(1)
    const justOutside = frameFade([1.15, 0])
    expect(justOutside).toBeGreaterThan(0)
    expect(justOutside).toBeLessThan(1)
    expect(frameFade([0, -1.5])).toBe(0)
  })

  it('packs every element for the shader, with its color scaled by its intensity', () => {
    const packed = packFlareElements(FLARE_ELEMENTS)
    expect(packed.length).toBe(MAX_FLARE_ELEMENTS * FLOATS_PER_ELEMENT)
    const [first] = FLARE_ELEMENTS
    expect(packed[0]).toBeCloseTo(first.color[0] * first.intensity, 6)
    expect(packed[4]).toBeCloseTo(first.t, 6)
    expect(() => packFlareElements(Array.from({ length: MAX_FLARE_ELEMENTS + 1 }, () => first))).toThrow()
  })
})

describe('lens flare pipeline', () => {
  // The old flare was depth-tested at the Sun's depth, so any planet anywhere in the picture cut
  // off the ghosts it overlapped - not what light scattered inside a lens does.
  it('draws over the scene without any depth test', () => {
    const spec = flarePipelineSpec('rgba16float')
    expect(spec.depth).toEqual({ write: false, compare: 'always' })
  })
})

describe('sunVisibleFraction', () => {
  it('is 0 when a nearer planet covers the whole Sun', () => {
    expect(sunVisibleFraction(layoutWithPlanetAt([0, 0, 10], 2), viewpointLookingAtSun())).toBe(0)
  })

  it('is 1 when the planet is behind the Sun, even though it overlaps it on screen', () => {
    expect(sunVisibleFraction(layoutWithPlanetAt([0, 0, -10], 5), viewpointLookingAtSun())).toBe(1)
  })

  it('is 1 when a nearer planet is beside the Sun on screen', () => {
    expect(sunVisibleFraction(layoutWithPlanetAt([8, 0, 10], 1), viewpointLookingAtSun())).toBe(1)
  })

  it('is in between while a nearer planet covers part of the Sun', () => {
    const partly = sunVisibleFraction(layoutWithPlanetAt([0.45, 0, 15], 0.5), viewpointLookingAtSun())
    expect(partly).toBeGreaterThan(0)
    expect(partly).toBeLessThan(1)
  })
})
