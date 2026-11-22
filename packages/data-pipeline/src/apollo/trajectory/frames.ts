// From where a spacecraft was over the turning Earth to the geocentric frame of Earth's mean
// equator and equinox of J2000: Greenwich sidereal time (IAU 1982) and the IAU 1976 precession.
// Nutation (under 20") is left out.

import type { Vec3 } from './propagate'

const DEG = Math.PI / 180

// Greenwich mean sidereal time, degrees, at a Julian day (UT).
export function gmstDegrees(julianDay: number): number {
  const t = (julianDay - 2451545.0) / 36525
  const theta = 280.46061837 + 360.98564736629 * (julianDay - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000
  return ((theta % 360) + 360) % 360
}

// The precession matrix (row-major) taking J2000 coordinates to the mean equator and equinox of a
// date (TT, taken here as UT: the minute's difference is far below what matters).
export function precessionToDate(julianDay: number): number[] {
  const t = (julianDay - 2451545.0) / 36525
  const arc = (seconds: number) => (seconds / 3600) * DEG
  const zeta = arc(2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3)
  const z = arc(2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3)
  const theta = arc(2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3)
  const [cz, sz, cZ, sZ, ct, st] = [Math.cos(zeta), Math.sin(zeta), Math.cos(z), Math.sin(z), Math.cos(theta), Math.sin(theta)]
  return [
    cz * ct * cZ - sz * sZ, -sz * ct * cZ - cz * sZ, -st * cZ,
    cz * ct * sZ + sz * cZ, -sz * ct * sZ + cz * cZ, -st * sZ,
    cz * st, -sz * st, ct,
  ]
}

// A row-major 3x3 matrix's transpose applied to a vector (the inverse of a rotation).
export function transposeTimes(m: number[], [x, y, z]: Vec3): Vec3 {
  return [m[0] * x + m[3] * y + m[6] * z, m[1] * x + m[4] * y + m[7] * z, m[2] * x + m[5] * y + m[8] * z]
}

export interface LocalState {
  // Geocentric latitude and longitude (degrees, east positive), distance from Earth's centre (km).
  latitude: number
  longitude: number
  radius: number
  // Space-fixed speed (km/s), flight-path angle above the local horizontal and heading east of
  // north (degrees).
  speed: number
  flightPath: number
  heading: number
}

// A state given over the turning Earth, in the frame of the date's mean equator, the Greenwich
// meridian at `gmst` degrees from the equinox.
export function localToInertial({ latitude, longitude, radius, speed, flightPath, heading }: LocalState, gmst: number): { position: Vec3; velocity: Vec3 } {
  const [lat, lon] = [latitude * DEG, (longitude + gmst) * DEG]
  const up: Vec3 = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
  const east: Vec3 = [-Math.sin(lon), Math.cos(lon), 0]
  const north: Vec3 = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)]
  const [g, h] = [flightPath * DEG, heading * DEG]
  const along = (k: number) => speed * (Math.sin(g) * up[k] + Math.cos(g) * (Math.sin(h) * east[k] + Math.cos(h) * north[k]))
  return { position: up.map((value) => value * radius) as Vec3, velocity: [along(0), along(1), along(2)] }
}
