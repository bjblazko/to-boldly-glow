import { vec3, type mat4 } from 'gl-matrix'
import { pointAlong, type Vec3 } from '../../math/tuples'
import { AU_KM, PLANETS, SUN } from '../../solarSystem/bodies'
import { MOONS } from '../../solarSystem/moons'
import { moonOrbitPlaneTiltMatrix, moonRelativePosition } from '../../solarSystem/moonOrbit'
import { ECLIPTIC_NORTH } from '../../solarSystem/poleOrientation'
import { scaledBodyRadiusUnits } from '../../solarSystem/sceneScale'

// The solar eclipse lesson's staged scenes. Seen from space: the Sun at the origin (Compact size),
// Earth on its +X side, the Moon on a small tilted orbit around Earth, all far closer together than
// they are. What the picture keeps true is what makes eclipses work: Earth and Moon in their real
// size ratio, and the Moon looking just a little bigger than the Sun from the ground under it, so
// its shadow narrows to a small dark core on Earth inside a far wider soft shadow.

export const SUN_RADIUS = scaledBodyRadiusUnits(SUN.radiusKm, SUN.compactVisualRadius, 1, AU_KM)
export const EARTH_POSITION: Vec3 = [40, 0, 0]
export const EARTH_RADIUS = 2
const EARTH_RADIUS_KM = PLANETS.find((planet) => planet.id === 'earth')!.radiusKm
export const MOON_RADIUS = EARTH_RADIUS * (MOONS.find((moon) => moon.id === 'moon')!.radiusKm / EARTH_RADIUS_KM)

// How much bigger than the Sun the Moon looks from the point on Earth right under it. In a real
// total eclipse it is 1.0 to 1.06; a little more here, so the dark core of the shadow is wide
// enough to see.
export const SHADOW_SIZE_RATIO = 1.12

// The Moon's distance from Earth's center that gives SHADOW_SIZE_RATIO: from the surface under
// the Moon, the Moon's angular radius MOON_RADIUS / s is that much the Sun's, SUN_RADIUS / (D - R).
export const MOON_ORBIT_RADIUS = EARTH_RADIUS + (MOON_RADIUS * (EARTH_POSITION[0] - EARTH_RADIUS)) / (SHADOW_SIZE_RATIO * SUN_RADIUS)

// The Moon's orbit is tilted 5.1 degrees to Earth's; squeezed this close to Earth, a tilt that small
// would never lift its shadow off Earth, so the picture draws it about five times steeper.
export const REAL_MOON_ORBIT_TILT_DEGREES = 5.1
export const MOON_ORBIT_TILT_DEGREES = 25

export function moonOrbitTilt(nodeDegrees: number, tiltDegrees = MOON_ORBIT_TILT_DEGREES): mat4 {
  return moonOrbitPlaneTiltMatrix(tiltDegrees, nodeDegrees, ECLIPTIC_NORTH)
}

// The Moon's angle around its orbit (moonOrbit.ts's convention) at new moon - when it stands
// between the Sun (on Earth's -X side) and Earth - for the orbit's node direction.
export function newMoonOrbitAngleDegrees(nodeDegrees: number): number {
  return 180 - nodeDegrees
}

// Where the Moon is, `degreesPastNewMoon` along its orbit after new moon (around an Earth on the
// Sun's +X side, by default this lesson's).
export function stagedMoonPosition(nodeDegrees: number, degreesPastNewMoon: number, tiltDegrees = MOON_ORBIT_TILT_DEGREES, earth: Vec3 = EARTH_POSITION): Vec3 {
  const angle = ((newMoonOrbitAngleDegrees(nodeDegrees) + degreesPastNewMoon) * Math.PI) / 180
  const offset = moonRelativePosition(MOON_ORBIT_RADIUS, angle, moonOrbitTilt(nodeDegrees, tiltDegrees))
  return [earth[0] + offset[0], earth[1] + offset[1], earth[2] + offset[2]]
}

export interface Sphere {
  position: ArrayLike<number>
  radius: number
}

// The edges of the Moon's shadow in the plane through the Sun-Moon line that holds `up`, as
// two-point lines from the Sun's limb past the Moon's. The umbra's edges graze both on the same
// side and meet at the umbra's tip; the penumbra's cross between them and spread out to `reach`
// (measured from the Sun along the Sun-Moon line).
export function shadowEdgeLines(sun: Sphere, moon: Sphere, up: Vec3, reach: number): { umbra: Float32Array[]; penumbra: Float32Array[] } {
  const { axis, distance } = sunToMoon(sun, moon)
  const across = perpendicularUnit(up, axis)
  const tipDistance = (distance * sun.radius) / (sun.radius - moon.radius)
  const tip = pointAlong(sun.position, axis, tipDistance)
  const edge = (side: number) => {
    const fromSun = pointAlong(sun.position, across, side * sun.radius)
    const pastMoon = pointAlong(moon.position, across, -side * moon.radius)
    const t = reach / distance
    const end = [0, 1, 2].map((i) => fromSun[i] + (pastMoon[i] - fromSun[i]) * t)
    return { umbra: new Float32Array([...fromSun, ...tip]), penumbra: new Float32Array([...fromSun, ...end]) }
  }
  const [upper, lower] = [edge(1), edge(-1)]
  return { umbra: [upper.umbra, lower.umbra], penumbra: [upper.penumbra, lower.penumbra] }
}

