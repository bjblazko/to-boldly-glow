import { msg } from '../../i18n/i18n'
import type { VehicleConfig } from '../vehicle/vehicleConfig'
import { VEHICLE_AZIMUTH, VEHICLE_ROOM_FACING, vehicleShot, type VehicleFrame } from '../vehicle/vehicleCamera'

// The assemblies of Columbia's two models (see the data pipeline's apollo/csmParts.ts and
// apollo/columbiaInterior.ts): the outside, built from its dimensions, and the scanned cabin.
export type ColumbiaPart = 'cm' | 'sm' | 'smInside' | 'sps' | 'rcs' | 'antenna' | 'person' | 'hull' | 'panels' | 'seats' | 'notes'

// The spacecraft stands on its engine's nozzle; the command module's cabin is 7.6 to 10.1 m up,
// the couches about 8.6 m, the main display console above and in front of them. Inside, the camera
// stands among the couches looking up - held still (the cabin doesn't turn), close (its zoom floor
// a few centimetres), and never backed off out through the wall (bounds that already fit).
const INSIDE = { zoomFloor: 0.05, maxZoomOut: 1.2, reach: 0.15, halfWidth: 0.2 }
const FRAMES: Record<string, VehicleFrame> = {
  whole: { height: 5.2, radius: 24, reach: 6, halfWidth: 4.5 },
  serviceModule: { height: 4.8, radius: 13, reach: 3.2, halfWidth: 2.6 },
  engine: { height: 2.2, radius: 9, reach: 2.4, halfWidth: 2 },
  commandModule: { height: 8.8, radius: 9, reach: 2, halfWidth: 2.4 },
  inside: { ...INSIDE, height: 0, target: [0, 9.0, -0.25], radius: 1.0, elevation: -0.75, azimuth: VEHICLE_AZIMUTH },
  panels: { ...INSIDE, height: 0, target: [0, 9.2, -0.45], radius: 0.7, elevation: -0.9, azimuth: VEHICLE_AZIMUTH },
  seats: { ...INSIDE, height: 0, target: [0, 8.55, 0.15], radius: 0.9, elevation: 0.9, azimuth: VEHICLE_AZIMUTH + Math.PI },
  notes: { ...INSIDE, height: 0, target: [0.06, 8.9, -0.57], radius: 0.8, elevation: 0.2, azimuth: Math.PI / 2 },
}

// The cabin's light comes mostly from its own textures (the scan's colours already carry the light
// in the museum); a little sunlight models the shapes.
const CABIN_LIGHT = { sun: 0.2, fill: 0.95 }

export const COLUMBIA: VehicleConfig = {
  models: [
    { url: 'models/columbia', name: 'csm' },
    { url: 'models/columbia', name: 'cabin', light: CABIN_LIGHT },
  ],
  // One turn every ninety seconds, starting square to the camera; the cabin holds this angle too.
  turntable: { secondsPerTurn: 90, startAngle: 0, stageSeconds: 2.4 },
  room: { facing: VEHICLE_ROOM_FACING, size: { halfWidth: 7, height: 14, minor: 0.5, major: 1 } },
  shot: (id) => vehicleShot(`columbia-${id}`, FRAMES[id] ?? FRAMES.whole),
  partName: (part) => msg.lessons.columbia.parts[part as ColumbiaPart],
  mark: (name) => msg.lessons.columbia.marks[name] ?? { label: name },
}
