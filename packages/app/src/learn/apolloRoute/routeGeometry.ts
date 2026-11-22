import type { Vec3 } from '../../math/tuples'
import { EARTH_RADIUS, MOON_RADIUS } from '../eclipse/eclipseGeometry'

// The Apollo 11 lesson's staged Earth and Moon and the path drawn between them - schematic, as the
// Moon phases lesson stages them: both globes in their true size ratio, but the Moon 12 Earth radii
// out instead of 60, the orbits drawn far higher than they were, and the Moon held still (in the
// three days out it really moved on about 40 degrees). What the drawing keeps true: the craft goes
// round Earth prograde, leaves it on the side away from the Moon, arrives ahead of the Moon and is
// swung round its far side, where it brakes into a retrograde orbit; it comes home on the other
// side of the Earth-Moon line - the figure eight of the free return - and lands Eagle on the near
// side, 23 degrees east of the point under Earth (Tranquility Base). And the Moon stands as it did:
// about 75 degrees past new moon, a crescent from Earth, with the morning sun low over the site.

export const ROUTE_EARTH_RADIUS = EARTH_RADIUS
export const ROUTE_MOON_RADIUS = MOON_RADIUS
// Far out on the Sun's +X side, as in the Moon phases lesson, so sunlight falls in from one side.
export const ROUTE_EARTH: Vec3 = [400, 0, 0]
export const MOON_DISTANCE = 12 * EARTH_RADIUS
const MOON_AGE_DEGREES = 75
export const PARKING_RADIUS = 1.3 * EARTH_RADIUS
export const LUNAR_ORBIT_RADIUS = 1.65 * MOON_RADIUS

// The plane's own axes: toward the Moon, and across, 90 degrees counterclockwise (the way the
// Moon moves). New moon lies toward the Sun (-X); the Moon's age turns counterclockwise from it.
const AGE = (MOON_AGE_DEGREES * Math.PI) / 180
const TOWARD_MOON = [-Math.cos(AGE), -Math.sin(AGE)]
const ACROSS = [-TOWARD_MOON[1], TOWARD_MOON[0]]
export const ROUTE_MOON: Vec3 = at([MOON_DISTANCE, 0])

type P2 = [number, number]

function at([a, b]: P2): Vec3 {
  return [ROUTE_EARTH[0] + a * TOWARD_MOON[0] + b * ACROSS[0], ROUTE_EARTH[1] + a * TOWARD_MOON[1] + b * ACROSS[1], 0]
}

function polar(centre: P2, radius: number, degrees: number): P2 {
  const r = (degrees * Math.PI) / 180
  return [centre[0] + radius * Math.cos(r), centre[1] + radius * Math.sin(r)]
}

const EARTH: P2 = [0, 0]
const MOON: P2 = [MOON_DISTANCE, 0]
const LIFTOFF_DEGREES = 40
const ORBIT_INSERTION_DEGREES = 80
// One and a half turns of the parking orbit, to the injection on the side away from the Moon.
const PARKING_TURN_DEGREES = 540
const LUNAR_TURNS = 4
// Where Eagle leaves Columbia and meets it again, measured round the Moon (counterclockwise from
// the far side), and where it lands: 23 degrees east of the point under Earth.
const EAGLE_DEGREES = 23
const SITE_DEGREES = 180 + EAGLE_DEGREES

// Round the Moon Columbia turns clockwise (retrograde) from the far side: the overall progress at
// which it stands at Eagle's undocking (second turn) and at the rendezvous (fourth turn).
export const UNDOCKING = 3 + (720 - EAGLE_DEGREES) / (360 * LUNAR_TURNS)
export const RENDEZVOUS = 3 + (1440 - EAGLE_DEGREES) / (360 * LUNAR_TURNS)

function ascent(s: number): P2 {
  const radius = EARTH_RADIUS + (PARKING_RADIUS - EARTH_RADIUS) * (1 - (1 - s) ** 2)
  return polar(EARTH, radius, LIFTOFF_DEGREES + (ORBIT_INSERTION_DEGREES - LIFTOFF_DEGREES) * s)
}

function parking(s: number): P2 {
  return polar(EARTH, PARKING_RADIUS, ORBIT_INSERTION_DEGREES + PARKING_TURN_DEGREES * s)
}

function lunarOrbit(s: number): P2 {
  return polar(MOON, LUNAR_ORBIT_RADIUS, -360 * LUNAR_TURNS * s)
}

interface Knot {
  p: P2
  // The direction the path takes through the knot (normalized on use).
  t: P2
}

const INJECTION_DEGREES = ORBIT_INSERTION_DEGREES + PARKING_TURN_DEGREES - 720
const FAR_SIDE: P2 = [MOON_DISTANCE + LUNAR_ORBIT_RADIUS, 0]
const OUTBOUND: Knot[] = [
  { p: polar(EARTH, PARKING_RADIUS, INJECTION_DEGREES), t: polar([0, 0], 1, INJECTION_DEGREES + 90) },
  { p: [MOON_DISTANCE * 0.5, 0], t: [1, 0.42] },
  { p: [MOON_DISTANCE - 1.6, 1.9], t: [1, -0.2] },
  { p: FAR_SIDE, t: [0, -1] },
]
const ENTRY_DEGREES = 95
const SPLASHDOWN_DEGREES = 150
const HOMEBOUND: Knot[] = [
  { p: FAR_SIDE, t: [0, -1] },
  { p: [MOON_DISTANCE - 1.6, -1.9], t: [-1, -0.2] },
  { p: [MOON_DISTANCE * 0.5, 0], t: [-1, 0.42] },
  { p: polar(EARTH, PARKING_RADIUS, ENTRY_DEGREES), t: polar([0, 0], 1, ENTRY_DEGREES + 90) },
]

