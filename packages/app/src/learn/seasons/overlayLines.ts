import type { Viewpoint } from '../../camera/viewpoint'
import { LineStrip, type LineMode } from '../../lines/lineStrip'
import type { Rgba } from '../../math/tuples'

// Glowing lines pulse at this rate; static construction lines (references, arcs) stay solid.
const PULSE_SPEED_RADIANS_PER_SECOND = 3

export interface OverlayLineSpec {
  // The most points this line will ever hold (its GPU buffers are sized once, up front).
  capacity: number
  color: Rgba
  mode: LineMode
}

// A named set of overlay lines, redrawn from fresh geometry every frame.
export class OverlayLines<Id extends string> {
  private readonly lines: [Id, LineStrip, OverlayLineSpec][]

  constructor(device: GPUDevice, linePipeline: GPURenderPipeline, specs: Record<Id, OverlayLineSpec>) {
    this.lines = (Object.entries(specs) as [Id, OverlayLineSpec][]).map(([id, spec]) => [
      id,
      LineStrip.withCapacity(device, linePipeline, `${id} overlay`, spec.capacity),
      spec,
    ])
  }

  update(geometry: Record<Id, Float32Array>, viewpoint: Viewpoint, nowSeconds: number): void {
    const pulsePhase = nowSeconds * PULSE_SPEED_RADIANS_PER_SECOND
    for (const [id, line, spec] of this.lines) {
      line.setPoints(geometry[id])
      line.setStyle(viewpoint.viewProjection, spec.color, spec.mode, pulsePhase)
    }
  }

  // Expects the line pipeline to be set on the pass.
  draw(pass: GPURenderPassEncoder): void {
    for (const [, line] of this.lines) line.draw(pass)
  }
}

// Shared overlay colors: the same concept gets the same color in every chapter.
export const OVERLAY_COLORS = {
  axis: [0.98, 0.25, 0.65, 0.95] as Rgba, // neon magenta
  equator: [0.16, 0.88, 0.79, 0.95] as Rgba, // neon teal
  arc: [0.99, 0.78, 0.25, 0.95] as Rgba, // warm amber
  sunDirection: [1.0, 0.85, 0.3, 0.85] as Rgba, // sunlight gold
}
