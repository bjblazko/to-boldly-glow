export type UnitVector = [number, number, number]

const HOURS_TO_RADIANS = (15 * Math.PI) / 180
const DEGREES_TO_RADIANS = Math.PI / 180

// Earth's obliquity of the ecliptic at J2000 (IAU), the same constant the app's
// solarSystem/poleOrientation.ts uses to turn equatorial directions into its scene frame.
const OBLIQUITY_RADIANS = 23.4392911 * DEGREES_TO_RADIANS

// The J2000 equatorial-to-galactic rotation (Hipparcos catalogue, vol. 1, §1.5.3): its rows are
// the galactic x (toward the galactic center), y (toward l = 90°) and z (north galactic pole)
// axes, written in equatorial coordinates.
const EQUATORIAL_TO_GALACTIC = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
] as const

// A direction on the sky from right ascension (hours) and declination (degrees), in the J2000
// equatorial frame: x toward the vernal equinox, z toward the north celestial pole.
export function equatorialVector(raHours: number, decDegrees: number): UnitVector {
  const ra = raHours * HOURS_TO_RADIANS
  const dec = decDegrees * DEGREES_TO_RADIANS
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
}

// The same direction in the app's scene frame, which is ecliptic: x toward the vernal equinox, y
// in the ecliptic plane, z toward the north ecliptic pole - so the planets, orbiting in the
// x-y plane, pass through the zodiac constellations they really do.
export function equatorialToScene([x, y, z]: UnitVector): UnitVector {
  const cos = Math.cos(OBLIQUITY_RADIANS)
  const sin = Math.sin(OBLIQUITY_RADIANS)
  return [x, y * cos + z * sin, -y * sin + z * cos]
}

export function equatorialToGalactic(direction: UnitVector): UnitVector {
  const [a, b, c] = EQUATORIAL_TO_GALACTIC.map(([m0, m1, m2]) => m0 * direction[0] + m1 * direction[1] + m2 * direction[2])
  return [a, b, c]
}

// Galactic longitude and latitude (degrees) of a galactic-frame direction; longitude in [0, 360).
export function galacticLongitudeLatitude([x, y, z]: UnitVector): { l: number; b: number } {
  const l = (Math.atan2(y, x) / DEGREES_TO_RADIANS + 360) % 360
  return { l, b: Math.asin(Math.max(-1, Math.min(1, z))) / DEGREES_TO_RADIANS }
}

export function galacticVector(lDegrees: number, bDegrees: number): UnitVector {
  const l = lDegrees * DEGREES_TO_RADIANS
  const b = bDegrees * DEGREES_TO_RADIANS
  return [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)]
}
