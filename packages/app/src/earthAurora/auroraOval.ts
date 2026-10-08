import type { Vec3 } from '../math/tuples'

const DEGREES = Math.PI / 180

// Earth's geomagnetic north pole - where the axis of the dipole best fitting its magnetic field
// meets the surface - in 2025 (IGRF-14): 80.8°N, 72.6°W. The south pole lies opposite.
export const GEOMAGNETIC_POLE_LATITUDE_DEGREES = 80.8
export const GEOMAGNETIC_POLE_LONGITUDE_DEGREES = -72.6

// The auroral ovals ring the geomagnetic poles, pushed toward the night side by the solar wind:
// around midnight they lie about 23° from the pole (geomagnetic latitude 67°), around noon only
// about 15°. They widen with magnetic activity, toward the equator.
export const OVAL_COLATITUDE_DEGREES = { midnight: 23, noon: 15 }

// The aurora glows between about 95 and 400 km up: green from oxygen low down, red from oxygen
// higher up, a pinkish fringe from nitrogen at the curtains' lower edge. The shell it is drawn on
// reaches this far out (Earth radii).
export const AURORA_SHELL_RADIUS = 1.065

// A direction on a body from its own frame's latitude and longitude. The sphere mesh's texture
// mapping puts longitude 0 on local -Y and 90°E on +X (see bodies/sphereMesh.ts).
export function bodyFrameDirection(latitudeDegrees: number, longitudeDegrees: number): Vec3 {
  const latitude = latitudeDegrees * DEGREES
  const longitude = longitudeDegrees * DEGREES
  return [Math.sin(longitude) * Math.cos(latitude), -Math.cos(longitude) * Math.cos(latitude), Math.sin(latitude)]
}

export const GEOMAGNETIC_POLE = bodyFrameDirection(GEOMAGNETIC_POLE_LATITUDE_DEGREES, GEOMAGNETIC_POLE_LONGITUDE_DEGREES)

// The oval's distance from the geomagnetic pole (degrees) at a magnetic local time angle (0 at
// midnight, π at noon), for an activity from 0 (quiet) to 1 (a substorm).
export function ovalColatitudeDegrees(localTimeAngle: number, activity: number): number {
  const { midnight, noon } = OVAL_COLATITUDE_DEGREES
  const quiet = (midnight + noon) / 2 + ((midnight - noon) / 2) * Math.cos(localTimeAngle)
  return quiet * (1 + 0.2 * (activity - 0.5))
}

// How active the aurora is (0-1) over time: it brightens and spreads in substorms that build up and
// fade over minutes, on top of a slower swell.
export function auroraActivity(seconds: number): number {
  const swell = 0.25 * Math.sin(seconds / 97)
  const substorms = 0.2 * Math.sin(seconds / 23 + 1.3) * Math.max(0, Math.sin(seconds / 41))
  return Math.min(1, Math.max(0.15, 0.55 + swell + substorms))
}
