import { mat4, quat } from 'gl-matrix'

// Earth's obliquity of the ecliptic at J2000 (IAU-adopted constant). IAU pole right-
// ascension/declination values are published in the equatorial (ICRF) frame; this converts them
// into this app's ecliptic-referenced scene frame.
const OBLIQUITY_OF_ECLIPTIC_RADIANS = (23.4392911 * Math.PI) / 180

// The scene axis @toboldlyglow/engine's sphericalToX/Y/Z convention treats as "out of the orbital
// plane" (sphericalToZ = radius * sin(latitude)). This is the default, zero-tilt pole direction.
export const ECLIPTIC_NORTH: readonly [number, number, number] = [0, 0, 1]

// Converts a body's real north-pole direction from equatorial (RA/Dec, degrees, as published by
// the IAU Working Group on Cartographic Coordinates and Rotational Elements) into this app's
// ecliptic scene frame: x,y in-plane, z out-of-plane.
export function equatorialToEclipticPoleDirection(
  raDegrees: number,
  decDegrees: number,
): [number, number, number] {
  const ra = (raDegrees * Math.PI) / 180
  const dec = (decDegrees * Math.PI) / 180
  const xEquatorial = Math.cos(dec) * Math.cos(ra)
  const yEquatorial = Math.cos(dec) * Math.sin(ra)
  const zEquatorial = Math.sin(dec)
  const cosObliquity = Math.cos(OBLIQUITY_OF_ECLIPTIC_RADIANS)
  const sinObliquity = Math.sin(OBLIQUITY_OF_ECLIPTIC_RADIANS)
  // Standard equatorial-to-ecliptic rotation: about the shared x-axis (the vernal equinox
  // direction) by the negative of the obliquity.
  return [
    xEquatorial,
    yEquatorial * cosObliquity + zEquatorial * sinObliquity,
    -yEquatorial * sinObliquity + zEquatorial * cosObliquity,
  ]
}

// The minimal rotation matrix mapping the local +Z axis onto `direction` (assumed a unit vector).
// Used to tilt a body (or an orbital plane) that's defined "flat" - aligned with local Z - into
// its real 3D orientation in one step.
export function axisAlignmentRotation(direction: readonly [number, number, number]): mat4 {
  const rotation = quat.rotationTo(quat.create(), [0, 0, 1], direction)
  return mat4.fromQuat(mat4.create(), rotation)
}
