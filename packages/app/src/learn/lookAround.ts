import type { OrbitViewLimits } from '../camera/orbitCamera'
import type { ContentBounds } from './lessonShot'

// What a lesson's camera shows: compared to tell whether the user has moved it.
export interface ViewState {
  pivot: ArrayLike<number>
  radius: number
  azimuth: number
  elevation: number
}

const SAME_VIEW_TOLERANCE = 1e-6

export function sameView(a: ViewState, b: ViewState): boolean {
  const close = (x: number, y: number, scale = 1) => Math.abs(x - y) <= SAME_VIEW_TOLERANCE * Math.max(scale, 1)
  const pivotClose = [0, 1, 2].every((i) => close(a.pivot[i], b.pivot[i], b.radius))
  return pivotClose && close(a.radius, b.radius, b.radius) && close(a.azimuth, b.azimuth) && close(a.elevation, b.elevation)
}

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

// Remembers the view as framed, and notices once the user has turned, moved or zoomed away from it.
// It stays noticed until the next framing - a new shot, or Reset.
export class ViewWatch {
  private framed: ViewState | null = null
  private left = false

  framedAt(view: ViewState): void {
    this.framed = view
    this.left = false
  }

  // `moving`: the camera is on its own way there (a glide), which does not count.
  hasLeft(view: ViewState, moving: boolean): boolean {
    if (!moving && this.framed) this.left ||= !sameView(view, this.framed)
    return this.left
  }
}
