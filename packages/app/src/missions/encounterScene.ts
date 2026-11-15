import { mat4, vec3 } from 'gl-matrix'
import type { Viewpoint } from '../camera/viewpoint'
import { LineStrip } from '../lines/lineStrip'
import type { Rgba, Vec3 } from '../math/tuples'
import { realOrientation, sunPose } from '../scene/exploreLayout'
import type { MoonPose, PlanetPose, SceneLayout } from '../scene/sceneLayout'
import type { ModelRenderer } from '../spacecraft/modelRenderer'
import { PLANETS } from '../solarSystem/bodies'
import { planetAuPosition } from '../solarSystem/entities'
import { MOONS } from '../solarSystem/moons'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'
import type { Ephemeris } from '../time/ephemeris'
import type { EncounterPath } from './encounterPath'
import { dishTowardSun } from '../spacecraft/dishTowardSun'

// A flyby at true scale, around the planet's centre: 1 scene unit is 1,000 km, so the planet, its
// moon and the probe's path keep their real sizes and distances - only the probe is enlarged.
const KM_PER_UNIT = 1000
// The Sun, off in its real direction - far enough to light everything from the same side.
const SUN_DISTANCE_UNITS = 4000
// The probe is drawn on its path, enlarged: a 4 m craft would be invisible at this scale. Units per
// metre: the 13 m magnetometer boom spans about 1,500 km.
const PROBE_UNITS_PER_METRE = 0.12
// The camera rides behind the probe, a little above and to its side (scene units = 1,000 km), and
// looks at a point between the probe and the planet, so both are in the picture.
const CHASE = { back: 7, rise: 2, side: 2.5 }
const LOOK_TOWARD_PLANET = 0.35
const PATH_COLOR: Rgba = [0.4, 0.85, 1, 1]
// The stretch still ahead is dimmer than the one flown, but stays easy to follow.
const PATH_DIMMING = 0.5
// The path's label sits this far ahead of the probe, in the camera's view.
const PATH_LABEL_AHEAD_SECONDS = 4 * 3600

export interface Flyby {
  planetId: string
  moonId: string
  path: EncounterPath
}

export interface EncounterCamera {
  eye: Vec3
  look: Vec3
  up: Vec3
}

function normalized(vector: ArrayLike<number>): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

// The planet, its moon, the probe on its path and the camera riding just behind it.
export class EncounterScene {
  private flyby: Flyby | null = null
  private seconds = 0
  private toSun: Vec3 = [1, 0, 0]
  private readonly whole: LineStrip
  private readonly travelled: LineStrip

  constructor(
    gpu: { device: GPUDevice; linePipeline: GPURenderPipeline },
    private readonly probe: ModelRenderer,
    pathCapacity: number,
  ) {
    this.whole = LineStrip.withCapacity(gpu.device, gpu.linePipeline, 'flyby path', pathCapacity)
    this.travelled = LineStrip.withCapacity(gpu.device, gpu.linePipeline, 'flyby travelled', pathCapacity + 1)
  }

  // A new flyby: its path, and the Sun's direction from the planet on that day.
  show(flyby: Flyby, ephemeris: Ephemeris): void {
    this.flyby = flyby
    const planet = PLANETS.find((body) => body.id === flyby.planetId)!
    const au = planetAuPosition(planet, ephemeris.julianMillennia)
    this.toSun = normalized([-au.x, -au.y, -au.z])
    this.whole.setPoints(flyby.path.probePath().map((km) => km / KM_PER_UNIT))
  }

  // Seconds from closest approach.
  setMoment(seconds: number): void {
    this.seconds = seconds
  }

  get probePosition(): Vec3 {
    return this.flyby ? (this.flyby.path.probeAt(this.seconds).map((km) => km / KM_PER_UNIT) as Vec3) : [0, 0, 0]
  }

  // A point on the path a few hours ahead, where it is labelled.
  get pathLabelPoint(): Vec3 {
    return this.flyby ? (this.flyby.path.probeAt(this.seconds + PATH_LABEL_AHEAD_SECONDS).map((km) => km / KM_PER_UNIT) as Vec3) : [0, 0, 0]
  }

