import { mat3, mat4, vec3, type ReadonlyVec3 } from 'gl-matrix'
import type { Vec3 } from '../../math/tuples'

// Geometry of the seasons lesson's overlay lines. Functions taking `earthWorld` (Earth's world
// matrix: translation * tilt, no scale) work in Earth-local space, polar axis = local +Z as on every
// sphere (see bodies/sphereMesh.ts); all return flat [x0, y0, z0, x1, ...] world-space line strips.

function transformPoint(world: mat4, local: readonly [number, number, number]): [number, number, number] {
  const out = vec3.transformMat4(vec3.create(), local, world)
  return [out[0], out[1], out[2]]
}

// A closed loop of `segments` points tracing Earth's equatorial plane (local XY) at `radius`.
export function equatorRingPoints(earthWorld: mat4, radius: number, segments: number): Float32Array {
  const points = new Float32Array((segments + 1) * 3)
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    const local: [number, number, number] = [radius * Math.cos(angle), radius * Math.sin(angle), 0]
    const [x, y, z] = transformPoint(earthWorld, local)
    points[i * 3] = x
    points[i * 3 + 1] = y
    points[i * 3 + 2] = z
  }
  return points
}

// Two points along Earth's local +Z (its real rotation axis), extending `overshootFactor` times
// past each pole so the line is visibly longer than the globe itself.
export function rotationAxisPoints(earthWorld: mat4, radius: number, overshootFactor: number): Float32Array {
  const south = transformPoint(earthWorld, [0, 0, -radius * overshootFactor])
  const north = transformPoint(earthWorld, [0, 0, radius * overshootFactor])
  return new Float32Array([...south, ...north])
}

// A point on Earth's surface. Longitude turns around the polar axis from the local +Y meridian
// (the sphere mesh's u = 0.5 seam convention, see bodies/sphereMesh.ts) toward local +X.
export interface SurfaceSpot {
  surfaceRadius: number
  latitudeDegrees: number
  longitudeDegrees?: number
}

function surfaceNormal({ latitudeDegrees, longitudeDegrees = 0 }: SurfaceSpot): Vec3 {
  const colatitude = ((90 - latitudeDegrees) * Math.PI) / 180 // 0 at the north pole, PI at the south pole
  const longitude = (longitudeDegrees * Math.PI) / 180
  return [Math.sin(colatitude) * Math.sin(longitude), Math.sin(colatitude) * Math.cos(longitude), Math.cos(colatitude)]
}

function surfacePoint(spot: SurfaceSpot): Vec3 {
  const normal = surfaceNormal(spot)
  return [normal[0] * spot.surfaceRadius, normal[1] * spot.surfaceRadius, normal[2] * spot.surfaceRadius]
}

// The world-space point a latitude marker's ring is centered on.
export function latitudeMarkerCenter(earthWorld: mat4, spot: SurfaceSpot): Vec3 {
  return transformPoint(earthWorld, surfacePoint(spot))
}

// Two unit vectors spanning the plane tangent to the surface at `normal` (Gram-Schmidt against
// local +X, or +Y at the poles, where +X would be degenerate).
function surfaceTangents(normal: Vec3): [Vec3, Vec3] {
  const reference: Vec3 = Math.abs(normal[2]) > 0.999 ? [0, 1, 0] : [1, 0, 0]
  const dot = reference[0] * normal[0] + reference[1] * normal[1] + reference[2] * normal[2]
  const unnormalized: Vec3 = [reference[0] - dot * normal[0], reference[1] - dot * normal[1], reference[2] - dot * normal[2]]
  const length = Math.hypot(...unnormalized)
  const tangent1: Vec3 = [unnormalized[0] / length, unnormalized[1] / length, unnormalized[2] / length]
  const tangent2: Vec3 = [
    normal[1] * tangent1[2] - normal[2] * tangent1[1],
    normal[2] * tangent1[0] - normal[0] * tangent1[2],
    normal[0] * tangent1[1] - normal[1] * tangent1[0],
  ]
  return [tangent1, tangent2]
}

