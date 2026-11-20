import { msg } from '../../i18n/i18n'
import type { VehicleConfig } from '../vehicle/vehicleConfig'
import { VEHICLE_ROOM_FACING, vehicleShot, type VehicleFrame } from '../vehicle/vehicleCamera'

// The assemblies of Columbia's two models (see the data pipeline's apollo/csmParts.ts and
// apollo/columbiaInterior.ts): the outside, built from its dimensions, and the scanned cabin.
export type ColumbiaPart = 'cm' | 'sm' | 'smInside' | 'sps' | 'rcs' | 'antenna' | 'person' | 'hull' | 'panels' | 'seats' | 'notes'

// The spacecraft stands on its engine's nozzle. Inside (measured on the built cabin: each part's
// centre and the way its surface faces), the main display console hangs at 9.0 m facing down to the
// couches at 8.5 m, the crew's notes are on the wall at z -0.87 m facing in, and the cabin is 1.1
// to 1.3 m in radius between 8.0 and 8.8 m. The camera looks at each from in front of it, within the
// cabin - held still (the cabin doesn't turn), close (a zoom floor of a few centimetres), never
// backed off through the wall (bounds that already fit). With +Y up the camera stands along
// (cos e cos a, sin e, -cos e sin a) from its target.
const INSIDE = { zoomFloor: 0.05, maxZoomOut: 1.2, reach: 0.15, halfWidth: 0.2, height: 0 }
const FRAMES: Record<string, VehicleFrame> = {
  whole: { height: 5.2, radius: 24, reach: 6, halfWidth: 4.5 },
  serviceModule: { height: 4.8, radius: 13, reach: 3.2, halfWidth: 2.6 },
  engine: { height: 2.2, radius: 9, reach: 2.4, halfWidth: 2 },
  commandModule: { height: 8.8, radius: 9, reach: 2, halfWidth: 2.4 },
  // From beside the couches, up at the console (it faces down and toward +Z).
  inside: { ...INSIDE, target: [0.09, 8.98, 0.18], radius: 1.0, elevation: -0.8, azimuth: -1.74 },
  panels: { ...INSIDE, target: [0.09, 8.98, 0.18], radius: 0.6, elevation: -1.1, azimuth: -1.74 },
  // From under the console, down onto the couches.
  seats: { ...INSIDE, target: [0, 8.49, 0.25], radius: 0.8, elevation: 0.9, azimuth: Math.PI / 2 },
  // Square to the wall the notes are on (it faces +Z).
  notes: { ...INSIDE, target: [-0.1, 8.8, -0.87], radius: 0.75, elevation: 0, azimuth: -1.79 },
}

// The cabin's light: its floodlights - two over the couches by the console, a dimmer one down in
// the lower equipment bay - in a warm white, over a low fill (the scan's colours already carry some
// of the museum's light) and a touch of sunlight through the windows.
const CABIN_LIGHT = { sun: 0.12, fill: 0.3 }
const FLOOD = [1.0, 0.9, 0.76] as const
const CABIN_LAMPS = [
  { place: [-0.55, 9.1, 0.45] as [number, number, number], reach: 2.2, color: FLOOD.map((value) => value * 2.2) as [number, number, number] },
  { place: [0.55, 9.1, 0.45] as [number, number, number], reach: 2.2, color: FLOOD.map((value) => value * 2.2) as [number, number, number] },
  { place: [0, 8.15, -0.55] as [number, number, number], reach: 1.6, color: FLOOD.map((value) => value * 1.2) as [number, number, number] },
]

export const COLUMBIA: VehicleConfig = {
  models: [
    { url: 'models/columbia', name: 'csm' },
    { url: 'models/columbia', name: 'cabin', light: CABIN_LIGHT, lamps: CABIN_LAMPS },
  ],
  // One turn every ninety seconds, starting square to the camera; the cabin holds this angle too.
  turntable: { secondsPerTurn: 90, startAngle: 0, stageSeconds: 2.4 },
  room: { facing: VEHICLE_ROOM_FACING, size: { halfWidth: 7, height: 14, minor: 0.5, major: 1 } },
  shot: (id) => vehicleShot(`columbia-${id}`, FRAMES[id] ?? FRAMES.whole),
  partName: (part) => msg.lessons.columbia.parts[part as ColumbiaPart],
  mark: (name) => msg.lessons.columbia.marks[name] ?? { label: name },
}
