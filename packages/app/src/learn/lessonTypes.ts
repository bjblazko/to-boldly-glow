// A chapter of a lesson. `kind` distinguishes the two halves of the "seasons" lesson: 'orbit'
// chapters show Earth's real position in its orbit (with its axis held in a single fixed
// direction - see main.ts's ORBIT_FIXED_POLE_DIRECTION), 'staged' chapters show the existing
// simplified diagram (fixed position, tilting axis - see main.ts's seasonalPoleDirection).
// `seasonPhaseDegrees` is this chapter's fixed position in an idealized annual cycle (0 = June
// solstice, 90 = September equinox, 180 = December solstice, 270 = March equinox), reused with a
// different meaning per kind: for 'staged' chapters it drives Earth's tilt orientation; for
// 'orbit' chapters it drives Earth's position on the compact orbit path instead (see main.ts's
// orbitPositionForPhase). There is no calendar date or scrub position in this design - each
// chapter is a fixed diagram, not a real date range.
export interface Chapter {
  id: string
  title: string
  kind: 'orbit' | 'staged'
  seasonPhaseDegrees: number
  text: string
}

export interface Lesson {
  id: string
  title: string
  chapters: Chapter[]
  // Latitude magnitude (degrees) for the two symmetric, always-visible location markers - one at
  // +markerLatitudeDegrees, one at -markerLatitudeDegrees. Only ever used for 'staged' chapters -
  // the two markers are never shown during 'orbit' chapters (see the design spec's §4).
  markerLatitudeDegrees: number
}
