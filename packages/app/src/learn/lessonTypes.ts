// A chapter of a lesson. `kind` distinguishes the halves of the "seasons" lesson - 'orbit'
// chapters show Earth's real position in its orbit (with its axis held in a single fixed
// direction - see seasons/seasonalPole.ts's ORBIT_FIXED_POLE_DIRECTION), 'staged' chapters show the existing
// simplified diagram (fixed position, tilting axis - see seasons/seasonalPole.ts's seasonalPoleDirection) - plus
// unrelated kinds: 'sizes' renders the Sun and all 8 planets as a single static real-scale
// lineup, largest to smallest (see sizes/sizesLineup.ts), and the solar eclipse lesson's three
// shots (see eclipse/eclipseScene.ts): 'eclipseOrbit' (Sun, Moon and Earth side by side),
// 'eclipseShadow' (the Moon's shadow on Earth, close up) and 'eclipseSky' (the eclipse seen from the
// ground). `seasonPhaseDegrees` and `markerLatitudeDegrees` are ignored by every kind but 'orbit'
// and 'staged' - both fields stay required only because those chapter kinds need them.
// `seasonPhaseDegrees` is this chapter's fixed position in an idealized annual cycle (0 = June
// solstice, 90 = September equinox, 180 = December solstice, 270 = March equinox), reused with a
// different meaning per kind: for 'staged' chapters it drives Earth's tilt orientation; for
// 'orbit' chapters it drives Earth's position on the compact orbit path instead (see seasons/overlayGeometry.ts's
// orbitPositionForPhase). There is no calendar date or scrub position in this design - each
// chapter is a fixed diagram, not a real date range.
export interface Chapter {
  id: string
  title: string
  kind: 'orbit' | 'staged' | 'sizes' | EclipseChapterKind
  seasonPhaseDegrees: number
  text: string
  // The eclipse lesson's chapters: how the Sun, Moon and Earth stand (see EclipseStage).
  eclipse?: EclipseStage
}

export type EclipseChapterKind = 'eclipseOrbit' | 'eclipseShadow' | 'eclipseSky'

export function isEclipseKind(kind: Chapter['kind']): kind is EclipseChapterKind {
  return kind === 'eclipseOrbit' || kind === 'eclipseShadow' || kind === 'eclipseSky'
}

// One stage of the solar eclipse lesson. Moving between two chapters of the same kind eases every
// number from one stage to the next, so the Moon visibly slides into place.
export interface EclipseStage {
  // Where the Moon's tilted orbit crosses Earth's orbital plane, measured from the Sun's direction:
  // 0 puts new moon right on the crossing, so the Moon passes straight between the Sun and Earth;
  // 90 lifts it as far above the Sun-Earth line as the tilt allows, and its shadow misses Earth.
  nodeDegrees: number
  // Seen from the ground: the distance between the Moon's and the Sun's centers, in Sun radii
  // (positive: the Moon still west of the Sun, before totality).
  skySeparation: number
  // Seen from the ground: the Moon's apparent size over the Sun's (above 1 it can cover the Sun).
  moonSizeRatio: number
  // Seen from the ground: 1 looks through eclipse glasses, 0 with the naked eye.
  glasses: number
}

export interface Lesson {
  id: string
  title: string
  chapters: Chapter[]
  // Latitude magnitude (degrees) for the two symmetric, always-visible location markers - one at
  // +markerLatitudeDegrees, one at -markerLatitudeDegrees. Only ever used for 'staged' chapters -
  // the two markers are never shown during 'orbit' or 'sizes' chapters (see the design spec's §4).
  markerLatitudeDegrees: number
  // Shown under every chapter's text: what this lesson's picture exaggerates or leaves out, so a
  // learner knows which parts to read literally (e.g. angles) and which not (e.g. sizes, speeds).
  note?: string
}
