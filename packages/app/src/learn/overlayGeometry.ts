import { mat4, vec3 } from 'gl-matrix'

// All four functions here take `earthWorld` (Earth's own world matrix - translation * tilt, no
// scale, since these already work in real-radius units) and return a flat [x0,y0,z0,x1,y1,z1,...]
// Float32Array in WORLD space, ready for createLineVertexBuffer/computeCumulativeLineDistances
// (see renderer/lineDistance.ts). Local-space points follow this project's established sphere
// convention: polar axis = local +Z (see geometry/sphere.ts's doc comment), matching
// axisAlignmentRotation's own contract.

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

// A short "true vertical" reference segment through `center`, in WORLD space (not Earth-local -
// it deliberately does NOT rotate with Earth's tilt, since it represents the zero-tilt baseline
// the tilt-angle arc below sweeps away from). Drawn along world +Y, the direction Earth's axis
// would point if it had no seasonal lean at all - see seasonalPoleDirection in main.ts.
export function verticalReferencePoints(center: readonly [number, number, number], length: number): Float32Array {
  return new Float32Array([center[0], center[1] - length, center[2], center[0], center[1] + length, center[2]])
}

// A circular arc, centered on `center` and lying in the world XY plane (matching the learn-mode
// camera's screen plane - see applyLearnCameraFraming's upAxis choice in main.ts), sweeping from
// straight up (world +Y, angle 0 - the same direction verticalReferencePoints draws) through
// `angleRadians` of rotation toward world +X. A positive angle sweeps toward +X, a negative angle
// toward -X - callers pass the pole direction's own atan2(x, y) so the arc always sweeps the same
// way the axis line itself leans. `segments` is always the full point count regardless of how
// small `angleRadians` is (down to a zero-length arc at every point), matching this project's
// fixed-size-overlay-buffer convention (see main.ts's OVERLAY_LATITUDE_MARKER_SEGMENTS comment).
export function tiltAngleArcPoints(
  center: readonly [number, number, number],
  radius: number,
  angleRadians: number,
  segments: number,
): Float32Array {
  const points = new Float32Array((segments + 1) * 3)
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * angleRadians
    points[i * 3] = center[0] + radius * Math.sin(t)
    points[i * 3 + 1] = center[1] + radius * Math.cos(t)
    points[i * 3 + 2] = center[2]
  }
  return points
}

// Shared by latitudeMarkerPoints and latitudeMarkerCenter: the surface normal and surface point
// (both in Earth-local space) at `latitudeDegrees`. `longitudeDegrees` (default 0) rotates around
// the polar axis from the local +Y meridian (matching this project's sphere UV convention where
// phi=0 sits along +Y - see geometry/sphere.ts) toward local +X - callers use this to place a
// marker nearer the sunward meridian rather than always on the +Y one (see main.ts's
// LEARN_MARKER_LONGITUDE_DEGREES).
function latitudeSurfaceNormalAndPoint(
  radius: number,
  latitudeDegrees: number,
  longitudeDegrees = 0,
): { localNormal: [number, number, number]; localSurfacePoint: [number, number, number] } {
  const colatitude = ((90 - latitudeDegrees) * Math.PI) / 180 // 0 at north pole, PI at south pole
  const longitude = (longitudeDegrees * Math.PI) / 180
  const localNormal: [number, number, number] = [
    Math.sin(colatitude) * Math.sin(longitude),
    Math.sin(colatitude) * Math.cos(longitude),
    Math.cos(colatitude),
  ]
  const localSurfacePoint: [number, number, number] = [
    localNormal[0] * radius,
    localNormal[1] * radius,
    localNormal[2] * radius,
  ]
  return { localNormal, localSurfacePoint }
}

// The true surface point (in world space) that latitudeMarkerPoints draws its ring around - i.e.
// the ring's actual center, not any particular vertex on its circumference. Callers that need "the
// point on Earth's surface at this latitude" (e.g. the sun-angle ray's origin) should use this
// rather than reconstructing it from two of the ring's own (adjacent, not opposite) vertices.
export function latitudeMarkerCenter(
  earthWorld: mat4,
  radius: number,
  latitudeDegrees: number,
  longitudeDegrees = 0,
): [number, number, number] {
  const { localSurfacePoint } = latitudeSurfaceNormalAndPoint(radius, latitudeDegrees, longitudeDegrees)
  return transformPoint(earthWorld, localSurfacePoint)
}

