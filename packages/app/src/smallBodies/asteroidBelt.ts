import type { Viewpoint } from '../camera/viewpoint'
import { createUniformBinding, createVertexBuffer, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { BILLBOARD_PRIMITIVE, createScenePipeline } from '../gpu/scenePipeline'
import { AU_KM } from '../solarSystem/bodies'
import { AU_TO_SCENE_UNITS, COMPACT_DISTANCE_SCALE } from '../solarSystem/sceneScale'
import { asteroidPopulation, FLOATS_PER_ASTEROID } from './asteroidPopulation'
import { ASTEROID_COMPUTE_UNIFORM_FLOAT_COUNT, ASTEROID_WORKGROUP_SIZE, asteroidOrbitComputeCode, asteroidRockListComputeCode } from './asteroidCompute'
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

// The distant asteroids: one point per vertex, non-instanced - the orbit record's second half
// (orientation, size, color) and the position the orbit pass wrote.
const POINT_BUFFERS: GPUVertexBufferLayout[] = [
  { arrayStride: FLOATS_PER_ASTEROID * 4, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 4 * 4, format: 'float32x4' }] },
  { arrayStride: 4 * 4, stepMode: 'vertex', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }] },
]

// The near rocks: one instance each, from the list the rock pass wrote (orientation, position).
const ROCK_BUFFERS: GPUVertexBufferLayout[] = [
  {
    arrayStride: 8 * 4,
    stepMode: 'instance',
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x4' },
      { shaderLocation: 1, offset: 4 * 4, format: 'float32x4' },
    ],
  },
]

// The asteroids barely move from one frame to the next: their orbits are solved again only once the
// simulated time has moved on by this much (about half an hour), or the scale has changed.
const RECOMPUTE_AFTER_DAYS = 0.02

export interface OrbitClock {
  daysSinceEpoch: number
  scaleBlend: number
}

interface ComputeStep {
  pipeline: GPUComputePipeline
  bindGroup: GPUBindGroup
}

interface AsteroidBuffers {
  orbits: GPUBuffer
  positions: GPUBuffer
  rocks: GPUBuffer
  drawArguments: GPUBuffer
  computeUniforms: GPUBuffer
  count: number
}

// The main asteroid belt, the Hildas, Jupiter's Trojans and the Kuiper belt (see
// asteroidPopulation.ts), plus the real dwarf planets and largest asteroids, all moving on their
// orbits. Compute passes place them and pick out the few near enough to show as rocks; the rest are
// points of light in a single draw (see asteroidCompute.ts and asteroidShader.ts).
export class AsteroidBelt {
  private solvedFor: OrbitClock | null = null
  private needsOrbits = false