// Down through the atmosphere: from the end of the way home, round and down to the sea.
function entry(s: number): P2 {
  const radius = PARKING_RADIUS - (PARKING_RADIUS - EARTH_RADIUS) * s * s
  return polar(EARTH, radius, ENTRY_DEGREES + (SPLASHDOWN_DEGREES - ENTRY_DEGREES) * s)
}

const SAMPLES_PER_SEGMENT = 200

// A smooth curve through the knots (cubic Hermite, each tangent as long as the chord).
function hermiteSamples(knots: Knot[]): P2[] {
  const points: P2[] = []
  for (let k = 0; k < knots.length - 1; k++) {
    const [a, b] = [knots[k], knots[k + 1]]
    const chord = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1])
    const [ta, tb] = [scaled(a.t, chord), scaled(b.t, chord)]
    for (let i = k === 0 ? 0 : 1; i <= SAMPLES_PER_SEGMENT; i++) points.push(hermite(a.p, ta, b.p, tb, i / SAMPLES_PER_SEGMENT))
  }
  return points
}

function scaled(v: P2, length: number): P2 {
  const n = Math.hypot(v[0], v[1])
  return [(v[0] * length) / n, (v[1] * length) / n]
}

function hermite(p0: P2, t0: P2, p1: P2, t1: P2, s: number): P2 {
  const [s2, s3] = [s * s, s * s * s]
  const h = [2 * s3 - 3 * s2 + 1, s3 - 2 * s2 + s, -2 * s3 + 3 * s2, s3 - s2]
  return [0, 1].map((i) => h[0] * p0[i] + h[1] * t0[i] + h[2] * p1[i] + h[3] * t1[i]) as P2
}

// A polyline walked at an even pace: s from 0 to 1 by the distance along it.
class EvenPath {
  private readonly lengths: number[] = [0]

  constructor(private readonly points: P2[]) {
    for (let i = 1; i < points.length; i++) {
      this.lengths.push(this.lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]))
    }
  }

  at(s: number): P2 {
    const target = s * this.lengths[this.lengths.length - 1]
    let i = 1
    while (i < this.lengths.length - 1 && this.lengths[i] < target) i++
    const f = (target - this.lengths[i - 1]) / (this.lengths[i] - this.lengths[i - 1] || 1)
    const [a, b] = [this.points[i - 1], this.points[i]]
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  }
}

const OUTBOUND_PATH = new EvenPath(hermiteSamples(OUTBOUND))
const HOMEBOUND_PATH = new EvenPath([...hermiteSamples(HOMEBOUND), ...Array.from({ length: SAMPLES_PER_SEGMENT }, (_, i) => entry((i + 1) / SAMPLES_PER_SEGMENT))])

// The five legs, one unit of progress each.
export const LEGS = ['ascent', 'parking', 'outbound', 'lunarOrbit', 'homebound'] as const
const LEG_POINTS: ((s: number) => P2)[] = [ascent, parking, (s) => OUTBOUND_PATH.at(s), lunarOrbit, (s) => HOMEBOUND_PATH.at(s)]

// Where the craft is at an overall progress from 0 (liftoff) to 5 (splashdown).
export function routePoint(progress: number): Vec3 {
  const p = Math.min(Math.max(progress, 0), LEGS.length)
  const leg = Math.min(Math.floor(p), LEGS.length - 1)
  return at(LEG_POINTS[leg](p - leg))
}

// The path between two progress values, as flat xyz for a line.
export function routePoints(from: number, to: number, count: number): Float32Array {
  const points = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) points.set(routePoint(from + ((to - from) * i) / Math.max(count - 1, 1)), i * 3)
  return points
}

export const LANDING_SITE: Vec3 = at(polar(MOON, MOON_RADIUS, SITE_DEGREES))

// Eagle on its own: from Columbia (0) down to the site (1) and back up to Columbia (2), half a turn
// each way, clockwise as Columbia goes.
export function eaglePoint(progress: number): Vec3 {
  const p = Math.min(Math.max(progress, 0), 2)
  if (p <= 1) return at(polar(MOON, LUNAR_ORBIT_RADIUS - (LUNAR_ORBIT_RADIUS - MOON_RADIUS) * p * p, EAGLE_DEGREES - 180 * p))
  const t = p - 1
  return at(polar(MOON, MOON_RADIUS + (LUNAR_ORBIT_RADIUS - MOON_RADIUS) * (1 - (1 - t) ** 2), SITE_DEGREES - 180 * t))
}

export function eaglePoints(from: number, to: number, count: number): Float32Array {
  const points = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) points.set(eaglePoint(from + ((to - from) * i) / Math.max(count - 1, 1)), i * 3)
  return points
}