// Where the middle of the Moon's shadow lands on Earth, and how wide its dark core (umbra) and soft
// outer shadow (penumbra) are there - or null while the shadow misses Earth.
export interface ShadowSpot {
  center: Vec3
  umbraRadius: number
  penumbraRadius: number
}

export function shadowOnEarth(sun: Sphere, moon: Sphere, earth: Sphere): ShadowSpot | null {
  const { axis, distance } = sunToMoon(sun, moon)
  const hit = rayHitsSphere(moon.position, axis, earth)
  if (hit === null) return null
  return {
    center: pointAlong(moon.position, axis, hit),
    umbraRadius: moon.radius - (hit * (sun.radius - moon.radius)) / distance,
    penumbraRadius: moon.radius + (hit * (sun.radius + moon.radius)) / distance,
  }
}

// The outline of the umbra or the penumbra on Earth, as a closed loop just above the surface: the
// shadow's round cross-section where it reaches Earth, carried along the shadow onto the globe.
// Where the shadow hangs over Earth's edge, the loop follows the edge.
export function shadowOutlinePoints(spot: ShadowSpot, shadow: { sun: Sphere; moon: Sphere; earth: Sphere }, part: 'umbra' | 'penumbra', segments: number): Float32Array {
  const { axis } = sunToMoon(shadow.sun, shadow.moon)
  const across = perpendicularUnit([0, 0, 1], axis)
  const third = vec3.cross(vec3.create(), axis, across)
  const radius = Math.max(part === 'umbra' ? spot.umbraRadius : spot.penumbraRadius, 0)
  const lift = shadow.earth.radius * OUTLINE_LIFT
  const points = new Float32Array((segments + 1) * 3)
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    const offset = [0, 1, 2].map((k) => radius * (Math.cos(angle) * across[k] + Math.sin(angle) * third[k]))
    const start = pointAlong([0, 1, 2].map((k) => spot.center[k] + offset[k]), axis, -shadow.earth.radius * 2)
    points.set(onSurface(start, axis, shadow.earth, lift), i * 3)
  }
  return points
}

const OUTLINE_LIFT = 0.006

// Where a ray parallel to the shadow first meets the globe, raised by `lift` - or, if it passes
// Earth by, the nearest point on Earth's edge.
function onSurface(origin: ArrayLike<number>, axis: Vec3, earth: Sphere, lift: number): Vec3 {
  const hit = rayHitsSphere(origin, axis, earth)
  const along = hit ?? [0, 1, 2].reduce((sum, k) => sum + (earth.position[k] - origin[k]) * axis[k], 0)
  const point = pointAlong(origin, axis, along)
  const outward = vec3.normalize(vec3.create(), [point[0] - earth.position[0], point[1] - earth.position[1], point[2] - earth.position[2]])
  return pointAlong(earth.position, outward, earth.radius + lift)
}

function sunToMoon(sun: Sphere, moon: Sphere): { axis: Vec3; distance: number } {
  const delta: Vec3 = [moon.position[0] - sun.position[0], moon.position[1] - sun.position[1], moon.position[2] - sun.position[2]]
  const distance = Math.hypot(...delta)
  return { axis: [delta[0] / distance, delta[1] / distance, delta[2] / distance], distance }
}

// The unit part of `vector` square to the unit `axis`.
export function perpendicularUnit(vector: ArrayLike<number>, axis: ArrayLike<number>): Vec3 {
  const along = vector[0] * axis[0] + vector[1] * axis[1] + vector[2] * axis[2]
  const result = vec3.normalize(vec3.create(), [vector[0] - along * axis[0], vector[1] - along * axis[1], vector[2] - along * axis[2]])
  return [result[0], result[1], result[2]]
}

// Distance along a unit ray to where it first enters the sphere, or null if it misses (or the
// sphere lies behind it).
function rayHitsSphere(origin: ArrayLike<number>, direction: Vec3, sphere: Sphere): number | null {
  const toCenter = [0, 1, 2].map((i) => sphere.position[i] - origin[i])
  const along = toCenter[0] * direction[0] + toCenter[1] * direction[1] + toCenter[2] * direction[2]
  const missSquared = toCenter[0] ** 2 + toCenter[1] ** 2 + toCenter[2] ** 2 - along * along
  const halfChordSquared = sphere.radius ** 2 - missSquared
  if (halfChordSquared < 0 || along <= 0) return null
  return along - Math.sqrt(halfChordSquared)
}
