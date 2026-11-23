import type { Vec3 } from '../../math/tuples'
import { realOrientation } from '../../scene/exploreLayout'
import type { MoonPose, PlanetPose, SceneLayout } from '../../scene/sceneLayout'
import { AU_KM, PLANETS, SUN } from '../../solarSystem/bodies'
import { planetAuPosition } from '../../solarSystem/entities'
import { MOONS } from '../../solarSystem/moons'
import { ephemerisAt, type Ephemeris } from '../../time/ephemeris'
import { APOLLO11_RANGE_ZERO_UTC } from './apollo11Events'
import type { Apollo11Trajectory } from './apollo11Trajectory'
import { moonTilt } from './moonOrientation'

// Apollo 11's world at true scale: Earth, the Moon and the Sun where they were at a mission time,
// 1 scene unit = 1,000 km. Everything is placed around a floating origin - the craft in view - so
// float32 keeps the near things sharp; the craft themselves are drawn in their own metre pass.

export const KM_PER_UNIT = 1000
// The Sun stands off in its real direction, at its real apparent size.
const SUN_DISTANCE_UNITS = 4000
const EARTH = PLANETS.find((planet) => planet.id === 'earth')!
const MOON = MOONS.find((moon) => moon.id === 'moon')!

export type Craft = 'columbia' | 'eagle'

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const unit = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

export class Apollo11Scene {
  private get_ = 0
  private originKm: Vec3 = [0, 0, 0]
  private ephemeris: Ephemeris = ephemerisAt(new Date(APOLLO11_RANGE_ZERO_UTC))

  constructor(private readonly trajectory: Apollo11Trajectory) {}

  // The moment shown, and the craft the scene is centred on.
  setMoment(get: number, focus: Craft): void {
    this.get_ = get
    this.ephemeris = ephemerisAt(new Date(APOLLO11_RANGE_ZERO_UTC + get * 1000))
    this.originKm = this.craftGeocentric(focus) ?? this.originKm
  }

  get get(): number {
    return this.get_
  }

  // The floating origin, km from Earth's centre (ecliptic J2000).
  get origin(): Vec3 {
    return this.originKm
  }

  // A craft's place relative to the origin (km).
  craftKm(craft: Craft): Vec3 | null {
    const here = this.craftGeocentric(craft)
    return here ? minus(here, this.originKm) : null
  }

  moonKm(): Vec3 {
    return minus(this.trajectory.moon(this.get_) ?? [0, 0, 0], this.originKm)
  }

  earthKm(): Vec3 {
    return minus([0, 0, 0], this.originKm)
  }

  // Toward the Sun, from Earth (the same from the Moon to well under a degree).
  get toSun(): Vec3 {
    const earth = planetAuPosition(EARTH, this.ephemeris.julianMillennia)
    return unit([-earth.x, -earth.y, -earth.z])
  }

  layout(): SceneLayout {
    const earth: PlanetPose = { definition: EARTH, position: this.units(this.earthKm()), radius: EARTH.radiusKm / KM_PER_UNIT, ...realOrientation(EARTH, this.ephemeris) }
    const moon: MoonPose = { definition: MOON, parent: earth, position: this.units(this.moonKm()), radius: MOON.radiusKm / KM_PER_UNIT, tilt: moonTilt(this.julianDay()), spinRadians: 0 }
    const sunUnits = this.toSun.map((value) => value * SUN_DISTANCE_UNITS) as Vec3
    const sun = { position: sunUnits, radius: (SUN.radiusKm / AU_KM) * SUN_DISTANCE_UNITS, ...realOrientation(SUN, this.ephemeris) }
    return { sun, planets: [earth], moons: [moon] }
  }

  private units(km: Vec3): Vec3 {
    return [km[0] / KM_PER_UNIT, km[1] / KM_PER_UNIT, km[2] / KM_PER_UNIT]
  }

  private julianDay(): number {
    return 2451545.0 + this.ephemeris.daysSinceEpoch
  }

  private craftGeocentric(craft: Craft): Vec3 | null {
    return craft === 'columbia' ? this.trajectory.columbia(this.get_) : (this.trajectory.eagle(this.get_)?.position ?? null)
  }
}
