// "Realistic" endpoint: 1 AU = this many scene units. This is the constant the renderer-core plan
// introduced for Earth alone; kept as the single definition now that more bodies share it.
export const AU_TO_SCENE_UNITS = 20

// "Explorer" endpoint: distances compressed with log1p so all 8 planets (0.39 AU to ~30 AU) fit
// within a comfortable, explorable camera range instead of crowding the inner planets into a few
// pixels or pushing Neptune off the edge of the world. log1p (not log) keeps Mercury away from
// the origin (log1p(0.39) > 0, whereas log(0.39) < 0 would put it "behind" the Sun along this
// axis, which does not correspond to anything physical).
const EXPLORER_DISTANCE_SCALE = 60

export function explorerDistanceUnits(distanceAu: number): number {
  return EXPLORER_DISTANCE_SCALE * Math.log1p(distanceAu)
}

// blend: 0 = fully realistic, 1 = fully explorer, values between interpolate linearly.
export function scaledDistanceUnits(distanceAu: number, blend: number): number {
  const realistic = distanceAu * AU_TO_SCENE_UNITS
  const explorer = explorerDistanceUnits(distanceAu)
  return realistic + (explorer - realistic) * blend
}

export function scaledBodyRadiusUnits(
  radiusKm: number,
  explorerVisualRadius: number,
  blend: number,
  auKm: number,
): number {
  const realistic = (radiusKm / auKm) * AU_TO_SCENE_UNITS
  return realistic + (explorerVisualRadius - realistic) * blend
}

// Rescales an already-computed AU-space position (x, y, z with x²+y²+z² = distanceAu²) to scene
// units for the given blend, preserving direction. Since sphericalToX/Y/Z are all linear in their
// radius argument, a single scalar factor (targetDistance / distanceAu) applied to each axis
// rescales distance while preserving direction exactly.
//
// Returns [0, 0, 0] unscaled for a body at the origin (the Sun): there is no direction to
// preserve, and the factor would divide by zero.
export function scaledPosition(
  x: number,
  y: number,
  z: number,
  distanceAu: number,
  blend: number,
): [number, number, number] {
  if (distanceAu === 0) return [0, 0, 0]
  const factor = scaledDistanceUnits(distanceAu, blend) / distanceAu
  return [x * factor, y * factor, z * factor]
}
