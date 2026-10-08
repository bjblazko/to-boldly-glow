import { vec3, type mat4 } from 'gl-matrix'
import type { Rgb, Rgba } from '../math/tuples'
import { worldViewProjection, type Viewpoint } from '../camera/viewpoint'
import { LIT_UNIFORM_FLOAT_COUNT } from './litBodyShader'
import { packSurfaceMaterial, type SurfaceMaterial } from './surfaceMaterial'

// A sphere that can shadow the body: world-space center and radius.
export type Occluder = [number, number, number, number]
const MAX_OCCLUDERS = 4

export interface LitBodyShading {
  world: mat4
  color: Rgb
  // Sunlight arrives from the Sun at the origin; see sunlightDirection.
  lightDirection: vec3
  occluders: Occluder[]
  sunRadius: number
  // Saturn's ring casts a shadow band on the planet.
  ringRadii?: [number, number]
  // Rim-glow color and intensity.
  atmosphere?: Rgba
  bumpIntensity?: number
  hemisphereTints?: { north: Rgba; south: Rgba }
  material: SurfaceMaterial
  // How bright the lights on the night side shine (Earth's cities); 0 or absent for none.
  nightLights?: number
  // A moon's night side lit by its planet (see litBodyShader.ts's earthshine); 0 or absent for none.
  earthshine?: number
  // Drives the ocean's glitter and the clouds' drift.
  timeSeconds: number
  // Whether Earth's clouds are shown, and so cast their shadows.
  clouds: boolean
}

// The lit shader expects the direction from the Sun toward the body, i.e. its normalized position.
export function sunlightDirection(position: readonly number[]): vec3 {
  return vec3.normalize(vec3.create(), vec3.fromValues(position[0], position[1], position[2]))
}

// Packs litSphereShaderCode's Uniforms struct (see its layout comment); unused slots stay zero.
export function packLitBodyUniforms(shading: LitBodyShading, viewpoint: Viewpoint): Float32Array<ArrayBuffer> {
  const uniforms = new Float32Array(LIT_UNIFORM_FLOAT_COUNT)
  uniforms.set(worldViewProjection(viewpoint, shading.world), 0)
  uniforms.set(shading.world, 16)
  uniforms.set([...shading.color, 1.0], 32)
  uniforms.set([...shading.lightDirection, 0], 36)
  uniforms.set([...viewpoint.position, 0], 40)
  shading.occluders.slice(0, MAX_OCCLUDERS).forEach((occluder, slot) => uniforms.set(occluder, 44 + slot * 4))
  uniforms.set([shading.sunRadius, ...(shading.ringRadii ?? [0, 0]), 0], 60)
  if (shading.atmosphere) uniforms.set(shading.atmosphere, 64)
  uniforms.set([shading.bumpIntensity ?? 0, shading.nightLights ?? 0, shading.earthshine ?? 0, 0], 68)
  if (shading.hemisphereTints) {
    uniforms.set(shading.hemisphereTints.north, 72)
    uniforms.set(shading.hemisphereTints.south, 76)
  }
  uniforms.set(packSurfaceMaterial(shading.material, shading), 80)
  return uniforms
}
