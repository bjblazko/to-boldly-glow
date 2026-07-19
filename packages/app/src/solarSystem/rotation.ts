// Returns the body's axial rotation angle (radians, unbounded — callers only ever feed this into
// mat4.fromYRotation, which is periodic, so it's never wrapped to [0, 2π) here) at `daysSinceEpoch`.
// A positive siderealRotationHours spins counter-clockwise looking down the +Y axis (prograde, the
// same sense as every planet's orbit); negative is retrograde (Venus, and Uranus due to its
// extreme axial tilt) — see BodyDefinition.siderealRotationHours.
export function rotationAngleRadians(daysSinceEpoch: number, siderealRotationHours: number): number {
  const rotationPeriodDays = siderealRotationHours / 24
  return (daysSinceEpoch / rotationPeriodDays) * 2 * Math.PI
}
