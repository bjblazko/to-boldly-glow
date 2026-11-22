import type { Vec3 } from '../../math/tuples'
import { msg } from '../../i18n/i18n'
import type { VehicleConfig } from '../vehicle/vehicleConfig'
import { eyeLookingAt, VEHICLE_ROOM_FACING, vehicleShot, type VehicleFrame } from '../vehicle/vehicleCamera'

// The assemblies of Columbia's two models (see the data pipeline's apollo/csmParts.ts and
// apollo/columbiaInterior.ts, apollo/csmNassp.ts): the outside, built from its dimensions; the cabin
// as it flew, Project Apollo - NASSP's cockpit (vc...); the cabin as it is today, the scan.
export type ColumbiaPart =
  | 'cm' | 'sm' | 'smInside' | 'sps' | 'rcs' | 'antenna' | 'person'
  | 'hull' | 'panels' | 'seats' | 'notes'
  | 'vcCabin' | 'vcPanels' | 'vcHatches' | 'vcCouches'

// The spacecraft stands on its engine's nozzle. Inside (measured on the built cabin: each part's
// centre and the way its surface faces), the main display console hangs at 9.0 m facing down to the
// couches at 8.5 m, the crew's notes are on the wall at z -0.87 m facing in, and the cabin is 1.1
// to 1.3 m in radius between 8.0 and 8.8 m. The camera looks at each from in front of it, within the
// cabin - held still (the cabin doesn't turn), close (a zoom floor of a few centimetres), never
// backed off through the wall (bounds that already fit). With +Y up the camera stands along
// (cos e cos a, sin e, -cos e sin a) from its target.
// The crew lay on their backs facing the main display console (toward the apex, +Y), heads toward
// the side hatch (+Z), legs raised toward the console - as the couches in the scan show (their
// raised foot ends lie toward -Z). Inside, the view is turned that way: one enters lying, as they did.
// Coming in from outside, the camera flies up to the side hatch (its middle 1.3 m above the heat
// shield's bottom on the cone at +Z, see the pipeline's csmProfile.ts: about (0, 8.47, 1.50), the
// cone's outward normal there (0, 0.48, 0.88)), through it, and turns to lie.
const HATCH_OUTSIDE: Vec3 = [0, 8.95, 2.38]
const HATCH_INSIDE: Vec3 = [0, 8.3, 1.19]
const CREW_LYING = { head: [0, 0, 1] as Vec3, through: [HATCH_OUTSIDE, HATCH_INSIDE] }

// A wide lens (75 degrees) for the cramped cabin, and walking through the whole of it.
const INSIDE = { zoomFloor: 0.05, maxZoomOut: 1.2, reach: 0.15, halfWidth: 0.2, height: 0, fov: (75 * Math.PI) / 180, panReach: 1.2, walk: CREW_LYING }
const FRAMES: Record<string, VehicleFrame> = {
  whole: { height: 5.2, radius: 24, reach: 6, halfWidth: 4.5 },
  serviceModule: { height: 4.8, radius: 13, reach: 3.2, halfWidth: 2.6 },
  engine: { height: 2.2, radius: 9, reach: 2.4, halfWidth: 2 },
  commandModule: { height: 8.8, radius: 9, reach: 2, halfWidth: 2.4 },
  // NASSP's cockpit (measured on the built one): the couches 7.8-8.6 m up, their heads toward the
  // side hatch (z 1.0); the main display console over them, its flight director attitude indicators
  // about 8.8 m up at z 0.6-0.8, the Commander's on the left (-X); the lower equipment bay with the
  // optics at their feet (z -0.5).
  // Over the middle couch by the hatch, looking across to the console and the equipment bay.
  inside: { ...INSIDE, ...eyeLookingAt([0, 8.62, 1.0], [-0.1, 8.72, 0.1]) },
  // Where the Commander lay, looking up at his displays.
  panels: { ...INSIDE, ...eyeLookingAt([-0.5, 8.5, 0.95], [-0.5, 8.82, 0.62]) },
  // Up in the middle under the forward hatch (27 cm clear all round), looking down at the couches.
  seats: { ...INSIDE, ...eyeLookingAt([0, 9.0, 0.0], [0, 8.3, 0.45]) },
  // The scan (the cabin today). Eye points found on the built cabin: the most room round them (27 cm
  // or more) above the couches, with a clear line of sight to what they look at.
  today: { ...INSIDE, target: [0.09, 8.98, 0.18], radius: 0.64, elevation: -0.36, azimuth: -0.56 },
  // Close before the wall of the lower equipment bay (the notes are spread over it, 2 m across; this
  // looks at their middle, 0.6 m off), sitting up - the console overhead - through a longer lens.
  notes: { ...INSIDE, ...eyeLookingAt([0, 8.9, -0.45], [-0.29, 8.85, -0.95]), fov: (50 * Math.PI) / 180, walk: { ...CREW_LYING, head: [0, 1, 0] } },
  // Where the command module pilot lay: the middle couch, the head 28 cm above its back (the
  // couch's back at y 8.4), looking up at the main display console (at y 9.0-9.2 over the couches).
  centerCouch: { ...INSIDE, ...eyeLookingAt([0, 8.68, 0.72], [0, 9.2, 0.45]) },
}

