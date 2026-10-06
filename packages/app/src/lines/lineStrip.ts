import type { mat4 } from 'gl-matrix'
import { createUniformBinding, createVertexBuffer, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { createScenePipeline } from '../gpu/scenePipeline'
import type { Rgba } from '../math/tuples'
import { computeCumulativeLineDistances } from './lineDistance'
import { LINE_UNIFORM_FLOAT_COUNT, lineShaderCode } from './lineShader'

// 'glow' pulses the line's alpha with the given phase (see lineShaderCode's dashParams).
export type LineMode = 'solid' | 'glow'
const LINE_MODE_CODES: Record<LineMode, number> = { solid: 0, glow: 2 }

const LINE_VERTEX_BUFFERS: GPUVertexBufferLayout[] = [
  { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
  { arrayStride: 4, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32' }] },
]

// One pipeline for every world-space line: orbit paths and the lessons' overlay lines. Lines are
// depth-tested (hidden behind planets and the Sun) but don't write depth, so they never occlude
// each other or z-fight with the spheres they are drawn on.
export function createLinePipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  return createScenePipeline(device, {
    label: 'line',
    code: lineShaderCode,
    format,
    buffers: LINE_VERTEX_BUFFERS,
    primitive: { topology: 'line-strip' },
    depth: { write: false, compare: 'less' },
  })
}

// A polyline of world-space points (flat [x0, y0, z0, x1, ...]) with its own color and style.
export class LineStrip {
  private constructor(
    private readonly device: GPUDevice,
    // Each point's position, and its distance along the line (what dashes and glow are keyed to).
    private readonly vertices: { positions: GPUBuffer; distances: GPUBuffer },
    private readonly uniforms: UniformBinding,
    private pointCount: number,
  ) {}

  // The GPU buffers keep the size of these initial points: later updates may not hold more points.
  static create(device: GPUDevice, pipeline: GPURenderPipeline, label: string, initialPoints: Float32Array): LineStrip {
    return new LineStrip(
      device,
      {
        positions: createVertexBuffer(device, `${label} positions`, initialPoints),
        distances: createVertexBuffer(device, `${label} distances`, computeCumulativeLineDistances(initialPoints)),
      },
      createUniformBinding(device, pipeline, { label, floatCount: LINE_UNIFORM_FLOAT_COUNT }),
      initialPoints.length / 3,
    )
  }

  static withCapacity(device: GPUDevice, pipeline: GPURenderPipeline, label: string, pointCount: number): LineStrip {
    return LineStrip.create(device, pipeline, label, new Float32Array(pointCount * 3))
  }

  setPoints(points: Float32Array): void {
    this.device.queue.writeBuffer(this.vertices.positions, 0, points as BufferSource)
    this.device.queue.writeBuffer(this.vertices.distances, 0, computeCumulativeLineDistances(points) as BufferSource)
    this.pointCount = points.length / 3
  }

  setStyle(viewProjection: mat4, color: Rgba, mode: LineMode = 'solid', pulsePhaseRadians = 0): void {
    const uniforms = new Float32Array(LINE_UNIFORM_FLOAT_COUNT)
    uniforms.set(viewProjection, 0)
    uniforms.set(color, 16)
    uniforms.set([0, pulsePhaseRadians, 0, LINE_MODE_CODES[mode]], 20)
    writeUniforms(this.device, this.uniforms, uniforms)
  }

  // Expects the line pipeline to be set on the pass.
  draw(pass: GPURenderPassEncoder): void {
    pass.setVertexBuffer(0, this.vertices.positions)
    pass.setVertexBuffer(1, this.vertices.distances)
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.draw(this.pointCount)
  }
}
