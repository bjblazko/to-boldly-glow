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

// Shared by latitudeMarkerPoints and latitudeMarkerCenter: the surface normal and surface point
// (both in Earth-local space) at `latitudeDegrees`, longitude fixed at the local +Y meridian
// (matching this project's sphere UV convention where phi=0 sits along +Y - see geometry/sphere.ts).
function latitudeSurfaceNormalAndPoint(
  radius: number,
  latitudeDegrees: number,
): { localNormal: [number, number, number]; localSurfacePoint: [number, number, number] } {
  const colatitude = ((90 - latitudeDegrees) * Math.PI) / 180 // 0 at north pole, PI at south pole
  const localNormal: [number, number, number] = [0, Math.sin(colatitude), Math.cos(colatitude)]
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
export function latitudeMarkerCenter(earthWorld: mat4, radius: number, latitudeDegrees: number): [number, number, number] {
  const { localSurfacePoint } = latitudeSurfaceNormalAndPoint(radius, latitudeDegrees)
  return transformPoint(earthWorld, localSurfacePoint)
}

// A small closed loop centered on Earth's surface at `latitudeDegrees` (longitude fixed at the
// local +Y meridian, matching this project's sphere UV convention where phi=0 sits along +Y - see
// geometry/sphere.ts). Built from an orthonormal (tangent1, tangent2) basis perpendicular to the
// surface normal at that point, so the loop lies flat against the surface rather than being an
// arbitrary 3D circle.
export function latitudeMarkerPoints(
  earthWorld: mat4,
  radius: number,
  latitudeDegrees: number,
  markerRadius: number,
  segments: number,
): Float32Array {
  const { localNormal, localSurfacePoint } = latitudeSurfaceNormalAndPoint(radius, latitudeDegrees)
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

// Two points: the latitude marker's own world position, and a point `length` world units toward
// the Sun (always at the world origin in this app - see main.ts's sunWorld comment).
export function sunAngleRayPoints(markerWorldPos: readonly [number, number, number], length: number): Float32Array {
  const distanceToSun = Math.hypot(markerWorldPos[0], markerWorldPos[1], markerWorldPos[2])
  const direction: [number, number, number] =
    distanceToSun < 1e-9
      ? [0, 0, 1] // degenerate (marker at the origin) - arbitrary direction, never hit in practice
      : [-markerWorldPos[0] / distanceToSun, -markerWorldPos[1] / distanceToSun, -markerWorldPos[2] / distanceToSun]
  const end: [number, number, number] = [
    markerWorldPos[0] + direction[0] * length,
    markerWorldPos[1] + direction[1] * length,
    markerWorldPos[2] + direction[2] * length,
  ]
  return new Float32Array([...markerWorldPos, ...end])
}