  private constructor(
    private readonly device: GPUDevice,
    private readonly pipelines: { points: GPURenderPipeline; rocks: GPURenderPipeline; drawUniforms: UniformBinding; rockBindGroup: GPUBindGroup },
    private readonly steps: { orbits: ComputeStep; rockList: ComputeStep },
    private readonly buffers: AsteroidBuffers,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<AsteroidBelt> {
    const buffers = createAsteroidBuffers(device, asteroidInstances())
    const [points, rocks, orbitPipeline, rockListPipeline] = await Promise.all([
      createDrawPipeline(device, format, { entry: 'Point', buffers: POINT_BUFFERS, primitive: { topology: 'point-list' } }),
      createDrawPipeline(device, format, { entry: 'Rock', buffers: ROCK_BUFFERS, primitive: BILLBOARD_PRIMITIVE }),
      createComputePipeline(device, 'asteroid orbit', asteroidOrbitComputeCode),
      createComputePipeline(device, 'asteroid rock list', asteroidRockListComputeCode),
    ])
    const { orbits, positions, drawArguments, computeUniforms } = buffers
    const steps = {
      orbits: computeStep(device, orbitPipeline, [computeUniforms, orbits, positions]),
      rockList: computeStep(device, rockListPipeline, [computeUniforms, orbits, positions, drawArguments, buffers.rocks]),
    }
    // Both draws read the same uniform buffer, through a bind group for each pipeline's own layout.
    const drawUniforms = createUniformBinding(device, points, { label: 'asteroid', floatCount: ASTEROID_UNIFORM_FLOAT_COUNT })
    const rockBindGroup = device.createBindGroup({ label: 'asteroid rocks', layout: rocks.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: drawUniforms.buffer } }] })
    return new AsteroidBelt(device, { points, rocks, drawUniforms, rockBindGroup }, steps, buffers)
  }

  get count(): number {
    return this.buffers.count
  }

  update(viewpoint: Viewpoint, clock: OrbitClock): void {
    // projection[5] = 1 / tan(fov / 2): CSS pixels per radian near the center of the view.
    const pixelsPerRadian = (viewpoint.projection[5] * viewpoint.cssPixels.height) / 2
    this.needsOrbits ||= this.timeMovedOn(clock)
    this.writeComputeUniforms(viewpoint, clock, pixelsPerRadian)
    const { width, height } = viewpoint.cssPixels
    const uniforms = new Float32Array(ASTEROID_UNIFORM_FLOAT_COUNT)
    uniforms.set(viewpoint.viewProjection, 0)
    uniforms.set(viewpoint.view, 16)
    uniforms.set([...viewpoint.position, 0], 32)
    uniforms.set([0, clock.scaleBlend, 0, 0], 36)
    uniforms.set([2 / width, 2 / height, pixelsPerRadian, DOT_BRIGHTNESS], 40)
    uniforms.set([AU_TO_SCENE_UNITS / AU_KM, COMPACT_SIZE_PER_SQRT_KM, 0, 0], 44)
    writeUniforms(this.device, this.pipelines.drawUniforms, uniforms)
  }

  private writeComputeUniforms(viewpoint: Viewpoint, clock: OrbitClock, pixelsPerRadian: number): void {
    const computeUniforms = new Float32Array(ASTEROID_COMPUTE_UNIFORM_FLOAT_COUNT)
    computeUniforms.set([clock.daysSinceEpoch, clock.scaleBlend, AU_TO_SCENE_UNITS, COMPACT_DISTANCE_SCALE], 0)
    computeUniforms.set([...viewpoint.position, this.buffers.count], 4)
    computeUniforms.set([AU_TO_SCENE_UNITS / AU_KM, COMPACT_SIZE_PER_SQRT_KM, pixelsPerRadian, clock.scaleBlend], 8)
    this.device.queue.writeBuffer(this.buffers.computeUniforms, 0, computeUniforms)
    // The rock list is rebuilt every frame: start it empty.
    this.device.queue.writeBuffer(this.buffers.drawArguments, 4, new Uint32Array([0]))
  }

  // Before the scene pass: moves the asteroids along their orbits (if they have moved enough to
  // see) and lists the ones near enough to be rocks.
  placeOnOrbits(encoder: GPUCommandEncoder): void {
    const pass = encoder.beginComputePass({ label: 'asteroids' })
    const workgroups = Math.ceil(this.buffers.count / ASTEROID_WORKGROUP_SIZE)
    const steps = this.needsOrbits ? [this.steps.orbits, this.steps.rockList] : [this.steps.rockList]
    for (const step of steps) {
      pass.setPipeline(step.pipeline)
      pass.setBindGroup(0, step.bindGroup)
      pass.dispatchWorkgroups(workgroups)
    }
    pass.end()
    this.needsOrbits = false
  }

  // After the opaque bodies, so the depth test hides asteroids behind them.
  draw(pass: GPURenderPassEncoder): void {
    const { points, rocks, drawUniforms, rockBindGroup } = this.pipelines
    pass.setPipeline(points)
    pass.setBindGroup(0, drawUniforms.bindGroup)
    pass.setVertexBuffer(0, this.buffers.orbits)
    pass.setVertexBuffer(1, this.buffers.positions)
    pass.draw(this.buffers.count)
    pass.setPipeline(rocks)
    pass.setBindGroup(0, rockBindGroup)
    pass.setVertexBuffer(0, this.buffers.rocks)
    pass.drawIndirect(this.buffers.drawArguments, 0)
  }

  private timeMovedOn(clock: OrbitClock): boolean {
    const last = this.solvedFor
    if (last && Math.abs(clock.daysSinceEpoch - last.daysSinceEpoch) < RECOMPUTE_AFTER_DAYS && clock.scaleBlend === last.scaleBlend) return false
    this.solvedFor = { ...clock }
    return true
  }
}

function createAsteroidBuffers(device: GPUDevice, values: Float32Array): AsteroidBuffers {
  const count = values.length / FLOATS_PER_ASTEROID
  const storage = GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE
  const buffer = (label: string, size: number, usage: number) => device.createBuffer({ label, size, usage })
  const drawArguments = buffer('asteroid rock draw', 16, GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST)
  // Four vertices per rock quad; the instance count is filled in by the rock pass.
  device.queue.writeBuffer(drawArguments, 0, new Uint32Array([4, 0, 0, 0]))
  return {
    orbits: createVertexBuffer(device, 'asteroid orbits', values, storage),
    positions: buffer('asteroid positions', count * 16, storage),
    rocks: buffer('asteroid rocks', count * 32, storage),
    drawArguments,
    computeUniforms: buffer('asteroid compute uniforms', ASTEROID_COMPUTE_UNIFORM_FLOAT_COUNT * 4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST),
    count,
  }
}

function computeStep(device: GPUDevice, pipeline: GPUComputePipeline, buffers: GPUBuffer[]): ComputeStep {
  const entries = buffers.map((buffer, binding) => ({ binding, resource: { buffer } }))
  return { pipeline, bindGroup: device.createBindGroup({ label: pipeline.label, layout: pipeline.getBindGroupLayout(0), entries }) }
}

function createDrawPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  { entry, buffers, primitive }: { entry: 'Point' | 'Rock'; buffers: GPUVertexBufferLayout[]; primitive: GPUPrimitiveState },
): Promise<GPURenderPipeline> {
  return createScenePipeline(device, {
    label: `asteroid ${entry.toLowerCase()}`,
    code: asteroidShaderCode,
    entryPoints: { vertex: `vs${entry}`, fragment: `fs${entry}` },
    format,
    buffers,
    blend: PREMULTIPLIED_BLEND,
    primitive,
    // Hidden behind planets, but too small to hide anything themselves.
    depth: { write: false, compare: 'less' },
  })
}

function createComputePipeline(device: GPUDevice, label: string, code: string): Promise<GPUComputePipeline> {
  const module = device.createShaderModule({ label: `${label} shader`, code })
  return device.createComputePipelineAsync({ label, layout: 'auto', compute: { module, entryPoint: 'main' } })
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
