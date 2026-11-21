import type { Vec3 } from '../../math/tuples'
import type { LessonShot } from '../lessonShot'
import { TOWARD_SUN } from '../voyager/spacecraftStage'
import type { RoomFacing } from './blueprintRoom'

const UP: Vec3 = [0, 1, 0]

// With +Y up, the orbit camera at azimuth a stands along (cos a, 0, -sin a). It stands on the Sun's
// side, turned a little away so the light falls from the side and models the round body.
const LIGHT_FROM_SIDE = 0.5
export const VEHICLE_AZIMUTH = Math.atan2(-TOWARD_SUN[2], TOWARD_SUN[0]) + LIGHT_FROM_SIDE

// The blueprint room turned to that camera: toward it, and to its right.
export const VEHICLE_ROOM_FACING: RoomFacing = {
  toward: [Math.cos(VEHICLE_AZIMUTH), 0, -Math.sin(VEHICLE_AZIMUTH)],
  right: [-Math.sin(VEHICLE_AZIMUTH), 0, -Math.cos(VEHICLE_AZIMUTH)],
}

// A shot of a vehicle: where the camera looks (on its axis at `height`, or at `target`), how far it
// stands back and what must fit around that point; a little above the horizon unless told
// otherwise, free to be turned all around.
export interface VehicleFrame {
  height: number
  radius: number
  reach: number
  halfWidth: number
  target?: Vec3
  azimuth?: number
  elevation?: number
  zoomFloor?: number
  maxZoomOut?: number
  fov?: number
  panReach?: number
  walk?: { head: Vec3; through?: Vec3[] }
}

export function vehicleShot(key: string, frame: VehicleFrame): LessonShot {
  const { height, radius, reach, halfWidth, target = [0, height, 0], azimuth = VEHICLE_AZIMUTH, elevation = 0.12 } = frame
  return {
    key,
    preset: { target, radius, azimuth, elevation, upAxis: UP },
    bounds: { top: reach, bottom: -reach, halfWidth },
    maxZoomOut: frame.maxZoomOut ?? 2.5,
    zoomFloor: frame.zoomFloor ?? 3,
    freeLook: true,
    fov: frame.fov,
    panReach: frame.panReach,
    walk: frame.walk,
  }
}
