import type { ProfilePoint } from './latheMesh'

// Apollo 11's Saturn V (SA-506), in metres: heights above the S-IC's F-1 nozzle exits, radii from
// the vehicle's axis.
//
// Sources (public domain, NASA/MSFC):
// - NR: "Saturn V News Reference", NASA/MSFC, December 1968 revision (archive.org item
//   saturn-v-news-reference): overall height 363 ft; S-IC 138 ft x 33 ft, thrust structure ~20 ft,
//   fuel tank 44 ft, LOX tank "more than 64 ft" with five 42 ft LOX tunnels; S-II 81 ft 7 in
//   x 33 ft with an aft interstage "slightly over 18 ft", aft skirt 7 ft, LOX tank 22 ft,
//   LH2 tank cylinders ~42 ft, forward skirt 11.5 ft, the interstage clearing the J-2s by a little
//   over 8 ft; S-IVB 58 ft 7 in x 21 ft 8 in, common bulkhead a 180 in radius hemisphere;
//   IU 36 in x 260 in; F-1 19 ft long, nozzle exit 11 ft 7 in; J-2 11 ft 1 in long, exit 6 ft 5 in.
// - FM: "Saturn V Flight Manual SA-506" (archive.org item saturn-5-flight-manual-sa-506): the S-IC
//   63.0 ft across its fins; separation planes at vehicle stations 1564 in (S-IC/interstage),
//   1760 in (interstage/S-II) and 2746.5 in (S-II/S-IVB) - so the S-II's interstage is 196 in long
//   and the S-IVB's aft interstage, from the S-II's top (NR's 81 ft 7 in above station 1564),
//   about 203 in.
// - APPROX: settled by neither - the SLA (28 ft, 260 in to 154 in), the CSM (3.91 m across, CM
//   3.23 m tall, SM 4.52 m plus its engine bell), the launch escape system, the S-IVB's tank
//   lengths, the fairings, the folded LM. Chosen from common published figures so the stack adds
//   up to 363 ft.
//
// NR notes that the overall length is not the sum of the stage lengths: tank domes and engines
// nest inside skirts and interstages, as they do here.

const FT = 0.3048

export const TOTAL_HEIGHT = 363 * FT // NR
export const STAGE_RADIUS = (33 * FT) / 2 // NR: S-IC, S-II
const INCH = 0.0254
export const SII_INTERSTAGE = (1760 - 1564) * INCH // FM
export const SIVB_INTERSTAGE = 2746.5 * INCH - (1564 * INCH + 24.87) // FM and NR
export const UPPER_RADIUS = 6.604 / 2 // NR: S-IVB 21 ft 8 in, IU 260 in

// The separation planes and the tops of the parts (NR stage heights stacked; APPROX above the IU).
export const HEIGHTS = {
  sicBase: 3.0, // APPROX: the base heat shield, the F-1 bells below it
  sicTop: 138 * FT, // NR
  siiTop: 138 * FT + 24.87, // NR, the S-II's 81 ft 7 in including its aft interstage
  sivbTop: 138 * FT + 24.87 + 17.86, // NR
  iuTop: 138 * FT + 24.87 + 17.86 + 0.914, // NR
  slaTop: 138 * FT + 24.87 + 17.86 + 0.914 + 28 * FT, // APPROX
  smTop: 138 * FT + 24.87 + 17.86 + 0.914 + 28 * FT + 4.52, // APPROX
  cmTop: 138 * FT + 24.87 + 17.86 + 0.914 + 28 * FT + 4.52 + 3.23, // APPROX
} as const

