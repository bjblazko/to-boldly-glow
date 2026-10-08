import type { Vec3 } from '../../math/tuples'

// A lesson's view from the ground: where the camera stands, which way is up, what it looks toward
// along the horizon, and how far up and down the picture has to reach (altitudes in degrees). The
// lesson camera looks toward the middle of that range, with the horizon level.
export interface GroundShot {
  eye: Vec3
  zenith: Vec3
  // Level, toward what the shot is about.
  toward: Vec3
  altitudes: { top: number; bottom: number }
}

export function lookAltitudeDegrees(shot: GroundShot): number {
  return (shot.altitudes.top + shot.altitudes.bottom) / 2
}

// Along the horizon toward `shot.toward`, raised `degrees` above it.
export function directionAtAltitude(shot: GroundShot, degrees: number): Vec3 {
  const angle = (degrees * Math.PI) / 180
  const [t, z] = [shot.toward, shot.zenith]
  return [t[0] * Math.cos(angle) + z[0] * Math.sin(angle), t[1] * Math.cos(angle) + z[1] * Math.sin(angle), t[2] * Math.cos(angle) + z[2] * Math.sin(angle)]
}
