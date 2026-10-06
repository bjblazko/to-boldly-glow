import { createUniformBinding, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ALPHA_BLEND, createScenePipeline, SOLID_SPHERE_PRIMITIVE } from '../gpu/scenePipeline'
import { worldViewProjection, type Viewpoint } from '../camera/viewpoint'
import { drawSphere, SPHERE_VERTEX_BUFFERS, type SphereMeshBuffers } from '../bodies/sphereMesh'
import { sunlightDirection } from '../bodies/litBodyUniforms'
import { bodyWorldMatrix, type PlanetPose, type SceneLayout } from '../scene/sceneLayout'
import type { Rgb } from '../math/tuples'
import { ATMOSPHERE_SHELL_UNIFORM_FLOAT_COUNT, atmosphereShellShaderCode } from './atmosphereShellShader'

// How each planet's atmosphere looks from space, beyond what its surface shows: how far the shell
// reaches past the surface, how sharply it gathers at the limb, whether it still glows on the
// night side (the gas giants' deep atmospheres) or only where sunlit (Earth's thin one), and the
// color it turns along the terminator.
interface ShellProfile {
  radiusFactor: number
  rimExponent: number
  nightLight: number
  sunset?: { color: Rgb; strength: number }
}

const GAS_GIANT: ShellProfile = { radiusFactor: 1.035, rimExponent: 2, nightLight: 0.3 }
const SHELLS: Readonly<Record<string, ShellProfile>> = {
  venus: { radiusFactor: 1.03, rimExponent: 2.5, nightLight: 0, sunset: { color: [1, 0.7, 0.4], strength: 0.4 } },
  earth: { radiusFactor: 1.025, rimExponent: 3, nightLight: 0, sunset: { color: [1, 0.55, 0.3], strength: 0.8 } },
  jupiter: GAS_GIANT,
  saturn: GAS_GIANT,
  uranus: GAS_GIANT,
  neptune: GAS_GIANT,
}

// A slightly larger, translucent sphere around each planet with a substantial atmosphere, thin
// when seen straight down and thicker toward the limb, glowing past the planet's edge - the look of
// an atmosphere seen from space.
export class AtmosphereShells {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly sphereMesh: SphereMeshBuffers,
    private readonly shells: Map<string, UniformBinding>,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat, sphereMesh: SphereMeshBuffers): Promise<AtmosphereShells> {
    const pipeline = await createScenePipeline(device, {
      label: 'atmosphere shell',
      code: atmosphereShellShaderCode,
      format,
      buffers: SPHERE_VERTEX_BUFFERS,
      blend: ALPHA_BLEND,
      primitive: SOLID_SPHERE_PRIMITIVE,
      depth: { write: false, compare: 'less' },
    })
    const shells = Object.keys(SHELLS).map(
      (id) => [id, createUniformBinding(device, pipeline, { label: `${id} atmosphere shell`, floatCount: ATMOSPHERE_SHELL_UNIFORM_FLOAT_COUNT })] as const,
    )
    return new AtmosphereShells(device, pipeline, sphereMesh, new Map(shells))
  }

  update(layout: SceneLayout, viewpoint: Viewpoint): void {
    for (const planet of this.shelledPlanets(layout)) {
      const { atmosphereColor, atmosphereIntensity, id } = planet.definition
      const profile = SHELLS[id]
      const world = bodyWorldMatrix(planet, planet.radius * profile.radiusFactor)
      const uniforms = new Float32Array(ATMOSPHERE_SHELL_UNIFORM_FLOAT_COUNT)
      uniforms.set(worldViewProjection(viewpoint, world), 0)
      uniforms.set(world, 16)
      uniforms.set([...atmosphereColor!, atmosphereIntensity!], 32)
      uniforms.set([...sunlightDirection(planet.position), 0], 36)
      uniforms.set([...viewpoint.position, 0], 40)
      uniforms.set([profile.rimExponent, profile.nightLight, profile.nightLight > 0 ? 0 : 1, 0], 44)
      if (profile.sunset) uniforms.set([...profile.sunset.color, profile.sunset.strength], 48)
      writeUniforms(this.device, this.shells.get(id)!, uniforms)
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
