import type { OrbitViewLimits } from '../camera/orbitCamera'
import type { ContentBounds } from './lessonShot'

// How far the user may turn the view from where the chapter frames it: up to 90 degrees either way.
// A model (LessonShot.freeLook) may be turned all around.
const LOOK_AROUND_RADIANS = Math.PI / 2

export function lookAroundLimits(azimuth: number, elevation: number, freeLook: boolean): OrbitViewLimits | null {
  if (freeLook) return null
  return {
    azimuth: [azimuth - LOOK_AROUND_RADIANS, azimuth + LOOK_AROUND_RADIANS],
    elevation: [elevation - LOOK_AROUND_RADIANS, elevation + LOOK_AROUND_RADIANS],
  }
}

// The pivot may move as far as the scene reaches.
export function panLimitFor(bounds: ContentBounds): number {
  return Math.max(bounds.halfWidth, bounds.top, -bounds.bottom)
}
