import { createUniformBinding, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ALPHA_BLEND, createScenePipeline, SOLID_SPHERE_PRIMITIVE } from '../gpu/scenePipeline'
import { worldViewProjection, type Viewpoint } from '../camera/viewpoint'
import { drawSphere, SPHERE_VERTEX_BUFFERS, type SphereMeshBuffers } from '../bodies/sphereMesh'
import { sunlightDirection } from '../bodies/litBodyUniforms'
import { bodyWorldMatrix, type PlanetPose, type SceneLayout } from '../scene/sceneLayout'
import { CLOUD_SHELL_UNIFORM_FLOAT_COUNT, cloudShellShaderCode } from './cloudShellShader'

// Only the gas giants get a cloud shell; Earth's and Venus's atmospheres are a rim glow in the lit
// body shader instead.
const GAS_GIANT_IDS = ['jupiter', 'saturn', 'uranus', 'neptune']
const CLOUD_SHELL_RADIUS_FACTOR = 1.035

// A slightly larger, translucent sphere around each gas giant, thin when seen straight down and
// thicker toward the limb - the look of a deep atmosphere seen from space.
export class CloudShells {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly sphereMesh: SphereMeshBuffers,
    private readonly shells: Map<string, UniformBinding>,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat, sphereMesh: SphereMeshBuffers): Promise<CloudShells> {
    const pipeline = await createScenePipeline(device, {
      label: 'cloud shell',
      code: cloudShellShaderCode,
      format,
      buffers: SPHERE_VERTEX_BUFFERS,
      blend: ALPHA_BLEND,
      primitive: SOLID_SPHERE_PRIMITIVE,
      depth: { write: false, compare: 'less' },
    })
    const shells = GAS_GIANT_IDS.map((id) => [id, createUniformBinding(device, pipeline, { label: `${id} cloud shell`, floatCount: CLOUD_SHELL_UNIFORM_FLOAT_COUNT })] as const)
    return new CloudShells(device, pipeline, sphereMesh, new Map(shells))
  }

  update(layout: SceneLayout, viewpoint: Viewpoint): void {
    for (const planet of this.shelledPlanets(layout)) {
      const { atmosphereColor, atmosphereIntensity } = planet.definition
      const world = bodyWorldMatrix(planet, planet.radius * CLOUD_SHELL_RADIUS_FACTOR)
      const uniforms = new Float32Array(CLOUD_SHELL_UNIFORM_FLOAT_COUNT)
      uniforms.set(worldViewProjection(viewpoint, world), 0)
      uniforms.set(world, 16)
      uniforms.set([...atmosphereColor!, atmosphereIntensity!], 32)
      uniforms.set([...sunlightDirection(planet.position), 0], 36)
      uniforms.set([...viewpoint.position, 0], 40)
      writeUniforms(this.device, this.shells.get(planet.definition.id)!, uniforms)
    }
  }

  // Translucent: drawn after all opaque geometry.
  draw(pass: GPURenderPassEncoder, layout: SceneLayout): void {
    pass.setPipeline(this.pipeline)
    for (const planet of this.shelledPlanets(layout)) {
      drawSphere(pass, this.sphereMesh, this.shells.get(planet.definition.id)!.bindGroup)
    }
  }

  private shelledPlanets(layout: SceneLayout): PlanetPose[] {
    return layout.planets.filter(
      (planet) => this.shells.has(planet.definition.id) && planet.definition.atmosphereColor && planet.definition.atmosphereIntensity,
    )
  }
}
