import type { LessonShot } from '../lessonShot'
import { TOWARD_SUN } from '../voyager/spacecraftStage'
import type { SaturnVShotId } from './saturnVStage'

const UP: [number, number, number] = [0, 1, 0]

// With +Y up, the orbit camera at azimuth a stands along (cos a, 0, -sin a). It stands on the Sun's
// side, turned a little away so the light falls from the side and models the round body.
const LIGHT_FROM_SIDE = 0.5
export const SATURN_V_AZIMUTH = Math.atan2(-TOWARD_SUN[2], TOWARD_SUN[0]) + LIGHT_FROM_SIDE

// The room around the rocket, turned to that camera: toward it, and to its right.
export const SATURN_V_ROOM = {
  toward: [Math.cos(SATURN_V_AZIMUTH), 0, -Math.sin(SATURN_V_AZIMUTH)] as [number, number, number],
  right: [-Math.sin(SATURN_V_AZIMUTH), 0, -Math.cos(SATURN_V_AZIMUTH)] as [number, number, number],
}

// Where the camera looks (metres, the rocket standing on the origin, 110.6 m tall; taken apart,
// its top reaches about 157 m), how far it stands back and what must fit around the target.
const FRAMES: Record<SaturnVShotId, { height: number; radius: number; reach: number; halfWidth: number }> = {
  whole: { height: 55, radius: 175, reach: 58, halfWidth: 22 },
  exploded: { height: 78, radius: 240, reach: 82, halfWidth: 24 },
  sic: { height: 22, radius: 80, reach: 25, halfWidth: 16 },
  sii: { height: 55, radius: 62, reach: 16, halfWidth: 12 },
  sivb: { height: 76, radius: 52, reach: 12, halfWidth: 9 },
  top: { height: 133, radius: 95, reach: 26, halfWidth: 12 },
  capsule: { height: 100.4, radius: 20, reach: 4, halfWidth: 4 },
}

// A chapter's camera: a little above the horizon, free to be turned all around the rocket.
export function saturnVShot(id: SaturnVShotId): LessonShot {
  const { height, radius, reach, halfWidth } = FRAMES[id]
  return {
    key: `saturnV-${id}`,
    preset: { target: [0, height, 0], radius, azimuth: SATURN_V_AZIMUTH, elevation: 0.12, upAxis: UP },
    bounds: { top: reach, bottom: -reach, halfWidth },
    maxZoomOut: 2.5,
    zoomFloor: 3,
    freeLook: true,
  }
}
