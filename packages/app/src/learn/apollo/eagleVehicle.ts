import type { Vec3 } from '../../math/tuples'
import { msg } from '../../i18n/i18n'
import type { VehicleConfig } from '../vehicle/vehicleConfig'
import { eyeLookingAt, VEHICLE_ROOM_FACING, vehicleShot, type VehicleFrame } from '../vehicle/vehicleCamera'

// The assemblies of Eagle's two models (see the data pipeline's apollo/lmParts.ts and
// apollo/lmCockpit.ts): the outside, and the cockpit with its own lamps.
export type EaglePart =
  | 'descent' | 'descentInside' | 'leg0' | 'leg1' | 'leg2' | 'leg3' | 'deployed' | 'ascent' | 'fairings' | 'ascentInside' | 'person'
  | 'cockpit' | 'panels' | 'dsky' | 'windows'

// Eagle stands on its footpads (y 0), +Z forward - the hatch, the ladder - and the Commander's side
// +X. The cabin (lmProfile.ts, lmCockpit.ts): its floor at 3.53 m, its front wall at z 0.95 with the
// panels just behind it (DSKY 4.41-4.63 m, the flight displays 4.75-4.98 m) and the windows above
// them (5.01-5.41 m); the hatch below the DSKY, 0.81 m square from 3.58 m. The crew stood 0.56 m
// either side of the middle, 0.5 m behind the front wall, their eyes about 5.18 m up.
// Coming in, the camera crawls through the hatch - low, as the crew did - and stands up inside.
const FLOOR = 3.526
const HATCH_OUTSIDE: Vec3 = [0, FLOOR + 0.45, 2.15]
const HATCH_INSIDE: Vec3 = [0, FLOOR + 0.45, 0.53]
const STANDING = { head: [0, 1, 0] as Vec3, through: [HATCH_OUTSIDE, HATCH_INSIDE] }
const EYE = FLOOR + 1.65

// A wide lens (75 degrees) for the cramped cabin, and walking through all of it.
const INSIDE = { zoomFloor: 0.05, maxZoomOut: 1.2, reach: 0.15, halfWidth: 0.2, height: 0, fov: (75 * Math.PI) / 180, panReach: 1.2, walk: STANDING }
const FRAMES: Record<string, VehicleFrame> = {
  whole: { height: 3.4, radius: 17, reach: 4.2, halfWidth: 5.2 },
  folded: { height: 4, radius: 13, reach: 3.6, halfWidth: 3.4 },
  stages: { height: 4.6, radius: 19, reach: 5.4, halfWidth: 5 },
  descent: { height: 2.4, radius: 11, reach: 2.4, halfWidth: 3.4 },
  ascent: { height: 4.9, radius: 9.5, reach: 2, halfWidth: 2.8 },
  // Between the two stations, looking forward and a little down at the panels and out of the windows.
  inside: { ...INSIDE, ...eyeLookingAt([0, EYE - 0.05, 0.3], [0, FLOOR + 1.3, 0.92]) },
  // Where the Commander stood, looking at his flight displays.
  panels: { ...INSIDE, ...eyeLookingAt([0.56, EYE, 0.42], [0.36, FLOOR + 1.3, 0.9]) },
  liftoff: { height: 5.2, radius: 19, reach: 5.2, halfWidth: 5 },
}

// Outside, sunlight as on the other vehicles. Inside, the cabin's floodlights: a warm key overhead
// on the Commander's side (casting the shadows), a neutral fill on the LM Pilot's, a cool rim low
// at the back - fixed to the cockpit, so they rise with the ascent stage - over a low fill and a
// touch of sunlight through the windows, the corners left dark, as in Columbia.
const CABIN_LIGHT = { sun: 0.05, fill: 0.16 }
type Rgb = [number, number, number]
const KEY: Rgb = [1.0, 0.8, 0.58]
const FILL: Rgb = [0.95, 0.92, 0.88]
const RIM: Rgb = [0.5, 0.75, 1.0]
const lamp = (place: Rgb, light: { color: Rgb; strength: number; reach: number }) => ({ place, fixedTo: 'cockpit', reach: light.reach, color: light.color.map((value) => value * light.strength) as Rgb })
const CABIN_LAMPS = [
  lamp([0.5, FLOOR + 2.0, 0.25], { color: KEY, strength: 3.2, reach: 2.6 }),
  lamp([-0.5, FLOOR + 1.95, 0.25], { color: FILL, strength: 0.9, reach: 2 }),
  lamp([0, FLOOR + 0.35, -0.02], { color: RIM, strength: 1.4, reach: 1.8 }),
]

// What the cockpit is made of: the panels painted metal with a tight sheen, the walls dull paint,
// the windows glass.
const CABIN_MATERIALS = {
  panels: { shininess: 48, shine: 0.35 },
  dsky: { shininess: 48, shine: 0.35 },
  cockpit: { shininess: 14, shine: 0.1 },
  windows: { shininess: 90, shine: 0.8 },
}

// Outside: the foil shines like metal, the struts and the cabin's paint less.
const OUTSIDE_MATERIALS = {
  descent: { shininess: 40, shine: 0.55 },
  deployed: { shininess: 30, shine: 0.3 },
  leg0: { shininess: 30, shine: 0.35 },
  leg1: { shininess: 30, shine: 0.35 },
  leg2: { shininess: 30, shine: 0.35 },
  leg3: { shininess: 30, shine: 0.35 },
  ascent: { shininess: 20, shine: 0.2 },
  fairings: { shininess: 20, shine: 0.2 },
}

export const EAGLE: VehicleConfig = {
  models: [
    { url: 'models/eagle', name: 'lm', materials: OUTSIDE_MATERIALS },
    { url: 'models/eagle', name: 'cockpit', light: CABIN_LIGHT, lamps: CABIN_LAMPS, materials: CABIN_MATERIALS },
  ],
  // One turn every ninety seconds, starting with its front (the ladder) to the camera's side.
  turntable: { secondsPerTurn: 90, startAngle: 0, stageSeconds: 2.4 },
  room: { facing: VEHICLE_ROOM_FACING, size: { halfWidth: 8, height: 12, minor: 0.5, major: 1 } },
  occlusionReach: 0.25,
  filmLook: { vignette: 0.6, occlusion: 1.0 },
  shot: (id) => vehicleShot(`eagle-${id}`, FRAMES[id] ?? FRAMES.whole),
  partName: (part) => msg.lessons.eagle.parts[part as EaglePart],
  mark: (name) => msg.lessons.eagle.marks[name] ?? { label: name },
}