  // Where the scene's camera stands (behind the probe) and which way it looks.
  camera(): EncounterCamera {
    const probe = this.probePosition
    const flight = this.flyby ? this.flyby.path.directionAt(this.seconds) : normalized(probe.map((value) => -value))
    const reference: Vec3 = Math.abs(vec3.dot(flight, ECLIPTIC_NORTH)) > 0.95 ? [1, 0, 0] : [...ECLIPTIC_NORTH]
    const right = normalized(vec3.cross(vec3.create(), flight, reference))
    const up = normalized(vec3.cross(vec3.create(), right, flight))
    const eye = probe.map((value, axis) => value - flight[axis] * CHASE.back + up[axis] * CHASE.rise + right[axis] * CHASE.side) as Vec3
    const aim = probe.map((value) => value * (1 - LOOK_TOWARD_PLANET))
    const look = normalized(aim.map((value, axis) => value - eye[axis]))
    return { eye, look, up: Math.abs(vec3.dot(look, up)) > 0.95 ? reference : up }
  }

  layout(ephemeris: Ephemeris): SceneLayout {
    const sun = sunPose(ephemeris, 1)
    const planet = this.planetPose(ephemeris)
    const moons = planet ? this.moonPoses(planet) : []
    return { sun: { ...sun, position: this.toSun.map((value) => value * SUN_DISTANCE_UNITS) as Vec3, radius: 1 }, planets: planet ? [planet] : [], moons, alwaysShowBodyLabels: true }
  }

  updateLines(viewpoint: Viewpoint): void {
    if (!this.flyby) return
    this.travelled.setPoints(this.travelledPoints())
    this.travelled.setStyle(viewpoint.viewProjection, PATH_COLOR)
    this.whole.setStyle(viewpoint.viewProjection, [PATH_COLOR[0] * PATH_DIMMING, PATH_COLOR[1] * PATH_DIMMING, PATH_COLOR[2] * PATH_DIMMING, 1])
  }

  // The probe on its path, enlarged, its dish pointing home - toward the Sun, as Earth is close to it
  // as seen from out here.
  prepareProbe(viewpoint: Viewpoint): void {
    const world = mat4.fromTranslation(mat4.create(), this.probePosition)
    mat4.multiply(world, world, dishTowardSun(this.toSun))
    mat4.scale(world, world, [PROBE_UNITS_PER_METRE, PROBE_UNITS_PER_METRE, PROBE_UNITS_PER_METRE])
    this.probe.update(viewpoint, { world, toSun: this.toSun, explode: 0, highlight: { assembly: -1, strength: 0 } }, [])
  }

  drawProbe(pass: GPURenderPassEncoder): void {
    if (this.flyby) this.probe.draw(pass)
  }

  // Expects the line pipeline to be set on the pass.
  drawLines(pass: GPURenderPassEncoder): void {
    if (!this.flyby) return
    this.whole.draw(pass)
    this.travelled.draw(pass)
  }

  // The path from its start up to where the probe is now.
  private travelledPoints(): Float32Array {
    const path = this.flyby!.path
    const samples = path.samplesBefore(this.seconds)
    const points = path.probePath().subarray(0, samples * 3).map((km) => km / KM_PER_UNIT)
    return Float32Array.from([...points, ...this.probePosition])
  }

  private planetPose(ephemeris: Ephemeris): PlanetPose | null {
    const definition = PLANETS.find((planet) => planet.id === this.flyby?.planetId)
    if (!definition) return null
    return { definition, position: [0, 0, 0], radius: definition.radiusKm / KM_PER_UNIT, ...realOrientation(definition, ephemeris) }
  }

  private moonPoses(parent: PlanetPose): MoonPose[] {
    const definition = MOONS.find((moon) => moon.id === this.flyby?.moonId)
    if (!definition || !this.flyby) return []
    const position = this.flyby.path.moonAt(this.seconds).map((km) => km / KM_PER_UNIT) as Vec3
    // Tidally locked: its near side faces the planet.
    const spinRadians = Math.atan2(-position[1], -position[0])
    return [{ definition, parent, position, radius: definition.radiusKm / KM_PER_UNIT, tilt: mat4.create(), spinRadians }]
  }
}
