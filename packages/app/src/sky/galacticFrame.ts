import { mat3 } from 'gl-matrix'

// The same J2000 obliquity solarSystem/poleOrientation.ts uses for the scene's ecliptic frame.
const OBLIQUITY_RADIANS = (23.4392911 * Math.PI) / 180

// The J2000 equatorial-to-galactic rotation (Hipparcos catalogue, vol. 1, §1.5.3), row by row: the
// galactic x (toward the galactic center), y (toward l = 90°) and z (north galactic pole) axes in
// equatorial coordinates. The sky painting (packages/data-pipeline/src/paintMilkyWay.ts) is laid
// out in galactic coordinates with the same rotation.
const EQUATORIAL_TO_GALACTIC_ROWS = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
]

// Turns a scene-frame (ecliptic) direction into a galactic-frame one: back from the ecliptic to
// the equator, then on to the galactic plane. Column-major, as gl-matrix and WGSL expect.
export function sceneToGalactic(): mat3 {
  const cos = Math.cos(OBLIQUITY_RADIANS)
  const sin = Math.sin(OBLIQUITY_RADIANS)
  // Ecliptic to equatorial: a rotation about the shared x axis (the vernal equinox) by the obliquity.
  const eclipticToEquatorial = mat3.fromValues(1, 0, 0, 0, cos, sin, 0, -sin, cos)
  const [r0, r1, r2] = EQUATORIAL_TO_GALACTIC_ROWS
  const equatorialToGalactic = mat3.fromValues(r0[0], r1[0], r2[0], r0[1], r1[1], r2[1], r0[2], r1[2], r2[2])
  return mat3.multiply(mat3.create(), equatorialToGalactic, eclipticToEquatorial)
}
