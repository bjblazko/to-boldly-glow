// How a lesson's camera frames a shot: where it stands, what must fit above the lesson panel.

import type { Vec3 } from '../math/tuples'

export interface CameraPreset {
  target: Vec3
  radius: number
  azimuth: number
  elevation: number
  upAxis: Vec3
}

export interface ContentBounds {
  top: number
  bottom: number
  halfWidth: number
}

// A chapter's own shot, for scenes whose chapters each frame something else (the Voyager route):
// the preset, what must fit above the panel, how far the camera may back off to fit it, and the
// closest the user may zoom in (scene units; COMPACT_MIN_ORBIT_RADIUS if not given), and whether it
// may be looked at from all around (freeLook). Moving between
// two chapters with different shots (`key`) flies the camera.
export interface LessonShot {
  key: string
  preset: CameraPreset
  bounds: ContentBounds
  maxZoomOut: number
  zoomFloor?: number
  // A model to look at from all around (the Voyager, its record): no limit on turning, and zooming
  // in as far as the zoom floor allows.
  freeLook?: boolean
}
