import type { Vec3 } from './propagate'

// Which way the Moon faces: the IAU Working Group on Cartographic Coordinates and Rotational
// Elements' model of its north pole (right ascension and declination in the ICRF, which is our
// J2000 frame to well under what matters here) and its prime meridian, with the periodic terms of
// its librations (Archinal et al. 2018, "Report of the IAU WGCCRE: 2015"). It gives the Moon's
// mean-Earth frame; the gravity field is given in its principal-axis frame, which differs from it
// by about 0.02 degrees (DE421) - under a kilometre on the surface, and left out (APPROX).

const DEG = Math.PI / 180

// The libration arguments E1..E13 (degrees), d days from J2000 (TDB, taken as UT: a minute's
// difference turns the Moon by 0.01 degrees).
function arguments_(d: number): number[] {
  return [
    125.045 - 0.0529921 * d,
    250.089 - 0.1059842 * d,
    260.008 + 13.0120009 * d,
    176.625 + 13.3407154 * d,
    357.529 + 0.9856003 * d,
    311.589 + 26.4057084 * d,
    134.963 + 13.064993 * d,
    276.617 + 0.3287146 * d,
    34.226 + 1.7484877 * d,
    15.134 - 0.1589763 * d,
    119.743 + 0.0036096 * d,
    239.961 + 0.1643573 * d,
    25.053 + 12.9590088 * d,
  ].map((degrees) => degrees * DEG)
}

// The pole's right ascension and declination and the prime meridian's angle (degrees).
export function moonRotation(julianDay: number): { alpha: number; delta: number; w: number } {
  const d = julianDay - 2451545.0
  const t = d / 36525
  const e = arguments_(d)
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

// The rotation (row-major) from the J2000 frame to the Moon's own: Rz(W) Rx(90° - δ) Rz(90° + α).
export function moonFrame(julianDay: number): number[] {
  const { alpha, delta, w } = moonRotation(julianDay)
  const rz = (angle: number) => [Math.cos(angle), Math.sin(angle), 0, -Math.sin(angle), Math.cos(angle), 0, 0, 0, 1]
  const rx = (angle: number) => [1, 0, 0, 0, Math.cos(angle), Math.sin(angle), 0, -Math.sin(angle), Math.cos(angle)]
  return multiply(rz(w * DEG), multiply(rx((90 - delta) * DEG), rz((90 + alpha) * DEG)))
}

function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(9)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]
  return out
}

export function rotate(m: number[], [x, y, z]: Vec3): Vec3 {
  return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z]
}

// Its transpose applied: from the Moon's frame back to J2000.
export function rotateBack(m: number[], [x, y, z]: Vec3): Vec3 {
  return [m[0] * x + m[3] * y + m[6] * z, m[1] * x + m[4] * y + m[7] * z, m[2] * x + m[5] * y + m[8] * z]
}

// A J2000 vector in the Moon's frame at a Julian day.
export function moonBodyFixed(julianDay: number, vector: Vec3): Vec3 {
  return rotate(moonFrame(julianDay), vector)
}
