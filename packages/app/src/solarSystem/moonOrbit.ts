import { mat4, vec3 } from 'gl-matrix'
import type { BodyDefinition } from './bodies'
import type { MoonDefinition } from './moons'
import { AU_TO_SCENE_UNITS, geometricBlend } from './sceneScale'
import { axisAlignmentRotation, ECLIPTIC_NORTH, equatorialToEclipticPoleDirection } from './poleOrientation'

// blend: 0 = fully realistic (the same true-AU-consistent scale used everywhere else), 1 = fully
// explorer (a hand-picked explorerOrbitVisualRadius, in the same spirit as each body's own
// explorerVisualRadius). Uses the same geometric blend as scaledBodyRadiusUnits (see
// geometricBlend in sceneScale.ts) rather than a linear one: the realistic and explorer endpoints
// here differ by 1-2 orders of magnitude (e.g. the Moon's true orbit radius in scene units is
// ~33x smaller than its hand-picked explorer radius), so a linear blend collapses to explorer-mode
// proportions almost immediately off blend=0. Geometric blending keeps the moon-to-parent distance
// proportional across the whole slider range instead.
export function scaledMoonOrbitRadiusUnits(
  orbitDistanceKm: number,
  explorerOrbitVisualRadius: number,
  blend: number,
  auKm: number,
): number {
  const realistic = (orbitDistanceKm / auKm) * AU_TO_SCENE_UNITS
  return geometricBlend(realistic, explorerOrbitVisualRadius, blend)
}

// Progress angle around the orbit, measured from an arbitrary epoch reference (this app doesn't
// model real orbital phase at J2000 for moons any more precisely than this). Driven by real
// elapsed time, so a negative period (Triton, uniquely among large moons, orbits retrograde)
// naturally produces motion in the opposite direction. The orbital PLANE's orientation is handled
// separately by moonOrbitPlaneTiltMatrix, not here.
export function moonOrbitAngleRadians(daysSinceEpoch: number, siderealOrbitPeriodDays: number): number {
  return (daysSinceEpoch / siderealOrbitPeriodDays) * 2 * Math.PI
}

// Tidally locked moons keep one face toward their parent as they orbit. With spin applied around
// local Z (matching how planets spin - see poleOrientation.ts/main.ts) and the flat orbital
// position built in the XY-plane (see moonFlatOrbitPosition), the correct sign is the SAME as the
// orbital angle. This is the opposite of the sign needed under this app's previous Y-axis-spin/
// XZ-plane convention: mat4.fromYRotation maps local +Z to (sin, 0, cos), a coordinate order that
// required negating the angle to stay locked, whereas mat4.fromZRotation maps local +X to
// (cos, sin, 0) directly, needing no negation. Verified in moonOrbit.test.ts.
export function moonRotationAngleRadians(orbitAngleRadians: number): number {
  return orbitAngleRadians
}

// Position on a flat circular orbit lying in the ecliptic-aligned XY-plane (matching
// @toboldlyglow/engine's convention, where z is the out-of-plane axis) - i.e. the moon's position
// before any tilt (from its parent's real axial tilt, or the moon's own small inclination to its
// parent's equator) is applied. See moonOrbitPlaneTiltMatrix for the tilt step.
export function moonFlatOrbitPosition(orbitRadius: number, angleRadians: number): [number, number, number] {
  return [orbitRadius * Math.cos(angleRadians), orbitRadius * Math.sin(angleRadians), 0]
}

// The rotation that tilts a moon's flat (untitled) orbital plane into its real 3D orientation:
// first inclines it by the moon's own small inclination-to-parent-equator (rotation about the
// local X axis), then rotates that tilt to face the given ascending node direction (rotation
// about local Z), then aligns the whole thing so its normal points along the reference pole
// direction (see axisAlignmentRotation) - the classical inclination/node composition used for
// orbital elements, applied as a single matrix reused for both a moon's position (see
// moonRelativePosition) and its own spin (tidal lock is preserved under any single rigid
// transform applied uniformly to both - see moonRotationAngleRadians).
export function moonOrbitPlaneTiltMatrix(
  inclinationToParentEquatorDegrees: number,
  ascendingNodeDegrees: number,
  referencePoleDirection: readonly [number, number, number],
): mat4 {
  const inclinationRadians = (inclinationToParentEquatorDegrees * Math.PI) / 180
  const nodeRadians = (ascendingNodeDegrees * Math.PI) / 180
  const inclination = mat4.fromXRotation(mat4.create(), inclinationRadians)
  const node = mat4.fromZRotation(mat4.create(), nodeRadians)
  const nodeThenInclination = mat4.multiply(mat4.create(), node, inclination)
  return mat4.multiply(mat4.create(), axisAlignmentRotation(referencePoleDirection), nodeThenInclination)
}

// The Moon's real orbital plane precesses relative to the ECLIPTIC (not relative to Earth's
// equator) with an ~18.6-year period, driven by solar perturbation - unlike the other 8 moons in
// this set, whose orbital planes genuinely track their parent's equatorial bulge. Since
// precession isn't modeled, the Moon is built directly from ecliptic-north rather than composed
// with Earth's pole direction; every other moon composes with its real parent.
export function moonOrbitReferencePoleDirection(
  moon: MoonDefinition,
  parent: BodyDefinition,
): [number, number, number] {
  if (moon.id === 'moon') return [...ECLIPTIC_NORTH]
  return equatorialToEclipticPoleDirection(parent.poleRightAscensionDegrees, parent.poleDeclinationDegrees)
}

// A moon's position relative to its parent's center, combining its flat orbital motion with the
// real 3D tilt of its orbital plane.
export function moonRelativePosition(
  orbitRadius: number,
  angleRadians: number,
  inclinationToParentEquatorDegrees: number,
  ascendingNodeDegrees: number,
  referencePoleDirection: readonly [number, number, number],
): [number, number, number] {
  const flat = moonFlatOrbitPosition(orbitRadius, angleRadians)
  const tilt = moonOrbitPlaneTiltMatrix(inclinationToParentEquatorDegrees, ascendingNodeDegrees, referencePoleDirection)
  const tilted = vec3.transformMat4(vec3.create(), flat, tilt)
  return [tilted[0], tilted[1], tilted[2]]
}
