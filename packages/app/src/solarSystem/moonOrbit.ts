import { AU_TO_SCENE_UNITS } from './sceneScale'

// blend: 0 = fully realistic (the same true-AU-consistent scale used everywhere else), 1 = fully
// explorer (a hand-picked explorerOrbitVisualRadius, in the same spirit as each body's own
// explorerVisualRadius). Unlike scaledDistanceUnits, this has no log1p compression — moon-to-parent
// distance ratios are far more uniform across this body set than the 0.39-30 AU spread between
// planets, so a simple linear blend already looks reasonable without needing to compress outliers.
export function scaledMoonOrbitRadiusUnits(
  orbitDistanceKm: number,
  explorerOrbitVisualRadius: number,
  blend: number,
  auKm: number,
): number {
  const realistic = (orbitDistanceKm / auKm) * AU_TO_SCENE_UNITS
  return realistic + (explorerOrbitVisualRadius - realistic) * blend
}

// Angle around a circular orbit in the parent's local XZ plane (no inclination modeled —
// consistent with the rest of the renderer not modeling axial tilt either). Driven by real
// elapsed time, so a negative period (Triton, uniquely among large moons, orbits retrograde)
// naturally produces motion in the opposite direction.
export function moonOrbitAngleRadians(daysSinceEpoch: number, siderealOrbitPeriodDays: number): number {
  return (daysSinceEpoch / siderealOrbitPeriodDays) * 2 * Math.PI
}

// Tidally locked moons keep one face toward their parent as they orbit. Given how
// moonRelativePosition and the Y-axis rotation matrix compose, that requires spinning at the
// NEGATIVE of the orbital angle, not the same sign - using the same sign leaves the near-side
// direction rotating the wrong way relative to the parent-facing direction, drifting by 2 full
// extra turns per orbit instead of staying locked (verified in moonOrbit.test.ts).
export function moonRotationAngleRadians(orbitAngleRadians: number): number {
  return -orbitAngleRadians
}

// Position relative to the parent's center, at the given orbit radius and angle.
export function moonRelativePosition(orbitRadius: number, angleRadians: number): [number, number, number] {
  return [orbitRadius * Math.cos(angleRadians), 0, orbitRadius * Math.sin(angleRadians)]
}
