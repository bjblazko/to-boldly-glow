import { createUniformBinding, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { createScenePipeline, SOLID_SPHERE_PRIMITIVE } from '../gpu/scenePipeline'
import type { TextureLoader } from '../gpu/textureLoader'
import { worldViewProjection, type Viewpoint } from '../camera/viewpoint'
import { PLANETS, SUN } from '../solarSystem/bodies'
import { MOONS } from '../solarSystem/moons'
import { saturnRingRadii } from '../saturnRing/saturnRing'
import { bodyWorldMatrix, type MoonPose, type PlanetPose, type SceneLayout, type SunPose } from '../scene/sceneLayout'
import { LIT_UNIFORM_FLOAT_COUNT, litSphereShaderCode } from './litBodyShader'
import { packLitBodyUniforms, sunlightDirection, type Occluder } from './litBodyUniforms'
import { createSphereMeshBuffers, drawSphere, SPHERE_VERTEX_BUFFERS, type SphereMeshBuffers } from './sphereMesh'
import { unlitSphereShaderCode } from './sunShader'
import { createBodySampler } from './bodySampler'

const SUN_UNIFORM_FLOAT_COUNT = 20

interface TexturedBody {
  id: string
  textureUrl?: string
  bumpMapUrl?: string
}

interface BindingContext {
  device: GPUDevice
  textures: TextureLoader
  sampler: GPUSampler
}

// Draws the Sun (self-lit) and every planet and moon (sunlit, shadowed by their moons or parent)
// that the frame's scene layout contains.
export class BodyRenderer {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipelines: { sun: GPURenderPipeline; lit: GPURenderPipeline },
    readonly sphereMesh: SphereMeshBuffers,
    private readonly bindings: { sun: UniformBinding; litBodies: Map<string, UniformBinding> },
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat, textures: TextureLoader): Promise<BodyRenderer> {
    const sunPipeline = await createScenePipeline(device, sphereSpec('unlit sphere', unlitSphereShaderCode, format))
    const litPipeline = await createScenePipeline(device, sphereSpec('lit sphere', litSphereShaderCode, format))
    const context: BindingContext = { device, textures, sampler: createBodySampler(device) }
    const sun = await createTexturedBinding(context, sunPipeline, SUN)
    const flatHeight = textures.flatHeight()
    const litBodies = await Promise.all(
      [...PLANETS, ...MOONS].map(async (body) => {
        const height = body.bumpMapUrl ? await textures.loadHeight(body.bumpMapUrl) : flatHeight
        return [body.id, await createTexturedBinding(context, litPipeline, body, height)] as const
      }),
    )
    return new BodyRenderer(device, { sun: sunPipeline, lit: litPipeline }, createSphereMeshBuffers(device), { sun, litBodies: new Map(litBodies) })
  }

  // sunBrightness > 1 pushes the Sun past the bloom pass's threshold (see bloom/bloom.ts).
  update(layout: SceneLayout, viewpoint: Viewpoint, sunBrightness: number): void {
    this.writeSun(layout.sun, viewpoint, sunBrightness)
    for (const planet of layout.planets) this.writePlanet(planet, layout, viewpoint)
    for (const moon of layout.moons) this.writeMoon(moon, layout.sun.radius, viewpoint)
  }

  draw(pass: GPURenderPassEncoder, layout: SceneLayout): void {
    pass.setPipeline(this.pipelines.sun)
    drawSphere(pass, this.sphereMesh, this.bindings.sun.bindGroup)
    pass.setPipeline(this.pipelines.lit)
    for (const body of [...layout.planets, ...layout.moons]) {
      drawSphere(pass, this.sphereMesh, this.bindings.litBodies.get(body.definition.id)!.bindGroup)
    }
  }

  private writeSun(sun: SunPose, viewpoint: Viewpoint, brightness: number): void {
    const uniforms = new Float32Array(SUN_UNIFORM_FLOAT_COUNT)
    uniforms.set(worldViewProjection(viewpoint, bodyWorldMatrix(sun)), 0)
    uniforms.set([...SUN.color.map((channel) => channel * brightness), 1.0], 16)
    writeUniforms(this.device, this.bindings.sun, uniforms)
  }

  private writePlanet(planet: PlanetPose, layout: SceneLayout, viewpoint: Viewpoint): void {
    const { atmosphereColor, atmosphereIntensity, bumpIntensity, color } = planet.definition
    const moonShadows = layout.moons.filter((moon) => moon.parent === planet).map(occluderOf)
    const uniforms = packLitBodyUniforms(
      {
        world: bodyWorldMatrix(planet),
        color,
        lightDirection: sunlightDirection(planet.position),
        occluders: moonShadows,
        sunRadius: layout.sun.radius,
        ringRadii: saturnRingRadii(planet),
        atmosphere: atmosphereColor && atmosphereIntensity ? [...atmosphereColor, atmosphereIntensity] : undefined,
        bumpIntensity,
        hemisphereTints: planet.hemisphereTints,
      },
      viewpoint,
    )
    writeUniforms(this.device, this.bindings.litBodies.get(planet.definition.id)!, uniforms)
  }

  // A moon is only ever shadowed by its parent (an eclipse of the moon by its planet).
  private writeMoon(moon: MoonPose, sunRadius: number, viewpoint: Viewpoint): void {
    const uniforms = packLitBodyUniforms(
      {
        world: bodyWorldMatrix(moon),
        color: moon.definition.color,
        lightDirection: sunlightDirection(moon.position),
        occluders: [occluderOf(moon.parent)],
        sunRadius,
        bumpIntensity: moon.definition.bumpIntensity,
      },
      viewpoint,
    )
    writeUniforms(this.device, this.bindings.litBodies.get(moon.definition.id)!, uniforms)
  }
}

function occluderOf(body: { position: readonly number[]; radius: number }): Occluder {
  return [body.position[0], body.position[1], body.position[2], body.radius]
}

function sphereSpec(label: string, code: string, format: GPUTextureFormat) {
  return { label, code, format, buffers: SPHERE_VERTEX_BUFFERS, primitive: SOLID_SPHERE_PRIMITIVE, depth: { write: true, compare: 'less' as const } }
}

// Bodies without a texture of their own (moons Voyager only partly imaged) get a white one, so their
// flat `color` tint shows unchanged. The Sun's pipeline declares no height map binding, so it gets none.
async function createTexturedBinding(
  context: BindingContext,
  pipeline: GPURenderPipeline,
  body: TexturedBody,
  heightMap?: GPUTexture,
): Promise<UniformBinding> {
  const color = body.textureUrl ? await context.textures.loadColor(body.textureUrl) : context.textures.white()
  const resources: GPUBindingResource[] = [color.createView(), context.sampler]
  if (heightMap) resources.push(heightMap.createView())
  const floatCount = heightMap ? LIT_UNIFORM_FLOAT_COUNT : SUN_UNIFORM_FLOAT_COUNT
  return createUniformBinding(context.device, pipeline, { label: body.id, floatCount, resources })
}
