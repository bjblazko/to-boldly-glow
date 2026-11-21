import type { Hinge } from '../../../app/src/spacecraft/modelHinge'
import type { ProfilePoint } from './latheMesh'

// Apollo 11's lunar module Eagle (LM-5), in metres: heights above the footpads' soles with the legs
// out, +Y up, +Z forward (the front hatch, the ladder leg). Facing forward from inside, +X is on
// the left: the Commander's side.
//
// Sources (public domain):
// - NR: "Apollo Lunar Module News Reference", Grumman for NASA, 1968 (archive.org item
//   apollo-lunar-module-news-reference-1968), read 2026-11-21: 22 ft 11 in tall (legs extended),
//   31 ft diagonally across the extended gear; ascent stage 12 ft 4 in high, 14 ft 1 in wide;
//   descent stage 10 ft 7 in high, 14 ft 1 in wide; cabin 235 cu ft. Descent structure: two pairs of
//   parallel beams in a cross, decks about 65 in apart, the beams' ends about 81 in from the centre,
//   struts between them giving the octagon; an outrigger at each end carries the primary strut's
//   upper end. Footpads 37 in across; probes reaching about 5 ft below them; a ladder of nine rungs
//   9 in apart, rails 20 in apart, from 18 in below the platform to 30 in above the footpad. Crew
//   compartment cylindrical, 92 in across and 42 in deep, flight stations 44 in apart; midsection
//   54 in deep, about 5 ft high, elliptical (minor axis about 56 in), an 18 in step up. Forward
//   hatch about 32 in square below the panels; overhead hatch about 33 in across. Two triangular
//   windows of about 2 sq ft, canted down; a docking window above the Commander. DPS 9,870 lb
//   thrust, throttled down to 1,050 lb (10 %), 85 in long, nozzle exit 59 in; four
//   cylindrical, spherical-ended descent tanks. APS 3,500 lb, 47 in long, exit 31 in; two
//   spherical ascent tanks. S-band steerable antenna 26 in across.
// - Apollo 11: photographs of Eagle on the Moon show no probe on the ladder leg (it was left off
//   so the crew would not trip over it).
// - APPROX: settled by none of them - the ascent stage's facets, the tank sizes, the outriggers'
//   reach and height, the nozzle's height, the fold angle, the rendezvous radar's size, the RCS
//   quads' size.

const FT = 0.3048
const IN = 0.0254

type Vec3 = [number, number, number]

export const LM_HEIGHTS = {
  footpads: 0,
  // NR: the descent stage's 10 ft 7 in reach from the footpads to the ascent stage, which adds
  // its 12 ft 4 in - together the 22 ft 11 in overall.
  interstage: 10 * FT + 7 * IN,
  ascentTop: 22 * FT + 11 * IN,
  overall: 22 * FT + 11 * IN,
  descentBottom: 10 * FT + 7 * IN - 65 * IN - 0.12, // NR: decks 65 in apart; APPROX: the heat shield below
  descentDeck: 10 * FT + 7 * IN - 0.06, // APPROX: the top deck just under the interstage fittings
}

export const DESCENT_STAGE = {
  width: 14 * FT + 1 * IN, // NR, across the octagon's corners (the outriggers)
  beamEnd: 81 * IN, // NR: the beams' ends from the centre (the octagon's flat faces)
  beamHalfWidth: 0.85, // APPROX: half the width of each pair of beams (a compartment's side)
}

// Front (+Z) is where the crew compartment is; the midsection lies behind it.
export const ASCENT_STAGE = {
  width: 14 * FT + 1 * IN, // NR, with the RCS quads
  cabinRadius: (92 * IN) / 2, // NR: the crew compartment's cylinder
  cabinDepth: 42 * IN, // NR
  cabinFront: 0.95, // APPROX: the front face, ahead of the stage's centre
  midsectionDepth: 54 * IN, // NR
  midsectionHalfWidth: (56 * IN) / 2, // NR: the ellipse's minor axis
  midsectionHeight: 5 * FT, // NR
  floor: 10 * FT + 7 * IN + 0.3, // APPROX: the cabin floor above the interstage
  stepUp: 18 * IN, // NR: the step up into the midsection
  stationsApart: 44 * IN, // NR: the flight stations' centrelines
}

export const FOOTPAD = { radius: (37 * IN) / 2, height: 0.25 } // NR: 37 in; APPROX: its depth
export const PROBE_LENGTH = 5 * FT // NR: "approximately 5 feet below the footpad"

