import { mat4 } from 'gl-matrix'
import type { Vec3 } from '../../math/tuples'
import { realOrientation } from '../../scene/exploreLayout'
import type { MoonPose, PlanetPose, SceneLayout } from '../../scene/sceneLayout'
import { AU_KM, PLANETS, SUN } from '../../solarSystem/bodies'
import { planetAuPosition } from '../../solarSystem/entities'
import { MOONS } from '../../solarSystem/moons'
import { ephemerisAt, type Ephemeris } from '../../time/ephemeris'
import { APOLLO11_RANGE_ZERO_UTC } from './apollo11Events'
import type { Apollo11Trajectory } from './apollo11Trajectory'
import { fromMoonFrame, moonAxes, moonAxes64, moonTilt, toMoonFrame } from './moonOrientation'

// Apollo 11's world at true scale: Earth, the Moon and the Sun where they were at a mission time,
// 1 scene unit = 1,000 km. Everything is placed around a floating origin - the craft in view - so
// float32 keeps the near things sharp; the craft themselves are drawn in their own metre pass.

export const KM_PER_UNIT = 1000
// The Sun stands off in its real direction, at its real apparent size.
const SUN_DISTANCE_UNITS = 4000
const EARTH = PLANETS.find((planet) => planet.id === 'earth')!
const MOON = MOONS.find((moon) => moon.id === 'moon')!

export type Craft = 'columbia' | 'eagle'

export interface Motion {
  velocity: Vec3
  up: Vec3
  altitudeKm: number
  body: 'earth' | 'moon'
}

// The Moon's sphere of influence (about 66,000 km): inside it the Moon is the body flown round.
const MOON_INFLUENCE_KM = 60_000
// The Moon's sphere drawn a few kilometres small: under the maria, so the region of true heights
// drawn over it (moonRegion.ts) and Tranquility Base's ground (2 km under the mean radius) never
// fight with it; 0.25% of its size, nothing from afar.
const DRAWN_MOON_RADIUS_KM = 1733
const LANDING_SITE_RADIUS_KM = 1735.47
const LANDED = 102 * 3600 + 45 * 60 + 40
const LIFTOFF = 124 * 3600 + 22 * 60 + 0.79

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const unit = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

export class Apollo11Scene {
  private get_ = 0
  private originKm: Vec3 = [0, 0, 0]
  private siteFixed: Vec3 | null = null
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

  // A craft's motion relative to the body it flies round (the Moon within its sphere of influence,
  // Earth outside): km/s, straight up from that body, and its height over it.
  motion(craft: Craft): Motion | null {
    return this.motionAt(craft, this.get_)
  }

  // The same at another mission time (a burn's end, to hold its attitude after it).
  motionAt(craft: Craft, get: number): Motion | null {
    const times = [get - 0.5, get, get + 0.5]
    const places = times.map((get) => this.at(craft, get))
    const moons = times.map((get) => this.trajectory.moon(get))
    if (places.some((p) => !p) || moons.some((m) => !m)) return null
    const [before, here, after] = places as Vec3[]
    const moon = moons as Vec3[]
    const nearMoon = Math.hypot(...minus(here, moon[1])) < MOON_INFLUENCE_KM
    const centre = (i: number): Vec3 => (nearMoon ? moon[i] : [0, 0, 0])
    const velocity = minus(minus(after, centre(2)), minus(before, centre(0)))
    const fromCentre = minus(here, centre(1))
    // The Moon's heights from the landing site's radius, as Apollo's documents give them.
    const radius = nearMoon ? LANDING_SITE_RADIUS_KM : EARTH.radiusKm
    return { velocity, up: unit(fromCentre), altitudeKm: Math.hypot(...fromCentre) - radius, body: nearMoon ? 'moon' : 'earth' }
  }

  // Where Eagle stood on the Moon (km, from the origin): the spot under it just before liftoff,
  // carried round with the Moon. Null before the landing.
  siteKm(): Vec3 | null {
    if (this.get_ < LANDED) return null
    this.siteFixed ??= this.moonFixed()
    if (!this.siteFixed) return null
    const turned = fromMoonFrame(moonAxes64(this.julianDay()), this.siteFixed)
    const moon = this.moonKm()
    return [moon[0] + turned[0], moon[1] + turned[1], moon[2] + turned[2]]
  }

  // Where Eagle stands, in the Moon's own frame (km; also before the landing), and the Moon's own
  // axes in the scene now.
  siteMoonFrameKm(): Vec3 | null {
    this.siteFixed ??= this.moonFixed()
    return this.siteFixed
  }

  moonAxesNow(): mat4 {
    return moonAxes(this.julianDay())
  }

  // The site relative to the origin (km), at any time - where Eagle will land, stands, stood.
  siteNowKm(): Vec3 | null {
    const site = this.siteMoonFrameKm()
    if (!site) return null
    const turned = fromMoonFrame(moonAxes64(this.julianDay()), site)
    const moon = this.moonKm()
    return [moon[0] + turned[0], moon[1] + turned[1], moon[2] + turned[2]]
  }

  // Straight up from the Moon at a point (km, from the origin).
  moonUpAt(km: Vec3): Vec3 {
    return unit(minus(km, this.moonKm()))
  }

  layout(): SceneLayout {
    const earth: PlanetPose = { definition: EARTH, position: this.units(this.earthKm()), radius: EARTH.radiusKm / KM_PER_UNIT, ...realOrientation(EARTH, this.ephemeris) }
    const moon: MoonPose = { definition: MOON, parent: earth, position: this.units(this.moonKm()), radius: DRAWN_MOON_RADIUS_KM / KM_PER_UNIT, tilt: moonTilt(this.julianDay()), spinRadians: 0 }
    const sunUnits = this.toSun.map((value) => value * SUN_DISTANCE_UNITS) as Vec3
    const sun = { position: sunUnits, radius: (SUN.radiusKm / AU_KM) * SUN_DISTANCE_UNITS, ...realOrientation(SUN, this.ephemeris) }
    return { sun, planets: [earth], moons: [moon] }
  }

  private units(km: Vec3): Vec3 {
    return [km[0] / KM_PER_UNIT, km[1] / KM_PER_UNIT, km[2] / KM_PER_UNIT]
  }

  // Eagle's place on the ground in the Moon's own frame (km), from just before its liftoff.
  private moonFixed(): Vec3 | null {
    const [eagle, moon] = [this.trajectory.eagle(LIFTOFF - 1)?.position, this.trajectory.moon(LIFTOFF - 1)]
    if (!eagle || !moon) return null
    const julian = 2451545.0 + ephemerisAt(new Date(APOLLO11_RANGE_ZERO_UTC + (LIFTOFF - 1) * 1000)).daysSinceEpoch
    return toMoonFrame(moonAxes64(julian), minus(eagle, moon))
  }

  julianDay(): number {
    return 2451545.0 + this.ephemeris.daysSinceEpoch
  }

  private craftGeocentric(craft: Craft): Vec3 | null {
    return this.at(craft, this.get_)
  }

  private at(craft: Craft, get: number): Vec3 | null {
    return craft === 'columbia' ? this.trajectory.columbia(get) : (this.trajectory.eagle(get)?.position ?? null)
  }
}
