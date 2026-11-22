import type { ProfilePoint } from './latheMesh'

// Apollo 11's command and service module (CSM), in metres: heights above the SPS engine's nozzle
// exit, radii from the spacecraft's axis.
//
// Sources (public domain):
// - NR: "Apollo Spacecraft News Reference", North American Rockwell for NASA, 1968 (archive.org
//   item apollo-spacecraft-news-reference-1968): CM 10 ft 7 in tall to the top of the apex cover,
//   12 ft 10 in across, 210 cu ft habitable; SM 24 ft 2 in and 12 ft 10 in, the SPS nozzle
//   "more than 9 feet below the aft bulkhead", the SPS engine 152.82 in long; six sectors of 50,
//   70, 60, 50, 70 and 60 degrees around a centre section 44 in across; oxidizer and fuel sump tanks
//   153.8 in high and 51 in across, storage tanks 154.47 in and 45 in; fuel cells 44 in high and
//   22 in across; oxygen tanks a little over 26 in across; helium tanks about 40 in; RCS quads
//   8 ft long and nearly 3 ft wide, 90 degrees apart; high-gain antenna four 31 in reflectors.
// - APPROX: settled by none of them - the SM's own length (24 ft 2 in less the nozzle's 9 ft), the
//   fairing (NR gives 22 in and 26 in), the heat shield's curve, the cone's angle, the SPS nozzle's
//   exit, the hydrogen tanks (NR's OCR is garbled: about 31 in), where the parts sit in a sector.

const FT = 0.3048
const IN = 0.0254

export const CSM_RADIUS = (12 * FT + 10 * IN) / 2 // NR: 12 ft 10 in, CM and SM alike

export const CSM_HEIGHTS = {
  nozzleExit: 0,
  aftBulkhead: 9 * FT, // NR: more than 9 ft above the nozzle's exit
  engineTop: 152.82 * IN, // NR
  fairingBottom: 24 * FT + 2 * IN - 22 * IN, // NR, the fairing taken as 22 in
  smTop: 24 * FT + 2 * IN, // NR
  cmBase: 24 * FT + 2 * IN - 0.2, // APPROX: the heat shield nests in the fairing
  cmTop: 24 * FT + 2 * IN - 0.2 + 10 * FT + 7 * IN, // NR: 10 ft 7 in to the top of the apex cover
} as const

const HEAT_SHIELD_DEPTH = 0.35 // APPROX
const SHOULDER = 0.12 // APPROX
const APEX_RADIUS = 0.42 // APPROX: the docking tunnel's 30 in hatch with its frame

// The command module from the middle of its heat shield to its apex.
export function commandModuleProfile(): ProfilePoint[] {
  const base = CSM_HEIGHTS.cmBase
  const shield: ProfilePoint[] = [0, 0.35, 0.6, 0.8, 0.92, 1].map((t) => [CSM_RADIUS * t, base + HEAT_SHIELD_DEPTH * t * t])
  return [
    ...shield,
    [CSM_RADIUS, base + HEAT_SHIELD_DEPTH + SHOULDER],
    [APEX_RADIUS + 0.2, CSM_HEIGHTS.cmTop - 0.32],
    [APEX_RADIUS, CSM_HEIGHTS.cmTop - 0.18],
    [APEX_RADIUS - 0.06, CSM_HEIGHTS.cmTop],
    [0, CSM_HEIGHTS.cmTop],
  ]
}

// The cone's side, as the profile above draws it: from the shoulder up to the apex cover.
export const CONE_SIDE = {
  bottom: { height: CSM_HEIGHTS.cmBase + HEAT_SHIELD_DEPTH + SHOULDER, radius: CSM_RADIUS },
  top: { height: CSM_HEIGHTS.cmTop - 0.32, radius: APEX_RADIUS + 0.2 },
}

// The hatch and the windows on the cone: NR gives their sizes - the side hatch about 29 in high
// and 34 in wide with its own window, two side windows about 13 in square, two triangular
// rendezvous windows about 8 by 13 in looking forward. Where they sit is APPROX: the hatch on the
// side toward the camera's first view (+Z), the side windows to its left and right, the rendezvous
// windows above, near the hatch. Angles in radians from +X toward +Z; heights of their middles
// above the heat shield's bottom; width and height in metres along the cone.
export interface ConeOpening {
  angle: number
  height: number
  width: number
  tall: number
  kind: 'hatch' | 'glass'
}

const HATCH_ANGLE = Math.PI / 2
export const CM_OPENINGS: ConeOpening[] = [
  { angle: HATCH_ANGLE, height: 1.3, width: 34 * IN, tall: 29 * IN, kind: 'hatch' },
  { angle: HATCH_ANGLE, height: 1.36, width: 9 * IN, tall: 9 * IN, kind: 'glass' }, // the hatch window
  ...[-1, 1].map((side): ConeOpening => ({ angle: HATCH_ANGLE + side * 1.15, height: 1.25, width: 13 * IN, tall: 13 * IN, kind: 'glass' })),
  ...[-1, 1].map((side): ConeOpening => ({ angle: HATCH_ANGLE + side * 0.42, height: 1.95, width: 8 * IN, tall: 13 * IN, kind: 'glass' })),
]