// The cabin's light: its floodlights - two on the underside of the main display console over the
// couches, a dimmer one on the wall of the lower equipment bay (each 3 cm off a surface found on
// the built cabin) - in a warm white, over a low fill (the scan's colours already carry some of the
// museum's light) and a touch of sunlight through the windows. They are fixed to the panels and the
// wall, so they rise with the command module when it lifts off its service module.
//
// Lit like a film set: a strong, warm key (the left console light, the one casting shadows), the
// right one as a soft neutral fill, the equipment bay's light as a cool rim from below, and little
// light besides - the cabin's corners left dark.
const CABIN_LIGHT = { sun: 0.05, fill: 0.18 }
type Rgb = [number, number, number]
const KEY: Rgb = [1.0, 0.8, 0.58]
const FILL: Rgb = [0.95, 0.92, 0.88]
const RIM: Rgb = [0.5, 0.75, 1.0]
const lamp = (place: Rgb, fixedTo: string, light: { color: Rgb; strength: number; reach: number }) => ({ place, fixedTo, reach: light.reach, color: light.color.map((value) => value * light.strength) as Rgb })
const CABIN_LAMPS = [
  lamp([-0.544, 9.015, 0.284], 'panels', { color: KEY, strength: 3.6, reach: 2.4 }),
  lamp([0.547, 9.007, 0.277], 'panels', { color: FILL, strength: 0.9, reach: 1.8 }),
  lamp([0.012, 8.335, -0.927], 'hull', { color: RIM, strength: 1.8, reach: 1.8 }),
]
// NASSP's cockpit, lit like a film set: almost no fill, so the floodlights' key and its shadows
// carry the picture and the corners stay dark.
const COCKPIT_LIGHT = { sun: 0.03, fill: 0.04 }
// The console's two floodlights under it, the equipment bay's.
const COCKPIT_LAMPS = [
  lamp([-0.5, 8.68, 0.42], 'vcPanels', { color: KEY, strength: 4.6, reach: 2.6 }),
  lamp([0.5, 8.68, 0.42], 'vcPanels', { color: FILL, strength: 0.5, reach: 1.6 }),
  lamp([0, 8.45, -0.6], 'vcCabin', { color: RIM, strength: 1.4, reach: 1.6 }),
]
const COCKPIT_MATERIALS = {
  vcPanels: { shininess: 48, shine: 0.3 },
  vcCabin: { shininess: 16, shine: 0.12 },
  vcHatches: { shininess: 16, shine: 0.12 },
  vcCouches: { shininess: 4, shine: 0.03 },
}

// What the cabin is made of: the panels painted metal with a tight sheen, the walls dull paint, the
// couches' fabric and straps hardly shining, the notes on paper and tape.
const CABIN_MATERIALS = {
  panels: { shininess: 48, shine: 0.35 },
  hull: { shininess: 14, shine: 0.1 },
  seats: { shininess: 4, shine: 0.03 },
  notes: { shininess: 10, shine: 0.06 },
}

const CSM_MATERIALS = {
  '*': { shininess: 10, shine: 0.06 },
  cm: { shininess: 120, shine: 0.95, mirror: true },
  sm: { shininess: 60, shine: 0.5, mirror: true },
  sps: { shininess: 20, shine: 0.15 },
}

export const COLUMBIA: VehicleConfig = {
  models: [
    // Outside: more light from all round; the command module's aluminized skin a mirror, the
    // service module's bare aluminium (its paint and wear in its texture) with a dull sheen.
    { url: 'models/columbia', name: 'csm', light: { sun: 0.9, fill: 0.26 }, materials: CSM_MATERIALS },
    { url: 'models/columbia', name: 'cabin', light: CABIN_LIGHT, lamps: CABIN_LAMPS, materials: CABIN_MATERIALS },
    { url: 'models/columbia', name: 'cockpit', light: COCKPIT_LIGHT, lamps: COCKPIT_LAMPS, materials: COCKPIT_MATERIALS },
  ],
  // One turn every ninety seconds, starting square to the camera; the cabin holds this angle too.
  turntable: { secondsPerTurn: 90, startAngle: 0, stageSeconds: 2.4 },
  room: { facing: VEHICLE_ROOM_FACING, size: { halfWidth: 7, height: 14, minor: 0.5, major: 1 } },
  occlusionReach: 0.15,
  // Darker corners and deeper creases than the Saturn V's room: the cabin's drama.
  filmLook: { vignette: 0.7, occlusion: 1.25 },
  shot: (id) => vehicleShot(`columbia-${id}`, FRAMES[id] ?? FRAMES.whole),
  partName: (part) => msg.lessons.columbia.parts[part as ColumbiaPart],
  mark: (name) => msg.lessons.columbia.marks[name] ?? { label: name },
}
