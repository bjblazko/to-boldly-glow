import { createUniformBinding, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ALPHA_BLEND, createScenePipeline, SOLID_SPHERE_PRIMITIVE } from '../gpu/scenePipeline'
import { worldViewProjection, type Viewpoint } from '../camera/viewpoint'
import { drawSphere, SPHERE_VERTEX_BUFFERS, type SphereMeshBuffers } from '../bodies/sphereMesh'
import { sunlightDirection } from '../bodies/litBodyUniforms'
import { bodyWorldMatrix, type PlanetPose, type SceneLayout } from '../scene/sceneLayout'
import type { Rgb } from '../math/tuples'
import { ATMOSPHERE_SHELL_UNIFORM_FLOAT_COUNT, atmosphereShellShaderCode } from './atmosphereShellShader'

// How each planet's atmosphere looks from space, beyond what its surface shows: how high the shell
// reaches above what the planet shows as its surface (to scale), how sharply it gathers at the limb, whether it still glows on the
// night side (the gas giants' deep atmospheres) or only where sunlit (Earth's thin one), and the
// color it turns along the terminator.
interface ShellProfile {
  // Kilometres above the surface drawn: Earth's ground; for Venus and the giants, their cloud tops.
  heightKm: number
  rimExponent: number
  nightLight: number
  // How brightly it glows when backlit by the Sun (forward scattering).
  backlitGlow: number
  sunset?: { color: Rgb; strength: number }
}

// The heights are the air that shows at the limb, roughly: Earth's up to the Kármán line (100 km);
// Venus's haze above its clouds (to about 90 km over the ground, the clouds drawn as its surface);
// over the giants' cloud tops, the hazes seen at their limbs in spacecraft images - a few hundred
// km, a few scale heights (Jupiter ~27 km, Saturn ~60 km, Uranus and Neptune ~25 km). All well
// under one percent of the radius but Earth's and Venus's (1.6 and 1.5 percent).
const GAS_GIANT = { rimExponent: 2, nightLight: 0.3, backlitGlow: 0.5 }
const SHELLS: Readonly<Record<string, ShellProfile>> = {
  venus: { heightKm: 90, rimExponent: 2.5, nightLight: 0, backlitGlow: 1.2, sunset: { color: [1, 0.7, 0.4], strength: 0.4 } },
  earth: { heightKm: 100, rimExponent: 4, nightLight: 0, backlitGlow: 1, sunset: { color: [1, 0.45, 0.2], strength: 0.8 } },
  jupiter: { heightKm: 300, ...GAS_GIANT },
  saturn: { heightKm: 400, ...GAS_GIANT },
  uranus: { heightKm: 200, ...GAS_GIANT },
  neptune: { heightKm: 200, ...GAS_GIANT },
}

// The shell's radius in the planet's radii.
export function shellRadiusFactor(planet: { id: string; radiusKm: number }): number {
  return 1 + (SHELLS[planet.id]?.heightKm ?? 0) / planet.radiusKm
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
      const world = bodyWorldMatrix(planet, planet.radius * shellRadiusFactor(planet.definition))
      const uniforms = new Float32Array(ATMOSPHERE_SHELL_UNIFORM_FLOAT_COUNT)
      uniforms.set(worldViewProjection(viewpoint, world), 0)
      uniforms.set(world, 16)
      uniforms.set([...atmosphereColor!, atmosphereIntensity!], 32)
      uniforms.set([...sunlightDirection(planet.position), 0], 36)
      uniforms.set([...viewpoint.position, 0], 40)
      uniforms.set([profile.rimExponent, profile.nightLight, profile.nightLight > 0 ? 0 : 1, profile.backlitGlow], 44)
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