// A small closed ring lying flat on Earth's surface around a spot.
export function latitudeMarkerPoints(earthWorld: mat4, spot: SurfaceSpot, ring: { radius: number; segments: number }): Float32Array {
  const center = surfacePoint(spot)
  const [tangent1, tangent2] = surfaceTangents(surfaceNormal(spot))
  const points = new Float32Array((ring.segments + 1) * 3)
  for (let i = 0; i <= ring.segments; i++) {
    const angle = (i / ring.segments) * 2 * Math.PI
    const local: Vec3 = [0, 1, 2].map(
      (axis) => center[axis] + ring.radius * (Math.cos(angle) * tangent1[axis] + Math.sin(angle) * tangent2[axis]),
    ) as Vec3
    points.set(transformPoint(earthWorld, local), i * 3)
  }
  return points
}

// A geodesic arc from one direction to another (neither needs unit length), around `center` at
// `radius`, built by spherical interpolation since the two directions generally share no fixed
// world plane. Where they coincide there is nothing to sweep (and slerp would divide by zero), so
// every point sits at `from`.
export interface ArcSpec {
  center: ArrayLike<number>
  from: ReadonlyVec3
  to: ReadonlyVec3
  radius: number
}

export function greatCircleArcPoints({ center, from: fromDirection, to: toDirection, radius }: ArcSpec, segments: number): Float32Array {
  const points = new Float32Array((segments + 1) * 3)
  const from = vec3.normalize(vec3.create(), fromDirection)
  const to = vec3.normalize(vec3.create(), toDirection)
  const nearlyIdentical = vec3.dot(from, to) > 0.9999999
  for (let i = 0; i <= segments; i++) {
    const direction = nearlyIdentical ? from : vec3.slerp(vec3.create(), from, to, i / segments)
    points.set([center[0] + radius * direction[0], center[1] + radius * direction[1], center[2] + radius * direction[2]], i * 3)
  }
  return points
}

// A short line segment through `center`, extending `length` in both directions along `direction`
// (need not be unit-length - normalized internally). Used by the orbit chapters for two roles that
// share this same shape: the fixed axis line (seasonalPole.ts's ORBIT_FIXED_POLE_DIRECTION, already
// expressed directly in world space, unlike rotationAxisPoints' local +Z which needs a per-body
// matrix transform) and the current Sun-Earth reference line (which rotates chapter to chapter,
// unlike the staged chapters' always-vertical verticalReferencePoints).
export function directedLinePoints(
  center: readonly [number, number, number],
  direction: readonly [number, number, number],
  length: number,
): Float32Array {
  const unit = vec3.normalize(vec3.create(), direction)
  return new Float32Array([
    center[0] - unit[0] * length,
    center[1] - unit[1] * length,
    center[2] - unit[2] * length,
    center[0] + unit[0] * length,
    center[1] + unit[1] * length,
    center[2] + unit[2] * length,
  ])
}

// A closed loop tracing the compact circular path Earth's position moves along during the orbit
// chapters (see orbitPositionForPhase below) - centered on the Sun (the world origin, which this
// lesson never moves - see EARTH_STAGED_POSITION in seasonsScene.ts), lying flat in the
// world X-Y plane (matching how every real body's own orbital position in this app already lies
// close to that plane - world Z is "ecliptic north", see poleOrientation.ts's ECLIPTIC_NORTH).
// Unlike equatorRingPoints above, this needs no world-matrix transform: the orbit circle doesn't
// rotate or tilt at any phase.
export function orbitPathCirclePoints(radius: number, segments: number): Float32Array {
  const points = new Float32Array((segments + 1) * 3)
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    points[i * 3] = radius * Math.cos(angle)
    points[i * 3 + 1] = radius * Math.sin(angle)
    points[i * 3 + 2] = 0
  }
  return points
}

