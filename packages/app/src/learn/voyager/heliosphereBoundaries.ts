import type { Viewpoint } from '../../camera/viewpoint'
import { LineStrip } from '../../lines/lineStrip'
import type { Rgba, Vec3 } from '../../math/tuples'
import { scaleOrbitSamples } from '../../orbitPaths/orbitPath'
import { scaledPosition, type AuPosition } from '../../solarSystem/sceneScale'
import type { Trajectory } from '../../spacecraft/trajectory'
import type { VoyagerProbeId } from './voyagerStage'

const COMPACT = 1
const RING_SEGMENTS = 180

// The two edges of the Sun's bubble, each sketched as a sphere: a circle around the plane of the
// planets at a typical distance, and a circle through the poles at each point where a Voyager
// crossed it, at that crossing's distance (the bubble is not round: the Voyagers met it at
// different distances). Dates and distances: NASA/JPL.
const BOUNDARIES = {
  terminationShock: {
    color: [0.85, 0.55, 0.3, 1] as Rgba,
    typicalAu: 90,
    crossings: { voyager1: '2004-12-16', voyager2: '2007-08-30' } as Record<VoyagerProbeId, string>,
  },
  heliopause: {
    color: [0.55, 0.45, 0.9, 1] as Rgba,
    typicalAu: 120,
    crossings: { voyager1: '2012-08-25', voyager2: '2018-11-05' } as Record<VoyagerProbeId, string>,
  },
}

export type Boundary = keyof typeof BOUNDARIES

interface Sketch {
  color: Rgba
  rings: LineStrip[]
  // Where it is labelled: where Voyager 1 crossed it.
  labelPoint: Vec3
}

const MS_PER_DAY = 86400000
const J2000_MS = Date.UTC(2000, 0, 1, 12)

function dayOf(iso: string): number {
  return (Date.parse(iso) - J2000_MS) / MS_PER_DAY
}

export class HeliosphereBoundaries {
  private readonly sketches: Record<Boundary, Sketch>

  constructor(gpu: { device: GPUDevice; linePipeline: GPURenderPipeline }, trajectories: Record<VoyagerProbeId, Trajectory>) {
    const sketch = (id: Boundary): Sketch => {
      const { color, typicalAu, crossings } = BOUNDARIES[id]
      const points = (['voyager1', 'voyager2'] as const).map((probe) => trajectories[probe].positionAt(dayOf(crossings[probe])))
      const rings = [ring(null, typicalAu), ...points.map((point) => ring(point, point.distanceAu))]
      return { color, rings: rings.map((points) => LineStrip.create(gpu.device, gpu.linePipeline, id, points)), labelPoint: scaledPosition(points[0], COMPACT) }
    }
    this.sketches = { terminationShock: sketch('terminationShock'), heliopause: sketch('heliopause') }
  }

  labelPoint(boundary: Boundary): Vec3 {
    return this.sketches[boundary].labelPoint
  }

  updateLines(viewpoint: Viewpoint): void {
    for (const { color, rings } of Object.values(this.sketches)) for (const ring of rings) ring.setStyle(viewpoint.viewProjection, color)
  }

  // Expects the line pipeline to be set on the pass.
  draw(pass: GPURenderPassEncoder): void {
    for (const { rings } of Object.values(this.sketches)) for (const ring of rings) ring.draw(pass)
  }
}

// A circle at that distance: in the plane of Earth's orbit, or (given a point) through the
// ecliptic poles and that point.
function ring(through: AuPosition | null, distanceAu: number): Float32Array {
  const azimuth = through ? Math.atan2(through.y, through.x) : 0
  const samples = Array.from({ length: RING_SEGMENTS + 1 }, (_, step) => {
    const angle = (step / RING_SEGMENTS) * 2 * Math.PI
    const [across, up] = [Math.cos(angle) * distanceAu, Math.sin(angle) * distanceAu]
    if (!through) return { x: across, y: up, z: 0, distanceAu }
    return { x: across * Math.cos(azimuth), y: across * Math.sin(azimuth), z: up, distanceAu }
  })
  return scaleOrbitSamples(samples, COMPACT)
}
