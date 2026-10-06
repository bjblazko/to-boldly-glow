import type { Viewpoint } from '../camera/viewpoint'
import { createUniformBinding, createVertexBuffer, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { BILLBOARD_PRIMITIVE, createScenePipeline } from '../gpu/scenePipeline'
import { AU_KM } from '../solarSystem/bodies'
import { AU_TO_SCENE_UNITS, COMPACT_DISTANCE_SCALE } from '../solarSystem/sceneScale'
import { asteroidPopulation, FLOATS_PER_ASTEROID } from './asteroidPopulation'
import { ASTEROID_UNIFORM_FLOAT_COUNT, asteroidShaderCode } from './asteroidShader'
import { meanMotionRadiansPerDay } from './keplerOrbit'
// Compact scale exaggerates small bodies like it does planets (radius = COMPACT_SIZE_PER_SQRT_KM *
// sqrt(radius in km)), so a 1 km rock is a speck and Ceres (470 km) about a third the Moon's size.
import { COMPACT_SIZE_PER_SQRT_KM, MINOR_PLANETS, type SmallBodyDefinition } from './smallBodyCatalog'

const DOT_BRIGHTNESS = 0.22

// Premultiplied alpha: a close-up rock covers what is behind it, while a distant dot (low alpha)
// mostly adds its light, so thousands of them build up into the glow of a belt.
const PREMULTIPLIED_BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
}

const ASTEROID_INSTANCE_BUFFERS: GPUVertexBufferLayout[] = [
  {
    arrayStride: FLOATS_PER_ASTEROID * 4,
    stepMode: 'instance',
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x4' },
      { shaderLocation: 1, offset: 4 * 4, format: 'float32x4' },
    ],
  },
]

export interface OrbitClock {
  daysSinceEpoch: number
  scaleBlend: number
}

// The main asteroid belt, the Hildas, Jupiter's Trojans and the Kuiper belt (see
// asteroidPopulation.ts), plus the real dwarf planets and largest asteroids, all moving on their
// orbits in one instanced draw (see asteroidShader.ts).
export class AsteroidBelt {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly instances: { buffer: GPUBuffer; count: number },
    private readonly uniforms: UniformBinding,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<AsteroidBelt> {
    const pipeline = await createScenePipeline(device, {
      label: 'asteroid',
      code: asteroidShaderCode,
      format,
      buffers: ASTEROID_INSTANCE_BUFFERS,
      blend: PREMULTIPLIED_BLEND,
      primitive: BILLBOARD_PRIMITIVE,
      // Hidden behind planets, but too small to hide anything themselves.
      depth: { write: false, compare: 'less' },
    })
    const values = asteroidInstances()
    const uniforms = createUniformBinding(device, pipeline, { label: 'asteroid', floatCount: ASTEROID_UNIFORM_FLOAT_COUNT })
    return new AsteroidBelt(device, pipeline, { buffer: createVertexBuffer(device, 'asteroid orbits', values), count: values.length / FLOATS_PER_ASTEROID }, uniforms)
  }

  get count(): number {
    return this.instances.count
  }

  update(viewpoint: Viewpoint, clock: OrbitClock): void {
    const uniforms = new Float32Array(ASTEROID_UNIFORM_FLOAT_COUNT)
    uniforms.set(viewpoint.viewProjection, 0)
    uniforms.set(viewpoint.view, 16)
    uniforms.set([...viewpoint.position, 0], 32)
    uniforms.set([clock.daysSinceEpoch, clock.scaleBlend, AU_TO_SCENE_UNITS, COMPACT_DISTANCE_SCALE], 36)
    const { width, height } = viewpoint.cssPixels
    // projection[5] = 1 / tan(fov / 2): CSS pixels per radian near the center of the view.
    uniforms.set([2 / width, 2 / height, (viewpoint.projection[5] * height) / 2, DOT_BRIGHTNESS], 40)
    uniforms.set([AU_TO_SCENE_UNITS / AU_KM, COMPACT_SIZE_PER_SQRT_KM, 0, 0], 44)
    writeUniforms(this.device, this.uniforms, uniforms)
  }

  // After the opaque bodies, so the depth test hides asteroids behind them.
  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.pipeline)
    pass.setVertexBuffer(0, this.instances.buffer)
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.draw(4, this.instances.count)
  }
}

// The generated populations followed by the named minor planets on their real orbits.
export function asteroidInstances(): Float32Array {
  const population = asteroidPopulation()
  const values = new Float32Array(population.length + MINOR_PLANETS.length * FLOATS_PER_ASTEROID)
  values.set(population)
  MINOR_PLANETS.forEach((body, index) => values.set(minorPlanetInstance(body), population.length + index * FLOATS_PER_ASTEROID))
  return values
}

function minorPlanetInstance({ orbit, radiusKm, color }: SmallBodyDefinition): number[] {
  const degrees = Math.PI / 180
  const meanAnomalyAtJ2000 = -meanMotionRadiansPerDay(orbit.semiMajorAxisAu) * orbit.perihelionDaysSinceJ2000
  const redness = Math.min(Math.max((color[0] - color[2]) * 4, 0), 1)
  return [
    orbit.semiMajorAxisAu,
    orbit.eccentricity,
    orbit.inclinationDegrees * degrees,
    orbit.ascendingNodeDegrees * degrees,
    orbit.perihelionArgumentDegrees * degrees,
    meanAnomalyAtJ2000 % (2 * Math.PI),
    radiusKm,
    redness,
  ]
}
