// Returns the body's axial rotation angle (radians, unbounded — callers only ever feed this into
// mat4.fromZRotation, which is periodic, so it's never wrapped to [0, 2π) here) at `daysSinceEpoch`.
// A positive siderealRotationHours spins counter-clockwise looking down the +Z axis (prograde, the
// same sense as every planet's orbit) BEFORE the body's real axial tilt is applied (see
// poleOrientation.ts) - tilt happens on top of this spin, not instead of it. Negative means
// retrograde (Venus, and Uranus - see BodyDefinition.siderealRotationHours for why this sign
// stays independent of the pole-direction/tilt data rather than being derived from it).
export function rotationAngleRadians(daysSinceEpoch: number, siderealRotationHours: number): number {
  const rotationPeriodDays = siderealRotationHours / 24
  return (daysSinceEpoch / rotationPeriodDays) * 2 * Math.PI
}