// The outside of each part, bottom to top.
export const SHELLS: Record<'sic' | 'siiInterstage' | 'sii' | 'sivbInterstage' | 'sivb' | 'iu' | 'sla' | 'sm' | 'cm', ProfilePoint[]> = {
  sic: [[0, HEIGHTS.sicBase], [STAGE_RADIUS, HEIGHTS.sicBase], [STAGE_RADIUS, HEIGHTS.sicTop]],
  siiInterstage: [[STAGE_RADIUS, HEIGHTS.sicTop], [STAGE_RADIUS, HEIGHTS.sicTop + SII_INTERSTAGE]],
  sii: [[STAGE_RADIUS, HEIGHTS.sicTop + SII_INTERSTAGE], [STAGE_RADIUS, HEIGHTS.siiTop]],
  sivbInterstage: [[STAGE_RADIUS, HEIGHTS.siiTop], [UPPER_RADIUS, HEIGHTS.siiTop + SIVB_INTERSTAGE]],
  sivb: [[UPPER_RADIUS, HEIGHTS.siiTop + SIVB_INTERSTAGE], [UPPER_RADIUS, HEIGHTS.sivbTop]],
  iu: [[UPPER_RADIUS, HEIGHTS.sivbTop], [UPPER_RADIUS, HEIGHTS.iuTop]],
  sla: [[UPPER_RADIUS, HEIGHTS.iuTop], [(154 * 0.0254) / 2, HEIGHTS.slaTop]],
  sm: [[0, HEIGHTS.slaTop], [1.955, HEIGHTS.slaTop], [1.955, HEIGHTS.smTop], [1.6, HEIGHTS.smTop + 0.05]],
  cm: [[1.955, HEIGHTS.smTop], [1.955, HEIGHTS.smTop + 0.1], [0.42, HEIGHTS.cmTop - 0.3], [0.42, HEIGHTS.cmTop], [0, HEIGHTS.cmTop]],
}

// A tank: its wall's radius, where its cylinder starts and ends, and how deep its domes reach.
export interface Tank {
  radius: number
  bottom: number
  top: number
  lowerDome: number
  upperDome: number
}

const SIC_DOME = 3.0 // APPROX: makes NR's tank heights (domes included) fit the 138 ft stage
const SII_LOX_BOTTOM = HEIGHTS.sicTop + 5.1

export const TANKS = {
  // NR: fuel tank 44 ft (13.4 m) and LOX tank over 64 ft (19.5 m), domes included; the
  // intertank between them, the forward skirt above.
  sicFuel: { radius: STAGE_RADIUS - 0.08, bottom: 9.1, top: 16.6, lowerDome: SIC_DOME, upperDome: SIC_DOME },
  sicLox: { radius: STAGE_RADIUS - 0.08, bottom: 23.0, top: 36.5, lowerDome: SIC_DOME, upperDome: SIC_DOME },
  // NR: the LOX tank an ellipsoid 22 ft (6.7 m) tall, its upper half the common bulkhead under
  // the LH2 tank's ~42 ft (12.9 m) of cylinder.
  siiLox: { radius: STAGE_RADIUS - 0.08, bottom: SII_LOX_BOTTOM + 3.35, top: SII_LOX_BOTTOM + 3.35, lowerDome: 3.35, upperDome: 3.35 },
  siiLh2: { radius: STAGE_RADIUS - 0.08, bottom: SII_LOX_BOTTOM + 3.35, top: SII_LOX_BOTTOM + 3.35 + 12.9, lowerDome: -3.35, upperDome: 2.6 },
  // APPROX: NR gives only the volumes (LOX 2,828 ft³, LH2 10,446 ft³) and the common bulkhead.
  sivbLox: { radius: UPPER_RADIUS - 0.06, bottom: HEIGHTS.siiTop + 7.3, top: HEIGHTS.siiTop + 7.3, lowerDome: 2.2, upperDome: 2.2 },
  sivbLh2: { radius: UPPER_RADIUS - 0.06, bottom: HEIGHTS.siiTop + 7.3, top: HEIGHTS.sivbTop - 1.9, lowerDome: -2.2, upperDome: 1.8 },
} satisfies Record<string, Tank>

// A rocket engine from its nozzle exit up (radius, height above the exit).
export const F1_ENGINE: ProfilePoint[] = [
  [(11 * FT + 7 * 0.0254) / 2, 0], // NR: nozzle exit 11 ft 7 in
  [1.62, 0.7], [1.3, 1.7], [0.95, 2.6], [0.62, 3.4], [0.5, 3.9], [0.62, 4.3], [0.62, 5.0], [0.4, 5.5],
  [0, 19 * FT], // NR: 19 ft long
]