// The service module, and its forward fairing round the heat shield (APPROX its height): up to
// where the command module's own rim (its short cylinder at the shoulder) begins, so the two meet
// without a gap - and without two surfaces in one place, which flicker.
const FAIRING_TOP = CSM_HEIGHTS.cmBase + HEAT_SHIELD_DEPTH - 0.005
export const SERVICE_MODULE: ProfilePoint[] = [
  [0, CSM_HEIGHTS.aftBulkhead],
  [CSM_RADIUS, CSM_HEIGHTS.aftBulkhead],
  [CSM_RADIUS, CSM_HEIGHTS.smTop],
  [CSM_RADIUS, FAIRING_TOP],
  [CSM_RADIUS - 0.25, FAIRING_TOP],
]

// APPROX: the SPS bell, its exit about 2.5 m across, the chamber and valves above it.
export const SPS_ENGINE: ProfilePoint[] = [[1.25, 0], [1.05, 0.8], [0.75, 1.8], [0.4, 2.6], [0.3, 2.9], [0.45, 3.1], [0.45, 3.6], [0, CSM_HEIGHTS.engineTop]]

// The six sectors around the centre section (NR): their widths in degrees, in order, and what each
// holds. Sector 1 starts on +X and they run toward +Z.
export const SECTOR_DEGREES = [50, 70, 60, 50, 70, 60] as const
export const CENTRE_SECTION_RADIUS = (44 * IN) / 2 // NR

export interface TankShape {
  // Which sector (1 to 6; 0 the centre section), how far out from the axis, how far round within
  // the sector (0 to 1), its bottom height, its height (domes included) and its radius.
  sector: number
  out: number
  around: number
  bottom: number
  height: number
  radius: number
  contents: 'oxidizer' | 'fuel' | 'helium' | 'oxygen' | 'hydrogen' | 'fuelCell'
}

const TANK_BOTTOM = CSM_HEIGHTS.aftBulkhead + 0.1
const MID = (CENTRE_SECTION_RADIUS + CSM_RADIUS) / 2

export const TANKS: TankShape[] = [
  { sector: 2, out: MID, around: 0.5, bottom: TANK_BOTTOM, height: 153.8 * IN, radius: (51 * IN) / 2, contents: 'oxidizer' }, // NR: sump
  { sector: 3, out: MID, around: 0.5, bottom: TANK_BOTTOM, height: 154.47 * IN, radius: (45 * IN) / 2, contents: 'oxidizer' }, // NR: storage
  { sector: 5, out: MID, around: 0.5, bottom: TANK_BOTTOM, height: 153.8 * IN, radius: (51 * IN) / 2, contents: 'fuel' }, // NR: sump
  { sector: 6, out: MID, around: 0.5, bottom: TANK_BOTTOM, height: 154.47 * IN, radius: (45 * IN) / 2, contents: 'fuel' }, // NR: storage
  // NR: two helium tanks about 40 in across in the centre section, above the engine.
  { sector: 0, out: 0, around: 0, bottom: CSM_HEIGHTS.engineTop + 0.05, height: 40 * IN, radius: (40 * IN) / 2, contents: 'helium' },
  { sector: 0, out: 0, around: 0, bottom: CSM_HEIGHTS.engineTop + 0.15 + 40 * IN, height: 40 * IN, radius: (40 * IN) / 2, contents: 'helium' },
  // NR: sector 4 - three fuel cells (44 in by 22 in) above two oxygen and two hydrogen tanks. The
  // 50-degree sector is too narrow for three abreast: one sits inside, two outside (APPROX).
  ...[[1.0, 0.5], [1.55, 0.2], [1.55, 0.8]].map(([out, around]): TankShape => ({ sector: 4, out, around, bottom: CSM_HEIGHTS.smTop - 0.3 - 44 * IN, height: 44 * IN, radius: (22 * IN) / 2, contents: 'fuelCell' })),
  ...[0.95, 1.55].map((out): TankShape => ({ sector: 4, out, around: 0.5, bottom: TANK_BOTTOM + 0.1, height: 26.5 * IN, radius: (26.5 * IN) / 2, contents: 'oxygen' })),
  ...[0.95, 1.55].map((out): TankShape => ({ sector: 4, out, around: 0.5, bottom: TANK_BOTTOM + 0.2 + 26.5 * IN, height: 31.5 * IN, radius: (31.5 * IN) / 2, contents: 'hydrogen' })),
]

// NR: four RCS quads 90 degrees apart, each on a panel of the skin 8 ft long and nearly 3 ft wide
// (painted flush, csmTextures.ts); on it the quad's housing with its nozzles, up and down (APPROX:
// the housing's size, its height on the SM; the two nozzles pointing round the module are left out).
export const RCS_QUAD = { panel: { length: 8 * FT, width: 2.9 * FT }, housing: { tall: 0.7, wide: 0.5, deep: 0.3 }, nozzle: 0.22, middle: CSM_HEIGHTS.aftBulkhead + 3.0, startAngle: Math.PI / 4 }

// The Smithsonian's scan of Columbia's cabin (centimetres): its axis is +Y (the apex up), through
// x 82, z -94; its floor, at y -123, lies this far above the bottom of our heat shield (APPROX).
export const CABIN_SCAN = { centimetre: 0.01, axis: [82, -94] as [number, number], floor: -123, floorAboveBase: 0.4 }

// A person 1.8 m tall standing beside the spacecraft, for scale (as with the Saturn V).
export const PERSON_PLACE: [number, number] = [-(CSM_RADIUS + 2.5), 0]
