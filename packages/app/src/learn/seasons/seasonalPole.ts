import { axisAlignmentRotation } from '../../solarSystem/poleOrientation'
import { clamp, degreesToRadians, type Vec3 } from '../../math/tuples'

export const OBLIQUITY_RADIANS = degreesToRadians(23.4)

// Earth's north pole for an idealized "season phase" (0 = June solstice, 90 = September equinox,
// 180 = December solstice, 270 = March equinox), in the staged chapters' frame: the Sun at the
// origin, Earth held on its +X side, world +Y perpendicular to the orbital plane (the staged
// camera's up), and the camera on the -Z side looking in.
//
// This is the orbit chapter's fixed axis (ORBIT_FIXED_POLE_DIRECTION) seen from a frame that turns
// with the Sun-Earth line, so it swings around the perpendicular once a year while keeping the true
// 23.4-degree angle to it at every phase. Where the tilt points changes: toward the Sun (-X) in
// June, away (+X) in December, sideways along the view direction (Z) at the equinoxes. The X part is
// what makes the seasons: asin(dot(pole, sunward = -X)) is the subsolar latitude (the Sun's
// declination), +23.4 in June, -23.4 in December, 0 at the equinoxes.
//
// (An earlier version flattened the pole into the X-Y plane so the equinox axis drew upright; that
// shrank the tilt itself to 0 at the equinoxes - a wrong angle.)
export function seasonalPoleDirection(phaseDegrees: number): Vec3 {
  const phase = degreesToRadians(phaseDegrees)
  return [-Math.sin(OBLIQUITY_RADIANS) * Math.cos(phase), Math.cos(OBLIQUITY_RADIANS), -Math.sin(OBLIQUITY_RADIANS) * Math.sin(phase)]
}

// The fixed direction Earth's axis points in space, in the app's ecliptic convention (world Z =
// ecliptic north). It does not depend on the season - the whole point of the orbit chapter.
export const ORBIT_FIXED_POLE_DIRECTION: Vec3 = [-Math.sin(OBLIQUITY_RADIANS), 0, Math.cos(OBLIQUITY_RADIANS)]

export const ORBIT_FIXED_TILT_MATRIX = axisAlignmentRotation(ORBIT_FIXED_POLE_DIRECTION)

// The latitude where the Sun stands overhead (the Sun's declination): positive while the north
// pole leans toward the Sun. sunwardDirection must be a unit vector.
export function subsolarLatitude(poleDirection: ArrayLike<number>, sunwardDirection: ArrayLike<number>): number {
  const dot = poleDirection[0] * sunwardDirection[0] + poleDirection[1] * sunwardDirection[1] + poleDirection[2] * sunwardDirection[2]
  return Math.asin(clamp(dot, -1, 1))
}