export const J2_ENGINE: ProfilePoint[] = [
  [(6 * FT + 5 * 0.0254) / 2, 0], // NR: nozzle exit 6 ft 5 in
  [0.82, 0.6], [0.6, 1.3], [0.38, 1.95], [0.24, 2.3], [0.34, 2.6], [0.34, 3.0], [0.2, 3.2],
  [0, 11 * FT + 1 * 0.0254], // NR: 11 ft 1 in long
]

// APPROX: the service module's engine (SPS) bell, about 2.9 m long and 2.5 m across.
export const SPS_ENGINE: ProfilePoint[] = [[1.25, 0], [1.0, 0.9], [0.65, 1.9], [0.3, 2.6], [0, 2.9]]

// The engines' places (x, z) and the heights of their nozzle exits. The S-IC's and S-II's outer
// four sit on the ±X and ±Z axes, under the fins, so a cut through the quarter between +X and +Z
// shows the inside without slicing an engine or a fin.
const OUTER = (radius: number): [number, number][] => [[radius, 0], [0, radius], [-radius, 0], [0, -radius]]

export const ENGINES = {
  sic: { profile: F1_ENGINE, exit: 0, places: [[0, 0], ...OUTER(3.6)] as [number, number][] },
  sii: { profile: J2_ENGINE, exit: HEIGHTS.sicTop + 1.0, places: [[0, 0], ...OUTER(2.7)] as [number, number][] },
  sivb: { profile: J2_ENGINE, exit: HEIGHTS.siiTop + 1.5, places: [[0, 0]] as [number, number][] },
  sps: { profile: SPS_ENGINE, exit: HEIGHTS.slaTop - 2.9, places: [[0, 0]] as [number, number][] },
}

// The four fins at the S-IC's base, 63 ft across their tips (FM; their shape APPROX): root and tip
// edges (bottom, top heights) on the ±X and ±Z axes.
export const FIN = { rootRadius: STAGE_RADIUS, tipRadius: (63 * FT) / 2, root: [HEIGHTS.sicBase, 9.0], tip: [1.0, 3.2] } as const

// APPROX: the conical fairings over the four outer F-1s, from the base down around each engine.
export const FAIRING: ProfilePoint[] = [[1.95, 0.6], [2.25, HEIGHTS.sicBase + 0.2], [1.6, HEIGHTS.sicBase + 4.0]]

// APPROX: the launch escape system on top of the command module: the boost protective cover over
// the capsule, a truss tower, the escape motor, the pitch-control motor and canards, the nose.
const LES_BASE = HEIGHTS.cmTop
export const LES = {
  cover: [[2.0, HEIGHTS.smTop], [2.0, HEIGHTS.smTop + 0.15], [0.5, HEIGHTS.cmTop - 0.2], [0.5, HEIGHTS.cmTop + 0.1], [0, HEIGHTS.cmTop + 0.1]] as ProfilePoint[],
  tower: { bottom: LES_BASE, top: LES_BASE + 2.4, bottomHalfWidth: 0.6, topHalfWidth: 0.33 },
  motor: [[0, LES_BASE + 2.2], [0.42, LES_BASE + 2.2], [0.33, LES_BASE + 2.6], [0.33, LES_BASE + 6.9], [0.25, LES_BASE + 7.8], [0.2, LES_BASE + 8.3], [0.04, TOTAL_HEIGHT - 0.15], [0, TOTAL_HEIGHT]] as ProfilePoint[],
}

// APPROX: the lunar module folded inside the SLA - its descent stage an octagon, the ascent stage
// above it.
export const LM = {
  descent: { radius: 2.15, bottom: HEIGHTS.iuTop + 0.5, top: HEIGHTS.iuTop + 2.2 },
  ascent: { radius: 1.45, bottom: HEIGHTS.iuTop + 2.2, top: HEIGHTS.iuTop + 5.0 },
}

// A person 1.8 m tall standing beside the base, for scale.
export const PERSON = {
  place: [-(STAGE_RADIUS + 9), 0] as [number, number],
  profile: [[0, 0], [0.16, 0], [0.18, 0.85], [0.21, 1.45], [0.08, 1.52], [0.11, 1.62], [0.1, 1.78], [0, 1.8]] as ProfilePoint[],
}
