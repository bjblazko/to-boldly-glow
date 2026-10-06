import { mat4, vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import type { Viewpoint } from '../src/camera/viewpoint'
import { LIT_UNIFORM_FLOAT_COUNT, litSphereShaderCode } from '../src/bodies/litBodyShader'
import { packLitBodyUniforms } from '../src/bodies/litBodyUniforms'
import { packSurfaceMaterial, SURFACE_MATERIALS, SURFACE_UNIFORM_FLOAT_COUNT, surfaceMaterialOf } from '../src/bodies/surfaceMaterial'
import { PLANETS } from '../src/solarSystem/bodies'
import { MOONS } from '../src/solarSystem/moons'

const VIEWPOINT: Viewpoint = {
  view: mat4.create(),
  projection: mat4.create(),
  viewProjection: mat4.create(),
  position: vec3.fromValues(0, 0, 10),
  pixels: { width: 100, height: 100 },
  cssPixels: { width: 100, height: 100 },
}

describe('surface materials', () => {
  it('gives every planet and moon a material of its own kind', () => {
    for (const body of [...PLANETS, ...MOONS]) expect(SURFACE_MATERIALS[body.id], body.id).toBeDefined()
    expect(() => surfaceMaterialOf('pluto')).toThrow()
  })

  it('lets only Earth have open water, and keeps the gas giants free of a hard highlight or relief', () => {
    const withOcean = Object.entries(SURFACE_MATERIALS).filter(([, material]) => material.ocean).map(([id]) => id)
    expect(withOcean).toEqual(['earth'])
    for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) {
      expect(surfaceMaterialOf(id).specular, id).toBe(0)
      expect(surfaceMaterialOf(id).relief, id).toBe(0)
      expect(surfaceMaterialOf(id).limbDarkening, id).toBeGreaterThan(0)
    }
  })

  it('scatters like dusty regolith on the airless rocky bodies', () => {
    for (const id of ['moon', 'mercury', 'callisto']) expect(surfaceMaterialOf(id).regolith, id).toBeGreaterThan(0.5)
    expect(surfaceMaterialOf('earth').regolith).toBe(0)
  })
})

describe('packSurfaceMaterial', () => {
  it('packs the material in the order the shader reads it', () => {
    const packed = packSurfaceMaterial(surfaceMaterialOf('earth'), 12.5)
    expect(packed).toHaveLength(SURFACE_UNIFORM_FLOAT_COUNT)
    const earth = surfaceMaterialOf('earth')
    expect(packed.slice(0, 4)).toEqual([earth.roughness, earth.specular, earth.regolith, earth.limbDarkening])
    expect(packed.slice(4, 7)).toEqual([earth.relief, earth.ocean!.glitter, 12.5])
    expect(packed.slice(8, 11)).toEqual([earth.ocean!.roughness, earth.ocean!.specular, 1])
    expect(packed.slice(12, 15)).toEqual([earth.ice!.roughness, earth.ice!.specular, 1])
    expect(packed.slice(16, 20)).toEqual([...earth.twilight!.color, earth.twilight!.strength])
  })

  it('switches water, ice and twilight off where a body has none', () => {
    const packed = packSurfaceMaterial(surfaceMaterialOf('moon'), 0)
    expect(packed.slice(8, 20)).toEqual(Array(12).fill(0))
  })
})

describe('packLitBodyUniforms', () => {
  it('writes the surface material into the last slots of the shader uniforms', () => {
    const material = surfaceMaterialOf('mars')
    const uniforms = packLitBodyUniforms(
      { world: mat4.create(), color: [1, 1, 1], lightDirection: vec3.fromValues(1, 0, 0), occluders: [], sunRadius: 1, material, timeSeconds: 3 },
      VIEWPOINT,
    )
    expect(uniforms).toHaveLength(LIT_UNIFORM_FLOAT_COUNT)
    expect(Array.from(uniforms.slice(LIT_UNIFORM_FLOAT_COUNT - SURFACE_UNIFORM_FLOAT_COUNT))).toEqual(packSurfaceMaterial(material, 3).map(Math.fround))
  })

  // A mismatch between the packing and the WGSL struct is silently wrong rendering, not an error.
  it('matches the shader struct, one vec4 or mat4 at a time', () => {
    const struct = /struct Uniforms \{([\s\S]*?)\};/.exec(litSphereShaderCode)![1]
    const floats = [...struct.matchAll(/:\s*(mat4x4f|vec4f|array<vec4f, (\d+)>)/g)].reduce(
      (sum, [, type, count]) => sum + (type === 'mat4x4f' ? 16 : type === 'vec4f' ? 4 : 4 * Number(count)),
      0,
    )
    expect(floats).toBe(LIT_UNIFORM_FLOAT_COUNT)
  })
})