// A small closed loop centered on Earth's surface at `latitudeDegrees`/`longitudeDegrees` (see
// latitudeSurfaceNormalAndPoint above for the longitude convention). Built from an orthonormal
// (tangent1, tangent2) basis perpendicular to the surface normal at that point, so the loop lies
// flat against the surface rather than being an arbitrary 3D circle.
export function latitudeMarkerPoints(
  earthWorld: mat4,
  radius: number,
  latitudeDegrees: number,
  markerRadius: number,
  segments: number,
  longitudeDegrees = 0,
): Float32Array {
  const { localNormal, localSurfacePoint } = latitudeSurfaceNormalAndPoint(radius, latitudeDegrees, longitudeDegrees)
  // Gram-Schmidt against local +X, falling back to local +Y only at the poles (where normal is
  // parallel to +Z, making +X a valid, non-degenerate reference at every other latitude).
  const reference: [number, number, number] = Math.abs(localNormal[2]) > 0.999 ? [0, 1, 0] : [1, 0, 0]
  const dot = reference[0] * localNormal[0] + reference[1] * localNormal[1] + reference[2] * localNormal[2]
  const t1Unnormalized: [number, number, number] = [
    reference[0] - dot * localNormal[0],
    reference[1] - dot * localNormal[1],
    reference[2] - dot * localNormal[2],
  ]
  const t1Length = Math.hypot(...t1Unnormalized)
  const tangent1: [number, number, number] = [t1Unnormalized[0] / t1Length, t1Unnormalized[1] / t1Length, t1Unnormalized[2] / t1Length]
  const tangent2: [number, number, number] = [
    localNormal[1] * tangent1[2] - localNormal[2] * tangent1[1],
    localNormal[2] * tangent1[0] - localNormal[0] * tangent1[2],
    localNormal[0] * tangent1[1] - localNormal[1] * tangent1[0],
  ]

  const points = new Float32Array((segments + 1) * 3)
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    const local: [number, number, number] = [
      localSurfacePoint[0] + markerRadius * (Math.cos(angle) * tangent1[0] + Math.sin(angle) * tangent2[0]),
      localSurfacePoint[1] + markerRadius * (Math.cos(angle) * tangent1[1] + Math.sin(angle) * tangent2[1]),
      localSurfacePoint[2] + markerRadius * (Math.cos(angle) * tangent1[2] + Math.sin(angle) * tangent2[2]),
    ]
    const [x, y, z] = transformPoint(earthWorld, local)
    points[i * 3] = x
    points[i * 3 + 1] = y
    points[i * 3 + 2] = z
  }
  return points
}

// The angle (radians, always in [0, PI]) between any two arbitrary directions, via the standard
// acos-of-normalized-dot-product formula - normalizes both inputs internally, so callers don't
// need to pre-normalize. Used by the orbit chapters to display "how far apart" the fixed axis and
// the current Sun-Earth direction are (main.ts's per-frame orbit-chapter overlay block), the same
// way the staged chapters' atan2-based tilt angle does for its own fixed-plane case.
export function angleBetweenDirections(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const unitA = vec3.normalize(vec3.create(), a)
  const unitB = vec3.normalize(vec3.create(), b)
  const dot = unitA[0] * unitB[0] + unitA[1] * unitB[1] + unitA[2] * unitB[2]
  return Math.acos(Math.min(1, Math.max(-1, dot)))
}

// A geodesic arc from `fromDirection` to `toDirection` (need not be unit-length - normalized
// internally), centered on `center` at `radius`. Built with spherical linear interpolation
// (gl-matrix's vec3.slerp) rather than a fixed-plane sin/cos parameterization like
// tiltAngleArcPoints above, since the orbit chapters' two directions (the current Sun-Earth line
// and the fixed axis) are only coplanar with a shared fixed world plane at the solstice phases,
// not generally. Guards the case where the two directions already coincide (slerp divides by zero
// there - see cameraFollow.ts's own identical guard, added for the same reason) by returning every
// point at `fromDirection` since there's nothing to sweep.
export function greatCircleArcPoints(
  center: readonly [number, number, number],
  fromDirection: readonly [number, number, number],
  toDirection: readonly [number, number, number],
  radius: number,
  segments: number,
): Float32Array {
  const points = new Float32Array((segments + 1) * 3)
  const from = vec3.normalize(vec3.create(), fromDirection)
  const to = vec3.normalize(vec3.create(), toDirection)
  const nearlyIdentical = vec3.dot(from, to) > 0.9999999
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const direction = nearlyIdentical ? from : vec3.slerp(vec3.create(), from, to, t)
    points[i * 3] = center[0] + radius * direction[0]
    points[i * 3 + 1] = center[1] + radius * direction[1]
    points[i * 3 + 2] = center[2] + radius * direction[2]
  }
  return points
}

// A short line segment through `center`, extending `length` in both directions along `direction`
// (need not be unit-length - normalized internally). Used by the orbit chapters for two roles that
// share this same shape: the fixed axis line (main.ts's ORBIT_FIXED_POLE_DIRECTION, already
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
// lesson never moves - see EARTH_STAGED_POSITION's own comment in main.ts), lying flat in the
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
