import { easeInOutCubic, lerp } from '../../math/easing'
import type { Vec3 } from '../../math/tuples'
import { sunPose } from '../../scene/exploreLayout'
import type { MoonPose, PlanetPose, SceneLayout } from '../../scene/sceneLayout'
import { PLANETS } from '../../solarSystem/bodies'
import { moonRotationAngleRadians } from '../../solarSystem/moonOrbit'
import { MOONS } from '../../solarSystem/moons'
import { axisAlignmentRotation } from '../../solarSystem/poleOrientation'
import type { Ephemeris } from '../../time/ephemeris'
import { moonOrbitTilt, newMoonOrbitAngleDegrees } from '../eclipse/eclipseGeometry'
import { earthshineStrength, FLAT_ORBIT, phaseAngle, PHASES_NODE_DEGREES } from '../phases/phasesGeometry'
import { ROUTE_EARTH, ROUTE_EARTH_RADIUS, ROUTE_MOON, ROUTE_MOON_AGE_DEGREES, ROUTE_MOON_RADIUS } from './routeGeometry'
import type { ApolloRouteStage } from './routeStage'

const EARTH = PLANETS.find((planet) => planet.id === 'earth')!
const MOON = MOONS.find((moon) => moon.id === 'moon')!
// Earth's axis, 23.4 degrees from the north of its orbit, as in the Moon phases lesson.
const EARTH_POLE: Vec3 = [-0.344, -0.198, 0.918]
const EARTH_TILT = axisAlignmentRotation(EARTH_POLE)
const EARTH_SPIN_RADIANS_PER_SECOND = (2 * Math.PI) / 60
// How long the craft takes over a chapter's stretch of the route.
const PLAY_SECONDS = 9

// A value eased from one end of a chapter's stretch to the other, then held.
class Travel {
  private from = 0
  private to = 0
  private elapsed = PLAY_SECONDS

  start(from: number, to: number, animate: boolean): void {
    this.from = from
    this.to = to
    this.elapsed = animate ? 0 : PLAY_SECONDS
  }

  update(deltaSeconds: number): void {
    this.elapsed = Math.min(this.elapsed + deltaSeconds, PLAY_SECONDS)
  }

  get value(): number {
    return lerp(this.from, this.to, easeInOutCubic(this.elapsed / PLAY_SECONDS))
  }
}

// The Apollo 11 lesson's stage: Earth and the Moon (see routeGeometry.ts), and how far along the
// route the craft - and Eagle, while it flies on its own - has come in the chapter.
export class ApolloRouteScene {
  private readonly craft = new Travel()
  private readonly eagle = new Travel()
  private current: ApolloRouteStage | null = null
  private earthSpin = 0

  get stage(): ApolloRouteStage | null {
    return this.current
  }

  show(stage: ApolloRouteStage, animate: boolean): void {
    this.current = stage
    this.craft.start(stage.from, stage.to, animate)
    if (stage.eagle) this.eagle.start(stage.eagle.from, stage.eagle.to, animate)
  }

  update(deltaSeconds: number): void {
    this.craft.update(deltaSeconds)
    this.eagle.update(deltaSeconds)
    this.earthSpin += deltaSeconds * EARTH_SPIN_RADIANS_PER_SECOND
  }

  get craftProgress(): number {
    return this.craft.value
  }

  // Null while Eagle is docked to Columbia.
  get eagleProgress(): number | null {
    return this.current?.eagle ? this.eagle.value : null
  }

  layout(ephemeris: Ephemeris): SceneLayout {
    const earth: PlanetPose = { definition: EARTH, position: ROUTE_EARTH, radius: ROUTE_EARTH_RADIUS, poleDirection: EARTH_POLE, tilt: EARTH_TILT, spinRadians: this.earthSpin }
    return { sun: sunPose(ephemeris, 1), planets: [earth], moons: [moonPose(earth)], alwaysShowBodyLabels: true }
  }
}

// The Moon as in the Moon phases lesson, its near side to Earth; Earth casts no shadow on it here
// (its parent is passed without a radius) but lights its night side.
function moonPose(earth: PlanetPose): MoonPose {
  const orbitAngle = ((newMoonOrbitAngleDegrees(PHASES_NODE_DEGREES) + ROUTE_MOON_AGE_DEGREES) * Math.PI) / 180
  return {
    definition: MOON,
    parent: { ...earth, radius: 0 },
    position: ROUTE_MOON,
    radius: ROUTE_MOON_RADIUS,
    tilt: moonOrbitTilt(PHASES_NODE_DEGREES, FLAT_ORBIT),
    spinRadians: moonRotationAngleRadians(orbitAngle),
    earthshine: earthshineStrength(phaseAngle(ROUTE_MOON, ROUTE_EARTH)),
  }
}