// Earth's position on the compact, circular "real orbit" path used by this lesson's orbit
// chapters - NOT the real elliptical orbit-path renderer used in explore mode, and not to any real
// AU scale. Uses the exact same phase convention seasonalPoleDirection uses for its own lean (0 =
// June solstice, 90 = September equinox, 180 = December solstice, 270 = March equinox), applied
// here to a position on a circle instead of a tilt: the Sun-Earth radial direction at phase P is
// [cos(P), sin(P), 0], lying flat in the world X-Y plane (see orbitPathCirclePoints above).
export function orbitPositionForPhase(phaseDegrees: number, orbitRadius: number): [number, number, number] {
  const phase = (phaseDegrees * Math.PI) / 180
  return [orbitRadius * Math.cos(phase), orbitRadius * Math.sin(phase), 0]
}

// The component of `vector` perpendicular to `referenceDirection` (neither needs to be
// unit-length - both normalized internally), itself normalized to unit length. Used by the orbit
// chapters' angle arc: the "zero-tilt" reference for "how far does the fixed axis lean away from
// perpendicular-to-the-Sun" is not the sunward direction itself (a perfectly upright axis would be
// 90 degrees from sunward, not 0) but the axis's own component perpendicular to sunward - drawing
// the arc from THIS to the axis sweeps exactly the angle the label displays, instead of the raw
// angle to the sunward direction (which is 90 degrees at the equinoxes and 90 +/- 23.4 degrees at
// the solstices - correct as a number after Task 3's own fix, but visually mismatched with an arc
// that swept the raw angle instead).
export function perpendicularComponent(
  vector: readonly [number, number, number],
  referenceDirection: readonly [number, number, number],
): [number, number, number] {
  const unitVector = vec3.normalize(vec3.create(), vector)
  const unitReference = vec3.normalize(vec3.create(), referenceDirection)
  const dot = unitVector[0] * unitReference[0] + unitVector[1] * unitReference[1] + unitVector[2] * unitReference[2]
  const perp: [number, number, number] = [
    unitVector[0] - dot * unitReference[0],
    unitVector[1] - dot * unitReference[1],
    unitVector[2] - dot * unitReference[2],
  ]
  const unitPerp = vec3.normalize(vec3.create(), perp)
  return [unitPerp[0], unitPerp[1], unitPerp[2]]
}

// The longitude (degrees, in latitudeSurfaceNormalAndPoint's convention: measured from the local +Y
// meridian toward local +X) of the meridian that faces `worldDirection` on a body tilted by
// `tilt` (its world rotation, local +Z = the body's pole). Lets callers pin a surface marker to a
// fixed side of the scene (e.g. "facing the Sun and the camera") no matter how the pole is oriented,
// rather than to a fixed local longitude - axisAlignmentRotation picks a different minimal rotation
// for every pole direction, so a fixed local longitude wanders across the globe as the pole moves.
export function meridianLongitudeFacing(tilt: mat4, worldDirection: readonly [number, number, number]): number {
  // A pure rotation's inverse is its transpose; using only the 3x3 part treats the input as a
  // direction (no translation).
  const toLocal = mat3.transpose(mat3.create(), mat3.fromMat4(mat3.create(), tilt))
  const local = vec3.transformMat3(vec3.create(), worldDirection, toLocal)
  return (Math.atan2(local[0], local[1]) * 180) / Math.PI
}

// The lesson's tilt reading: how far the north end of the axis leans toward the Sun (positive) or
// away from it (negative) - i.e. the subsolar latitude, the Sun's declination. Earth's tilt against
// its orbit is a constant 23.4 degrees; this is the part of it pointing at the Sun, which is what
// changes over the year. Zero means the whole tilt points sideways (the equinoxes).
export function sunLeanLabel(subsolarLatitudeRadians: number): string {
  const degrees = (Math.abs(subsolarLatitudeRadians) * 180) / Math.PI
  const shown = degrees.toFixed(1)
  if (shown === '0.0') return '0.0° (tilt points sideways)'
  return `${shown}° ${subsolarLatitudeRadians > 0 ? 'toward' : 'away from'} the Sun`
}
