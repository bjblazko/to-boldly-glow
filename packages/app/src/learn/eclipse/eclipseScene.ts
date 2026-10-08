import { mat4 } from 'gl-matrix'
import { EasedTween } from '../../math/easedTween'
import type { Vec3 } from '../../math/tuples'
import { sunPose } from '../../scene/exploreLayout'
import type { MoonPose, PlanetPose, SceneLayout } from '../../scene/sceneLayout'
import { PLANETS } from '../../solarSystem/bodies'
import { moonRotationAngleRadians } from '../../solarSystem/moonOrbit'
import { MOONS } from '../../solarSystem/moons'
import { axisAlignmentRotation } from '../../solarSystem/poleOrientation'
import type { Ephemeris } from '../../time/ephemeris'
import type { EclipseChapterKind, EclipseStage } from '../lessonTypes'
import { EARTH_POSITION, EARTH_RADIUS, MOON_RADIUS, moonOrbitTilt, newMoonOrbitAngleDegrees, stagedMoonPosition } from './eclipseGeometry'
import { OBSERVER, skyMoon, ZENITH } from './skyGeometry'

const EARTH = PLANETS.find((planet) => planet.id === 'earth')!
const MOON = MOONS.find((moon) => moon.id === 'moon')!

// Earth's axis: 23.4 degrees from ecliptic north, its north end leaning toward the Sun - northern
// summer, as on 2 August 2027.
const EARTH_POLE: Vec3 = [-0.344, -0.198, 0.918]
const EARTH_TILT = axisAlignmentRotation(EARTH_POLE)
const EARTH_SPIN_RADIANS_PER_SECOND = (2 * Math.PI) / 40

// In the shadow chapter the Moon glides through new moon, from this far before it to this far
// after, and starts over: far enough that its shadow has fully left Earth when it jumps back. The
// chapter opens with the shadow just reaching Earth.
export const SHADOW_SWEEP_DEGREES = 22
const SHADOW_SWEEP_SECONDS = 18
const SHADOW_SWEEP_START_SECONDS = 3

const STAGE_TWEEN_SECONDS = 2.5
const STAGE_KEYS = ['nodeDegrees', 'skySeparation', 'moonSizeRatio', 'glasses'] as const

// Every number of an eclipse stage, eased from one chapter's stage to the next.
class StageTween {
  private readonly tweens = Object.fromEntries(STAGE_KEYS.map((key) => [key, new EasedTween(0, STAGE_TWEEN_SECONDS)])) as Record<
    (typeof STAGE_KEYS)[number],
    EasedTween
  >
  private readonly current: EclipseStage = { nodeDegrees: 0, skySeparation: 0, moonSizeRatio: 1, glasses: 0 }

  get stage(): EclipseStage {
    return this.current
  }

  moveTo(target: EclipseStage, snap: boolean): void {
    for (const key of STAGE_KEYS) {
      this.tweens[key].retarget(target[key], snap ? target[key] : this.current[key])
      if (snap) this.current[key] = target[key]
    }
  }

  update(deltaSeconds: number): void {
    for (const key of STAGE_KEYS) if (this.tweens[key].isAnimating) this.current[key] = this.tweens[key].update(deltaSeconds)
  }
}

// The solar eclipse lesson's scenes: the Sun, Moon and Earth in a row seen from space, and the
// Moon crossing the Sun seen from the ground.
export class EclipseScene {
  private readonly stageTween = new StageTween()
  private sweepSeconds = 0
  private earthSpin = 0

  get stage(): EclipseStage {
    return this.stageTween.stage
  }

  start(stage: EclipseStage): void {
    this.stageTween.moveTo(stage, true)
    this.sweepSeconds = SHADOW_SWEEP_START_SECONDS
    this.earthSpin = 0
  }

  // Within a shot the Moon slides to its new place; a new shot starts from the stage as it is.
  showStage(stage: EclipseStage, kindChanged: boolean): void {
    this.stageTween.moveTo(stage, kindChanged)
    if (kindChanged) this.sweepSeconds = SHADOW_SWEEP_START_SECONDS
  }

  update(deltaSeconds: number, kind: EclipseChapterKind): void {
    this.stageTween.update(deltaSeconds)
    this.earthSpin += deltaSeconds * EARTH_SPIN_RADIANS_PER_SECOND
    if (kind === 'eclipseShadow') this.sweepSeconds = (this.sweepSeconds + deltaSeconds) % SHADOW_SWEEP_SECONDS
  }

  layout(kind: EclipseChapterKind, ephemeris: Ephemeris): SceneLayout {
    const sun = sunPose(ephemeris, 1)
    if (kind === 'eclipseSky') return { sun, planets: [], moons: [this.skyMoonPose()] }
    const earth = this.earth()
    return { sun, planets: [earth], moons: [this.orbitingMoon(earth, kind)], alwaysShowBodyLabels: kind === 'eclipseOrbit' }
  }

  private earth(): PlanetPose {
    return { definition: EARTH, position: EARTH_POSITION, radius: EARTH_RADIUS, poleDirection: EARTH_POLE, tilt: EARTH_TILT, spinRadians: this.earthSpin }
  }

  private orbitingMoon(earth: PlanetPose, kind: EclipseChapterKind): MoonPose {
    const { nodeDegrees } = this.stage
    const pastNewMoon = kind === 'eclipseShadow' ? SHADOW_SWEEP_DEGREES * (2 * (this.sweepSeconds / SHADOW_SWEEP_SECONDS) - 1) : 0
    const orbitAngle = ((newMoonOrbitAngleDegrees(nodeDegrees) + pastNewMoon) * Math.PI) / 180
    return {
      definition: MOON,
      parent: earth,
      position: stagedMoonPosition(nodeDegrees, pastNewMoon),
      radius: MOON_RADIUS,
      tilt: moonOrbitTilt(nodeDegrees),
      spinRadians: moonRotationAngleRadians(orbitAngle),
    }
  }

  // Seen from the ground the Moon's near side - the one it always turns to Earth - faces the
  // observer, dark against the Sun behind it. Earth stays undrawn under the observer's feet.
  private skyMoonPose(): MoonPose {
    const { skySeparation, moonSizeRatio } = this.stage
    const { position, radius } = skyMoon(skySeparation, moonSizeRatio)
    const ground: PlanetPose = { ...this.earth(), position: [OBSERVER[0] - ZENITH[0] * EARTH_RADIUS, OBSERVER[1] - ZENITH[1] * EARTH_RADIUS, OBSERVER[2] - ZENITH[2] * EARTH_RADIUS] }
    const towardMoon = Math.atan2(position[1] - OBSERVER[1], position[0] - OBSERVER[0])
    return { definition: MOON, parent: ground, position, radius, tilt: mat4.create(), spinRadians: moonRotationAngleRadians(towardMoon) }
  }
}
