import type { Viewpoint } from '../camera/viewpoint'
import { createUniformBinding, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ADDITIVE_BLEND, createScenePipeline } from '../gpu/scenePipeline'
import type { Rgb } from '../math/tuples'
import type { OrbitClock } from './asteroidBelt'
import { cometState, type CometState } from './cometActivity'
import { COMET_UNIFORM_FLOAT_COUNT, cometShaderCode, FLOATS_PER_COMET_PART, TAIL_SEGMENTS } from './cometShader'
import { COMETS } from './smallBodyCatalog'

const ION_BLUE: Rgb = [0.42, 0.62, 1]
const DUST_WHITE: Rgb = [1, 0.88, 0.7]
const COMA_GREEN: Rgb = [0.62, 1, 0.82]
// How far the dust tail curves back along the orbit, relative to its length.
const DUST_TAIL_BEND = 0.35

const COMET_PART_BUFFERS: GPUVertexBufferLayout[] = [
  {
    arrayStride: FLOATS_PER_COMET_PART * 4,
    stepMode: 'instance',
    attributes: [0, 1, 2, 3].map((location) => ({ shaderLocation: location, offset: location * 16, format: 'float32x4' as const })),
  },
]

// The comets of smallBodyCatalog.ts with their comae and tails (see cometShader.ts), recomputed on
// the CPU every frame - a Kepler solve for each of a handful of comets.
export class CometRenderer {
  private states: CometState[] = []

  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly parts: GPUBuffer,
    private readonly uniforms: UniformBinding,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<CometRenderer> {
    const pipeline = await createScenePipeline(device, {
      label: 'comet',
      code: cometShaderCode,
      format,
      buffers: COMET_PART_BUFFERS,
      blend: ADDITIVE_BLEND,
      primitive: { topology: 'triangle-strip', cullMode: 'none' },
      depth: { write: false, compare: 'less' },
    })
    const parts = device.createBuffer({ label: 'comet parts', size: COMETS.length * 3 * FLOATS_PER_COMET_PART * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST })
    const uniforms = createUniformBinding(device, pipeline, { label: 'comet', floatCount: COMET_UNIFORM_FLOAT_COUNT })
    return new CometRenderer(device, pipeline, parts, uniforms)
  }

  // Where every comet is this frame (camera follow and labels read it too).
  get current(): readonly CometState[] {
    return this.states
  }

  update(viewpoint: Viewpoint, clock: OrbitClock, nowSeconds: number): void {
    this.states = COMETS.map((comet) => cometState(comet, clock.daysSinceEpoch, clock.scaleBlend))
    this.device.queue.writeBuffer(this.parts, 0, packCometParts(this.states))
    const uniforms = new Float32Array(COMET_UNIFORM_FLOAT_COUNT)
    uniforms.set(viewpoint.viewProjection, 0)
    uniforms.set([...viewpoint.position, nowSeconds], 16)
    const { width, height } = viewpoint.cssPixels
    uniforms.set([2 / width, 2 / height, (viewpoint.projection[5] * height) / 2, 0], 20)
    writeUniforms(this.device, this.uniforms, uniforms)
  }

  // After the opaque bodies: tails pass behind planets, not through them.
  draw(pass: GPURenderPassEncoder): void {
    const comets = this.states.length
    if (comets === 0) return
    pass.setPipeline(this.pipeline)
    pass.setVertexBuffer(0, this.parts)
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.draw(2 * (TAIL_SEGMENTS + 1), 2 * comets)
    pass.draw(4, comets, 0, 2 * comets)
  }
}

// Every comet's ion tail and dust tail, then every comet's coma - the order draw() expects.
export function packCometParts(states: readonly CometState[]): Float32Array<ArrayBuffer> {
  const values = new Float32Array(states.length * 3 * FLOATS_PER_COMET_PART)
  states.forEach((state, index) => {
    values.set(ionTail(state), (2 * index) * FLOATS_PER_COMET_PART)
    values.set(dustTail(state), (2 * index + 1) * FLOATS_PER_COMET_PART)
    values.set(coma(state), (2 * states.length + index) * FLOATS_PER_COMET_PART)
  })
  return values
}

function ionTail(state: CometState): number[] {
  const length = state.ionTailLength
  return [...state.position, 0, ...state.antiSunward, length, 0, 0, 0, length * 0.05, ...ION_BLUE, 1.1 * Math.min(state.activity, 1.5)]
}

function dustTail(state: CometState): number[] {
  const length = state.dustTailLength
  const bend = state.behind.map((component) => component * DUST_TAIL_BEND)
  return [...state.position, 1, ...state.antiSunward, length, ...bend, length * 0.22, ...DUST_WHITE, 0.32 * Math.min(state.activity, 1.5)]
}

function coma(state: CometState): number[] {
  return [...state.position, 2, 0, 0, 0, state.comaRadius, 0, 0, 0, 0, ...COMA_GREEN, 0.06 + 1.3 * Math.min(state.activity, 1.5)]
}
