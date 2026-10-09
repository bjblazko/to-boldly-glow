import { createUniformBinding, createVertexBuffer, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ALPHA_BLEND, createScenePipeline } from '../gpu/scenePipeline'
import type { TextureLoader } from '../gpu/textureLoader'
import { worldViewProjection, type Viewpoint } from '../camera/viewpoint'
import { createBodySampler } from '../bodies/bodySampler'
import { sunlightDirection } from '../bodies/litBodyUniforms'
import { findPlanet, tiltedFrameMatrix, type PlanetPose, type SceneLayout } from '../scene/sceneLayout'
import { generateRingMesh, RING_INNER_RADIUS_FACTOR, RING_OUTER_RADIUS_FACTOR } from './ringMesh'
import { ringShaderCode } from './ringShader'

const RING_UNIFORM_FLOAT_COUNT = 36

const RING_VERTEX_BUFFERS: GPUVertexBufferLayout[] = [
  { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
  { arrayStride: 2 * 4, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x2' }] },
]

// World-space inner and outer ring radius - Saturn's shader needs them for the ring's shadow band.
export function saturnRingRadii(planet: PlanetPose): [number, number] | undefined {
  if (planet.definition.id !== 'saturn') return undefined
  return [planet.radius * RING_INNER_RADIUS_FACTOR, planet.radius * RING_OUTER_RADIUS_FACTOR]
}

interface RingGeometry {
  vertexBuffers: GPUBuffer[]
  indexBuffer: GPUBuffer
  indexCount: number
}

// A flat, textured annulus in Saturn's equatorial plane. Its texture's alpha is real transparency
// (the Cassini Division), and it is visible from both sides.
export class SaturnRing {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly geometry: RingGeometry,
    private readonly uniforms: UniformBinding,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat, textures: TextureLoader): Promise<SaturnRing> {
    const pipeline = await createScenePipeline(device, {
      label: 'ring',
      code: ringShaderCode,
      format,
      buffers: RING_VERTEX_BUFFERS,
      blend: ALPHA_BLEND,
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      // Depth-tested but not written: the ring hides nothing behind it beyond what its alpha implies.
      depth: { write: false, compare: 'less' },
    })
    const texture = await textures.loadColor('textures/saturn_ring.png')
    const uniforms = createUniformBinding(device, pipeline, {
      label: 'saturn ring',
      floatCount: RING_UNIFORM_FLOAT_COUNT,
      resources: [texture.createView(), createBodySampler(device)],
    })
    return new SaturnRing(device, pipeline, createRingGeometry(device), uniforms)
  }

  update(layout: SceneLayout, viewpoint: Viewpoint): void {
    const saturn = findPlanet(layout, 'saturn')
    if (!saturn) return
    const world = tiltedFrameMatrix(saturn, saturn.radius)
    const uniforms = new Float32Array(RING_UNIFORM_FLOAT_COUNT)
    uniforms.set(worldViewProjection(viewpoint, world), 0)
    uniforms.set(world, 16)
    uniforms.set([...sunlightDirection(saturn.position), 0], 32)
    writeUniforms(this.device, this.uniforms, uniforms)
  }

  // Must come after every opaque sphere, so the depth test hides the ring's far side behind Saturn.
  draw(pass: GPURenderPassEncoder, layout: SceneLayout): void {
    if (!findPlanet(layout, 'saturn')) return
    pass.setPipeline(this.pipeline)
    this.geometry.vertexBuffers.forEach((buffer, slot) => pass.setVertexBuffer(slot, buffer))
    pass.setIndexBuffer(this.geometry.indexBuffer, 'uint32')
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.drawIndexed(this.geometry.indexCount)
  }
}

function createRingGeometry(device: GPUDevice): RingGeometry {
  const mesh = generateRingMesh(RING_INNER_RADIUS_FACTOR, RING_OUTER_RADIUS_FACTOR, 128)
  return {
    vertexBuffers: [createVertexBuffer(device, 'ring positions', mesh.positions), createVertexBuffer(device, 'ring uvs', mesh.uvs)],
    indexBuffer: createVertexBuffer(device, 'ring indices', mesh.indices, GPUBufferUsage.INDEX),
    indexCount: mesh.indices.length,
  }
}
