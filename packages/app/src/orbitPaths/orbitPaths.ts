import type { Viewpoint } from '../camera/viewpoint'
import { LineStrip } from '../lines/lineStrip'
import { PLANETS, type BodyDefinition } from '../solarSystem/bodies'
import type { AuPosition } from '../solarSystem/sceneScale'
import { sampleOrbit, scaleOrbitSamples } from './orbitPath'

const ORBIT_PATH_ALPHA = 0.5

interface OrbitPath {
  planet: BodyDefinition
  samples: AuPosition[]
  line: LineStrip
}

// Each planet's full orbit, drawn in its own color and rescaled with the Realistic/Compact blend.
export class OrbitPaths {
  private constructor(private readonly paths: OrbitPath[]) {}

  static create(device: GPUDevice, linePipeline: GPURenderPipeline, scaleBlend: number): OrbitPaths {
    return new OrbitPaths(
      PLANETS.map((planet) => {
        const samples = sampleOrbit(planet)
        return { planet, samples, line: LineStrip.create(device, linePipeline, `${planet.id} orbit path`, scaleOrbitSamples(samples, scaleBlend)) }
      }),
    )
  }

  rescale(scaleBlend: number): void {
    for (const path of this.paths) path.line.setPoints(scaleOrbitSamples(path.samples, scaleBlend))
  }

  update(viewpoint: Viewpoint): void {
    for (const { planet, line } of this.paths) line.setStyle(viewpoint.viewProjection, [...planet.color, ORBIT_PATH_ALPHA])
  }

  // Expects the line pipeline to be set on the pass.
  draw(pass: GPURenderPassEncoder): void {
    for (const { line } of this.paths) line.draw(pass)
  }
}
