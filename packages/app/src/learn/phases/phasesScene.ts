import type { Vec3 } from '../../math/tuples'
import { sunPose } from '../../scene/exploreLayout'
import type { MoonPose, PlanetPose, SceneLayout } from '../../scene/sceneLayout'
import { PLANETS } from '../../solarSystem/bodies'
import { moonRotationAngleRadians } from '../../solarSystem/moonOrbit'
import { MOONS } from '../../solarSystem/moons'
import { axisAlignmentRotation } from '../../solarSystem/poleOrientation'
import type { Ephemeris } from '../../time/ephemeris'
import { EARTH_RADIUS, MOON_ORBIT_TILT_DEGREES, MOON_RADIUS, moonOrbitTilt, newMoonOrbitAngleDegrees } from '../eclipse/eclipseGeometry'
import type { GroundShot } from '../ground/groundShot'
import type { PhasesChapterKind, PhasesStage } from '../lessonTypes'
import { StageTween } from '../stageTween'
import { earthshineStrength, FLAT_ORBIT, moonGroundShot, phaseAngle, PHASES_EARTH_POSITION, phasesMoonPosition, PHASES_NODE_DEGREES } from './phasesGeometry'

const EARTH = PLANETS.find((planet) => planet.id === 'earth')!
const MOON = MOONS.find((moon) => moon.id === 'moon')!

// Earth's axis, 23.4 degrees from the north of its orbit, as in the eclipse lesson.
const EARTH_POLE: Vec3 = [-0.344, -0.198, 0.918]
const EARTH_TILT = axisAlignmentRotation(EARTH_POLE)
const EARTH_SPIN_RADIANS_PER_SECOND = (2 * Math.PI) / 40

// A circling Moon goes around Earth in 24 seconds: a month in less than half a minute.
const CIRCLING_DEGREES_PER_SECOND = 360 / 24
const STAGE_TWEEN_SECONDS = 2.5
const TWEENED = ['moonAgeDegrees', 'moonAltitudeDegrees', 'sunAltitudeDegrees'] as const

// The Moon phases lesson's scenes: the Moon around Earth seen from space (from above, or from the
// side to show Earth's shadow), and the Moon in the sky seen from Earth.
export class PhasesScene {
  private readonly tween = new StageTween(TWEENED, STAGE_TWEEN_SECONDS)
  private flags = { circling: false, showNearSide: false }
  private earthSpin = 0

  get ageDegrees(): number {
    return this.tween.current.moonAgeDegrees
  }

  get sunAltitudeDegrees(): number {
    return this.tween.current.sunAltitudeDegrees
  }

  get showsNearSide(): boolean {
    return this.flags.showNearSide
  }

  start(stage: PhasesStage): void {
    this.tween.moveTo(stage, true)
    this.flags = { circling: stage.circling, showNearSide: stage.showNearSide }
    this.earthSpin = 0
  }

  // Within a shot the Moon eases the short way round to its new place; a new shot starts there.
  showStage(stage: PhasesStage, kindChanged: boolean): void {
    const age = this.ageDegrees
    const shortWay = (((stage.moonAgeDegrees - age) % 360) + 540) % 360 - 180
    this.tween.moveTo({ ...stage, moonAgeDegrees: kindChanged ? stage.moonAgeDegrees : age + shortWay }, kindChanged)
    this.flags = { circling: stage.circling, showNearSide: stage.showNearSide }
  }

  update(deltaSeconds: number): void {
    this.tween.update(deltaSeconds)
    if (this.flags.circling) this.tween.advance('moonAgeDegrees', deltaSeconds * CIRCLING_DEGREES_PER_SECOND)
    this.earthSpin += deltaSeconds * EARTH_SPIN_RADIANS_PER_SECOND
  }

  layout(kind: PhasesChapterKind, ephemeris: Ephemeris): SceneLayout {
    const sun = sunPose(ephemeris, 1)
    const earth = this.earth()
    const moon = this.moon(kind, earth)
    if (kind === 'phasesSky') return { sun, planets: [], moons: [moon] }
    return { sun, planets: [earth], moons: [moon], alwaysShowBodyLabels: true }
  }

  groundShot(): GroundShot {
    const { moonAltitudeDegrees: moon, sunAltitudeDegrees: sun } = this.tween.current
    return moonGroundShot(phasesMoonPosition(this.ageDegrees), { moon, sun })
  }

  private earth(): PlanetPose {
    return { definition: EARTH, position: PHASES_EARTH_POSITION, radius: EARTH_RADIUS, poleDirection: EARTH_POLE, tilt: EARTH_TILT, spinRadians: this.earthSpin }
  }

  // Only the side view shows Earth's shadow, and the Moon on its tilted orbit passing it by. In
  // every other shot the orbit lies flat and the Moon is spared Earth's shadow - it would otherwise
  // be eclipsed at every full moon, which the real, tilted orbit avoids - and its parent is passed
  // without a radius, so Earth casts no shadow on it, but still lights its night side.
  private moon(kind: PhasesChapterKind, earth: PlanetPose): MoonPose {
    const tiltDegrees = kind === 'phasesShadow' ? MOON_ORBIT_TILT_DEGREES : FLAT_ORBIT
    const position = phasesMoonPosition(this.ageDegrees, tiltDegrees)
    const orbitAngle = ((newMoonOrbitAngleDegrees(PHASES_NODE_DEGREES) + this.ageDegrees) * Math.PI) / 180
    return {
      definition: MOON,
      parent: kind === 'phasesShadow' ? earth : { ...earth, radius: 0 },
      position,
      radius: MOON_RADIUS,
      tilt: moonOrbitTilt(PHASES_NODE_DEGREES, tiltDegrees),
      spinRadians: moonRotationAngleRadians(orbitAngle),
      earthshine: earthshineStrength(phaseAngle(position)),
    }
  }
}
