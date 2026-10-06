import { createUniformBinding, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ALPHA_BLEND, createScenePipeline, SOLID_SPHERE_PRIMITIVE } from '../gpu/scenePipeline'
import { worldViewProjection, type Viewpoint } from '../camera/viewpoint'
import { drawSphere, SPHERE_VERTEX_BUFFERS, type SphereMeshBuffers } from '../bodies/sphereMesh'
import { sunlightDirection } from '../bodies/litBodyUniforms'
import { bodyWorldMatrix, type PlanetPose, type SceneLayout } from '../scene/sceneLayout'
import { CLOUD_ALTITUDE } from './cloudCoverWgsl'
import { CLOUD_LAYER_UNIFORM_FLOAT_COUNT, cloudLayerShaderCode } from './cloudLayerShader'

const CLOUD_OPACITY = 0.9

// Earth's light cloud cover, drawn over the planet after every opaque body. Its shadows on the
// ground come from the same cloud cover, in the lit body shader.
export class CloudLayer {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly sphereMesh: SphereMeshBuffers,
    private readonly binding: UniformBinding,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat, sphereMesh: SphereMeshBuffers): Promise<CloudLayer> {
    const pipeline = await createScenePipeline(device, {
      label: 'cloud layer',
      code: cloudLayerShaderCode,
      format,
      buffers: SPHERE_VERTEX_BUFFERS,
      blend: ALPHA_BLEND,
      primitive: SOLID_SPHERE_PRIMITIVE,
      depth: { write: false, compare: 'less' },
    })
    return new CloudLayer(device, pipeline, sphereMesh, createUniformBinding(device, pipeline, { label: 'cloud layer', floatCount: CLOUD_LAYER_UNIFORM_FLOAT_COUNT }))
  }

  update(layout: SceneLayout, viewpoint: Viewpoint, timeSeconds: number): void {
    const earth = earthOf(layout)
    if (!earth) return
    const world = bodyWorldMatrix(earth, earth.radius * (1 + CLOUD_ALTITUDE))
    const uniforms = new Float32Array(CLOUD_LAYER_UNIFORM_FLOAT_COUNT)
    uniforms.set(worldViewProjection(viewpoint, world), 0)
    uniforms.set(world, 16)
    uniforms.set([...sunlightDirection(earth.position), 0], 32)
    uniforms.set([...viewpoint.position, 0], 36)
    uniforms.set([timeSeconds, CLOUD_OPACITY, 0, 0], 40)
    writeUniforms(this.device, this.binding, uniforms)
  }

  // Translucent: drawn after all opaque geometry.
  draw(pass: GPURenderPassEncoder, layout: SceneLayout): void {
    if (!earthOf(layout)) return
    pass.setPipeline(this.pipeline)
    drawSphere(pass, this.sphereMesh, this.binding.bindGroup)
  }
}

function earthOf(layout: SceneLayout): PlanetPose | undefined {
  return layout.planets.find((planet) => planet.definition.id === 'earth')
}
