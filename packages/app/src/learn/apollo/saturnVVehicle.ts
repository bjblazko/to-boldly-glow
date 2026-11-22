import { msg } from '../../i18n/i18n'
import type { VehicleConfig } from '../vehicle/vehicleConfig'
import { VEHICLE_AZIMUTH, VEHICLE_ROOM_FACING, vehicleShot, type VehicleFrame } from '../vehicle/vehicleCamera'

// The assemblies of the Saturn V model (see the data pipeline's apollo/saturnVParts.ts).
export type SaturnVPart =
  | 'les' | 'cm' | 'sm' | 'sla' | 'lm' | 'iu'
  | 'sivb' | 'sivbInside' | 'sivbEngine'
  | 'sii' | 'siiInside' | 'siiEngines'
  | 'sic' | 'sicInside' | 'sicEngines'
  | 'person'

// Where the camera looks (metres, the rocket standing on the origin, 110.6 m tall; taken apart,
// its top reaches about 157 m), how far it stands back and what must fit around the target.
const FRAMES: Record<string, VehicleFrame> = {
  whole: { height: 55, radius: 175, reach: 58, halfWidth: 22 },
  exploded: { height: 78, radius: 240, reach: 82, halfWidth: 24 },
  sic: { height: 22, radius: 80, reach: 25, halfWidth: 16 },
  sii: { height: 55, radius: 62, reach: 16, halfWidth: 12 },
  sivb: { height: 76, radius: 52, reach: 12, halfWidth: 9 },
  top: { height: 133, radius: 95, reach: 26, halfWidth: 12 },
  capsule: { height: 100.4, radius: 20, reach: 4, halfWidth: 4 },
}

// The lettering's side, as an angle about the rocket's axis (from +X toward +Z): -X/-Z.
const LETTERING_ANGLE = (5 * Math.PI) / 4

export const SATURN_V: VehicleConfig = {
  // More light from all round, and matte paint (its wear is in its texture).
  models: [{ url: 'models/saturnV', name: 'saturnV', light: { sun: 0.9, fill: 0.26 }, materials: { '*': { shininess: 10, shine: 0.06 } } }],
  // One turn every two minutes; it starts with the lettering toward the camera (turning by `angle`
  // moves a side at angle φ to φ - angle, and the camera stands at -azimuth).
  turntable: { secondsPerTurn: 120, startAngle: LETTERING_ANGLE + VEHICLE_AZIMUTH, stageSeconds: 2.6 },
  room: { facing: VEHICLE_ROOM_FACING, size: { halfWidth: 32, height: 120, minor: 5, major: 10 } },
  occlusionReach: 2,
  shot: (id) => vehicleShot(`saturnV-${id}`, FRAMES[id] ?? FRAMES.whole),
  partName: (part) => msg.lessons.saturnV.parts[part as SaturnVPart],
  mark: (name) => msg.lessons.saturnV.marks[name] ?? { label: name },
}
