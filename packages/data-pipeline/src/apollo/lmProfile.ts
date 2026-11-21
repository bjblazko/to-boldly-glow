import type { ProfilePoint } from './latheMesh'

// Apollo 11's lunar module Eagle (LM-5): the dimensions behind what we add to Project Apollo -
// NASSP's model (lmNasspModel.ts) - the cutaway's tanks and engines, the person for scale - and the
// lesson's figures. In metres: heights above the footpads' soles with the legs out, +Y up, +Z
// forward (the front hatch, the ladder leg), +X the Commander's side.
//
// Sources (public domain):
// - NR: "Apollo Lunar Module News Reference", Grumman for NASA, 1968 (archive.org item
//   apollo-lunar-module-news-reference-1968), read 2026-11-21: 22 ft 11 in tall (legs extended);
//   ascent stage 12 ft 4 in high, descent stage 10 ft 7 in; descent decks about 65 in apart. DPS
//   9,870 lb thrust, throttled down to 1,050 lb (10 %), 85 in long, nozzle exit 59 in; four
//   cylindrical, spherical-ended descent tanks in the compartments round it. APS 3,500 lb, 47 in
//   long, exit 31 in; two spherical ascent tanks.
// - APPROX: settled by none of it - the tank sizes and places, the nozzle's height.

const FT = 0.3048
const IN = 0.0254

export const LM_HEIGHTS = {
  // NR: the descent stage's 10 ft 7 in reach from the footpads to the ascent stage, which adds
  // its 12 ft 4 in - together the 22 ft 11 in overall.
  interstage: 10 * FT + 7 * IN,
  overall: 22 * FT + 11 * IN,
  descentBottom: 10 * FT + 7 * IN - 65 * IN - 0.12, // NR: decks 65 in apart; APPROX: the heat shield below
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
  const [x, z] = [Math.sin((azimuth * Math.PI) / 180), Math.cos((azimuth * Math.PI) / 180)]
  return { contents: index % 2 === 0 ? 'oxidizer' : 'fuel', at: [x * 1.3, z * 1.3], radius: 0.62, bottom: LM_HEIGHTS.descentBottom + 0.12, height: 0.35 }
})

// Two spheres beside the midsection, outside it (NR): fuel on the left, oxidizer on the right
// (APPROX: which side, their size).
export const ASCENT_TANKS: LmTank[] = [
  { contents: 'fuel', at: [-1.35, -0.55], radius: 0.6, bottom: LM_HEIGHTS.interstage + 0.25, height: 0 },
  { contents: 'oxidizer', at: [1.35, -0.55], radius: 0.6, bottom: LM_HEIGHTS.interstage + 0.25, height: 0 },
]

// The person for scale stands beside the forward leg, off to the right (APPROX).
export const PERSON_PLACE: [number, number] = [2.2, 3.4]
