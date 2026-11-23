import { mat4 } from 'gl-matrix'

// Which way the Moon faces: the IAU WGCCRE 2015 model of its pole and prime meridian with the
// librations' periodic terms (Archinal et al. 2018) - the Moon's mean-Earth frame, the frame of its
// maps and of Tranquility Base's coordinates. The same model the data pipeline used to put Eagle
// on the site (packages/data-pipeline/src/apollo/trajectory/moonOrientation.ts), so the two agree.

const DEG = Math.PI / 180
const OBLIQUITY = 23.4392911 * DEG

// The libration arguments E1..E13 (radians), d days from J2000.
function librations(d: number): number[] {
  return [
    [125.045, -0.0529921], [250.089, -0.1059842], [260.008, 13.0120009], [176.625, 13.3407154], [357.529, 0.9856003],
    [311.589, 26.4057084], [134.963, 13.064993], [276.617, 0.3287146], [34.226, 1.7484877], [15.134, -0.1589763],
    [119.743, 0.0036096], [239.961, 0.1643573], [25.053, 12.9590088],
  ].map(([at, rate]) => (at + rate * d) * DEG)
}

// The pole's right ascension and declination and the prime meridian's angle (degrees).
export function moonRotation(julianDay: number): { alpha: number; delta: number; w: number } {
  const d = julianDay - 2451545.0
  const t = d / 36525
  const e = librations(d)
  const s = (k: number) => Math.sin(e[k - 1])
  const c = (k: number) => Math.cos(e[k - 1])
  const alpha = 269.9949 + 0.0031 * t - 3.8787 * s(1) - 0.1204 * s(2) + 0.07 * s(3) - 0.0172 * s(4) + 0.0072 * s(6) - 0.0052 * s(10) + 0.0043 * s(13)
  const delta = 66.5392 + 0.013 * t + 1.5419 * c(1) + 0.0239 * c(2) - 0.0278 * c(3) + 0.0068 * c(4) - 0.0029 * c(6) + 0.0009 * c(7) + 0.0008 * c(10) - 0.0009 * c(13)
  const w =
    38.3213 + 13.17635815 * d - 1.4e-12 * d * d +
    3.561 * s(1) + 0.1208 * s(2) - 0.0642 * s(3) + 0.0158 * s(4) + 0.0252 * s(5) - 0.0066 * s(6) -
    0.0047 * s(7) - 0.0046 * s(8) + 0.0028 * s(9) + 0.0052 * s(10) + 0.004 * s(11) + 0.0019 * s(12) - 0.0044 * s(13)
  return { alpha, delta, w }
}

// The Moon's own frame in ecliptic J2000 (column-major, gl-matrix): its columns are the Moon's x
// (toward 0° E on the equator), y (90° E) and z (north) axes.
export function moonAxes(julianDay: number): mat4 {
  const { alpha, delta, w } = moonRotation(julianDay)
  // Equatorial: Rz(90° + α) Rx(90° - δ) Rz(W) turns the Moon's frame into J2000's (the transpose
  // of J2000 -> Moon); then the obliquity turns equatorial into ecliptic.
  const m = mat4.fromXRotation(mat4.create(), -OBLIQUITY)
  mat4.rotateZ(m, m, (90 + alpha) * DEG)
  mat4.rotateX(m, m, (90 - delta) * DEG)
  mat4.rotateZ(m, m, w * DEG)
  return m
}

// The tilt that puts the Moon's map where it belongs on the sphere the body renderer draws: its
// mesh has longitude 0 on local -Y and 90° E on local +X (bodies/sphereMesh.ts), so local x is the
// Moon's y and local y its -x.
export function moonTilt(julianDay: number): mat4 {
  const local = mat4.fromValues(0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
  return mat4.multiply(mat4.create(), moonAxes(julianDay), local)
}
