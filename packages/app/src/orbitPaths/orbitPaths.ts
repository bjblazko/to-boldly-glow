import type { Viewpoint } from '../camera/viewpoint'
import { LineStrip } from '../lines/lineStrip'
import type { Rgba } from '../math/tuples'
import { PLANETS } from '../solarSystem/bodies'
import type { AuPosition } from '../solarSystem/sceneScale'
import { sampleOrbit as sampleKeplerOrbit } from '../smallBodies/keplerOrbit'
import { COMETS, MINOR_PLANETS } from '../smallBodies/smallBodyCatalog'
import { sampleOrbit, scaleOrbitSamples } from './orbitPath'

const ORBIT_PATH_ALPHA = 0.5
// The line pipeline draws opaque lines (alpha only scales the lessons' glow), so the small bodies'
// orbits are dimmed in their color instead: present, but well behind the planets'.
const COMET_ORBIT_COLOR: Rgba = [0.025, 0.05, 0.065, 1]
const MINOR_PLANET_DIMMING = 0.08
// A comet's orbit bends sharply at perihelion: more points than a planet's near-circle.
const COMET_ORBIT_SEGMENTS = 400
const MINOR_PLANET_ORBIT_SEGMENTS = 128

function dimmed([r, g, b]: [number, number, number]): [number, number, number] {
  return [r * MINOR_PLANET_DIMMING, g * MINOR_PLANET_DIMMING, b * MINOR_PLANET_DIMMING]
}

type OrbitGroup = 'planet' | 'comet' | 'minorPlanet'

interface OrbitPath {
  group: OrbitGroup
  color: Rgba
  samples: AuPosition[]
  line: LineStrip
}

// Which orbits to show: the planets' and, separately, the comets' and dwarf planets'.
export interface ShownOrbits {
  planets: boolean
  comets: boolean
  minorPlanets: boolean
}

const GROUP_SWITCH: Record<OrbitGroup, keyof ShownOrbits> = { planet: 'planets', comet: 'comets', minorPlanet: 'minorPlanets' }

// Each planet's full orbit, drawn in its own color - and the comets' and dwarf planets' - rescaled
// with the Realistic/Compact blend.
export class OrbitPaths {
  private constructor(private readonly paths: OrbitPath[]) {}

  static create(device: GPUDevice, linePipeline: GPURenderPipeline, scaleBlend: number): OrbitPaths {
    const path = (id: string, group: OrbitGroup, color: Rgba, samples: AuPosition[]): OrbitPath => ({
      group,
      color,
      samples,
      line: LineStrip.create(device, linePipeline, `${id} orbit path`, scaleOrbitSamples(samples, scaleBlend)),
    })
    return new OrbitPaths([
      ...PLANETS.map((planet) => path(planet.id, 'planet', [...planet.color, ORBIT_PATH_ALPHA], sampleOrbit(planet))),
      ...COMETS.map((comet) => path(comet.id, 'comet', COMET_ORBIT_COLOR, sampleKeplerOrbit(comet.orbit, COMET_ORBIT_SEGMENTS))),
      ...MINOR_PLANETS.map((body) => path(body.id, 'minorPlanet', [...dimmed(body.color), 1], sampleKeplerOrbit(body.orbit, MINOR_PLANET_ORBIT_SEGMENTS))),
    ])
  }

  rescale(scaleBlend: number): void {
    for (const path of this.paths) path.line.setPoints(scaleOrbitSamples(path.samples, scaleBlend))
  }

  update(viewpoint: Viewpoint): void {
    for (const { color, line } of this.paths) line.setStyle(viewpoint.viewProjection, color)
  }

  // Expects the line pipeline to be set on the pass.
  draw(pass: GPURenderPassEncoder, show: ShownOrbits): void {
    for (const { group, line } of this.paths) if (show[GROUP_SWITCH[group]]) line.draw(pass)
  }
}