// The outriggers' outer ends, where the primary struts hang (APPROX: just beyond the octagon's
// corner, near the top deck).
const OUTRIGGER = { reach: 2.35, height: LM_HEIGHTS.interstage - 0.25 }
// Footpad centres: 31 ft across the outer edges of opposite footpads (NR).
const FOOTPAD_REACH = (31 * FT) / 2 - FOOTPAD.radius
// APPROX: folded, the primary strut swings up to nearly vertical, its footpad beside the ascent stage.
const FOLD_DEGREES = 145

export interface Leg {
  azimuthDegrees: number
  // The primary strut's upper end (its hinge) and the footpad's sole centre.
  hinge: Vec3
  footpad: Vec3
  probe: boolean
  foldDegrees: number
}

// Forward (+Z, with the ladder), then counter-clockwise seen from above: left, aft, right.
export const LEGS: Leg[] = [0, 90, 180, 270].map((azimuthDegrees) => {
  const [x, z] = outward(azimuthDegrees)
  return {
    azimuthDegrees,
    hinge: [x * OUTRIGGER.reach, OUTRIGGER.height, z * OUTRIGGER.reach],
    footpad: [x * FOOTPAD_REACH, 0, z * FOOTPAD_REACH],
    probe: azimuthDegrees !== 0,
    foldDegrees: FOLD_DEGREES,
  }
})

// The unit direction (x, z) a leg points out along.
export function outward(azimuthDegrees: number): [number, number] {
  const angle = (azimuthDegrees * Math.PI) / 180
  return [Math.sin(angle), Math.cos(angle)]
}

// How a leg folds: about the horizontal line through its hinge across its own direction, so its foot
// swings out, up and in.
export function legHinge(leg: Leg): Hinge {
  const [x, z] = outward(leg.azimuthDegrees)
  return { pivot: leg.hinge, axis: [-z, 0, x], angle: (leg.foldDegrees * Math.PI) / 180 }
}

// The descent engine (DPS): 85 in long, 59 in across its exit (NR); its exit just below the
// descent stage's bottom (APPROX). Profile from the exit up.
export const DPS = {
  exitHeight: LM_HEIGHTS.descentBottom - 0.35,
  profile: [[(59 * IN) / 2, 0], [0.6, 0.6], [0.42, 1.25], [0.25, 1.6], [0.3, 1.75], [0.3, 85 * IN], [0, 85 * IN]] as ProfilePoint[],
}

// The ascent engine (APS): 47 in long, 31 in across its exit (NR), its exit at the interstage.
export const APS = {
  exitHeight: LM_HEIGHTS.interstage - 0.05,
  profile: [[(31 * IN) / 2, 0], [0.3, 0.45], [0.18, 0.8], [0.22, 0.9], [0.22, 47 * IN], [0, 47 * IN]] as ProfilePoint[],
}

export interface LmTank {
  contents: 'fuel' | 'oxidizer'
  at: [number, number] // (x, z)
  radius: number
  bottom: number
  height: number // the cylinder between the domes (0: a sphere)
}

// Four descent tanks in the compartments ahead, behind and either side of the engine (NR); APPROX:
// their size. Two hold fuel, two oxidizer, like ones opposite.
export const DESCENT_TANKS: LmTank[] = [0, 90, 180, 270].map((azimuth, index) => {
  const [x, z] = outward(azimuth)
  return { contents: index % 2 === 0 ? 'oxidizer' : 'fuel', at: [x * 1.3, z * 1.3], radius: 0.62, bottom: LM_HEIGHTS.descentBottom + 0.12, height: 0.35 }
})

// Two spheres beside the midsection, outside it (NR): fuel on the left, oxidizer on the right
// (APPROX: which side, their size).
export const ASCENT_TANKS: LmTank[] = [
  { contents: 'fuel', at: [-1.35, -0.55], radius: 0.6, bottom: LM_HEIGHTS.interstage + 0.25, height: 0 },
  { contents: 'oxidizer', at: [1.35, -0.55], radius: 0.6, bottom: LM_HEIGHTS.interstage + 0.25, height: 0 },
]

export const HATCH = { size: 32 * IN, bottom: ASCENT_STAGE.floor + 0.05 } // NR: 32 in square
export const OVERHEAD_HATCH = { radius: (33 * IN) / 2 } // NR
export const S_BAND_DISH = { radius: (26 * IN) / 2 } // NR
export const RENDEZVOUS_DISH = { radius: 0.3 } // APPROX

// The ladder on the forward leg (NR): nine rungs 9 in apart, rails 20 in apart.
export const LADDER = { rungs: 9, rungSpacing: 9 * IN, railsApart: 20 * IN, aboveFootpad: 30 * IN }

// The person for scale stands beside the forward leg, off to the right (APPROX).
export const PERSON_PLACE: [number, number] = [2.2, 3.4]
