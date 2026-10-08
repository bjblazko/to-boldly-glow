import { drawSphere, SPHERE_VERTEX_BUFFERS, type SphereMeshBuffers } from '../bodies/sphereMesh'
import { worldViewProjection, type Viewpoint } from '../camera/viewpoint'
import { createUniformBinding, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ADDITIVE_BLEND, createScenePipeline, SOLID_SPHERE_PRIMITIVE } from '../gpu/scenePipeline'
import { bodyWorldMatrix, type PlanetPose, type SceneLayout } from '../scene/sceneLayout'
import { AURORA_SHELL_RADIUS, auroraActivity } from './auroraOval'
import { AURORA_UNIFORM_FLOAT_COUNT, auroraShaderCode } from './auroraShader'

// Earth's northern and southern lights (see auroraShader.ts), on a shell around the planet that is
// drawn after everything opaque and adds its light to the picture.
export class Aurora {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly sphereMesh: SphereMeshBuffers,
    private readonly binding: UniformBinding,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat, sphereMesh: SphereMeshBuffers): Promise<Aurora> {
    const pipeline = await createScenePipeline(device, {
      label: 'aurora',
      code: auroraShaderCode,
      format,
      buffers: SPHERE_VERTEX_BUFFERS,
      blend: ADDITIVE_BLEND,
      primitive: SOLID_SPHERE_PRIMITIVE,
      depth: { write: false, compare: 'less' },
    })
    return new Aurora(device, pipeline, sphereMesh, createUniformBinding(device, pipeline, { label: 'aurora', floatCount: AURORA_UNIFORM_FLOAT_COUNT }))
  }

  // timeSeconds: wall-clock time, so the curtains move at their own pace whatever the clock's rate.
  update(layout: SceneLayout, viewpoint: Viewpoint, timeSeconds: number): void {
    const earth = earthOf(layout)
    if (!earth) return
    const [x, y, z] = earth.position
    const distance = Math.hypot(x, y, z)
    const uniforms = new Float32Array(AURORA_UNIFORM_FLOAT_COUNT)
    uniforms.set(worldViewProjection(viewpoint, bodyWorldMatrix(earth, earth.radius * AURORA_SHELL_RADIUS)), 0)
    uniforms.set(bodyWorldMatrix(earth, 1), 16)
    uniforms.set([x, y, z, earth.radius], 32)
    uniforms.set([...viewpoint.position, timeSeconds], 36)
    uniforms.set([-x / distance, -y / distance, -z / distance, auroraActivity(timeSeconds)], 40)
    writeUniforms(this.device, this.binding, uniforms)
  }

  draw(pass: GPURenderPassEncoder, layout: SceneLayout): void {
    if (!earthOf(layout)) return
    pass.setPipeline(this.pipeline)
    drawSphere(pass, this.sphereMesh, this.binding.bindGroup)
  }
}

function earthOf(layout: SceneLayout): PlanetPose | undefined {
  return layout.planets.find((planet) => planet.definition.id === 'earth')
}
