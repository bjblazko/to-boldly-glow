import type { VoyagerStage } from './voyager/voyagerStage'
import type { VehicleStage } from './vehicle/vehicleStage'

// A chapter of a lesson. `kind` distinguishes the halves of the "seasons" lesson - 'orbit'
// chapters show Earth's real position in its orbit (with its axis held in a single fixed
// direction - see seasons/seasonalPole.ts's ORBIT_FIXED_POLE_DIRECTION), 'staged' chapters show the existing
// simplified diagram (fixed position, tilting axis - see seasons/seasonalPole.ts's seasonalPoleDirection) - plus
// unrelated kinds: 'sizes' renders the Sun and all 8 planets as a single real-scale lineup, in the
// order of the lesson's chapters (see sizes/sizesLineup.ts; a chapter may close in on one planet,
// see focusPlanetId), the solar eclipse lesson's three shots (see eclipse/eclipseScene.ts):
// 'eclipseOrbit' (Sun, Moon and Earth side by side), 'eclipseShadow' (the Moon's shadow on Earth,
// close up) and 'eclipseSky' (the eclipse seen from the ground), and the Moon phases lesson's three
// (see phases/phasesScene.ts): 'phasesOrbit' (the Moon's orbit seen from above), 'phasesShadow'
// (the full Moon passing Earth's shadow) and 'phasesSky' (the Moon seen from the ground).
// `seasonPhaseDegrees` and `markerLatitudeDegrees` are ignored by every kind but 'orbit' and
// 'staged' - both fields stay required only because those chapter kinds need them.
// `seasonPhaseDegrees` is this chapter's fixed position in an idealized annual cycle (0 = June
// solstice, 90 = September equinox, 180 = December solstice, 270 = March equinox), reused with a
// different meaning per kind: for 'staged' chapters it drives Earth's tilt orientation; for
// 'orbit' chapters it drives Earth's position on the compact orbit path instead (see seasons/overlayGeometry.ts's
// orbitPositionForPhase). There is no calendar date or scrub position in this design - each
// chapter is a fixed diagram, not a real date range.
export interface Chapter {
  id: string
  title: string
  kind: 'orbit' | 'staged' | 'sizes' | EclipseChapterKind | PhasesChapterKind | VoyagerChapterKind | 'vehicle'
  seasonPhaseDegrees: number
  text: string
  // The eclipse lesson's chapters: how the Sun, Moon and Earth stand (see EclipseStage).
  eclipse?: EclipseStage
  // The Moon phases lesson's chapters: where the Moon is (see PhasesStage).
  phases?: PhasesStage
  // Shown under the text as a grid of pictograms with a label and a value each (the planet sizes
  // lesson's numbers).
  facts?: ChapterFact[]
  // 'sizes' chapters: the planet the camera closes in on; without one it shows the whole lineup.
  focusPlanetId?: string
  // The Voyager lessons' chapters: what the probe, the record or the route shows (see VoyagerStage).
  voyager?: VoyagerStage
  // The vehicle lessons' chapters (the Saturn V, Columbia): the vehicle and how far it is taken
  // apart, cut open or looked into (see VehicleStage).
  vehicle?: VehicleStage
  // Shown in the panel under the text: a photo with its credit, or a chart of real data.
  photo?: ChapterPhoto
  chart?: ChapterChart
  // Links to other websites, marked as leaving the app (the app itself loads nothing from them).
  links?: ChapterLink[]
  // An interactive demonstration in the panel (the Golden Record's picture stored as sound).
  demo?: 'pictureSignal'
}

export interface ChapterLink {
  label: string
  url: string
}

export interface ChapterPhoto {
  // Under public/, e.g. 'images/voyager/PIA01384.jpg'.
  src: string
  caption: string
  credit: string
}

export type ChapterChart = 'gravityAssist' | 'heliopauseVoyager1' | 'heliopauseVoyager2'

// One fact in a chapter's grid. `icon` names a symbol in index.html's icon sprite (without its
// "icon-" prefix).
export interface ChapterFact {
  icon: FactIcon
  label: string
  value: string
}

export type FactIcon =
  | 'diameter'
  | 'circumference'
  | 'mass'
  | 'rock'
  | 'giant'
  | 'atmosphere'
  | 'thermometer'
  | 'sun-distance'
  | 'rotation'
  | 'orbit'
  | 'clock'
  | 'signal'
  | 'power'

export type EclipseChapterKind = 'eclipseOrbit' | 'eclipseShadow' | 'eclipseSky'
// The Voyager lessons' three shots (see voyager/voyagerLesson.ts): the spacecraft itself, its
// Golden Record, and the real solar system along the probes' route.
export type VoyagerChapterKind = 'voyagerProbe' | 'voyagerRecord' | 'voyagerRoute'
export type PhasesChapterKind = 'phasesOrbit' | 'phasesShadow' | 'phasesSky'

export function isEclipseKind(kind: Chapter['kind']): kind is EclipseChapterKind {
  return kind === 'eclipseOrbit' || kind === 'eclipseShadow' || kind === 'eclipseSky'
}

export function isVoyagerKind(kind: Chapter['kind']): kind is VoyagerChapterKind {
  return kind === 'voyagerProbe' || kind === 'voyagerRecord' || kind === 'voyagerRoute'
}

export function isPhasesKind(kind: Chapter['kind']): kind is PhasesChapterKind {
  return kind === 'phasesOrbit' || kind === 'phasesShadow' || kind === 'phasesSky'
}

// One stage of the Moon phases lesson. Moving between two chapters of the same kind eases the
// numbers from one stage to the next.
export interface PhasesStage {
  // How far the Moon has gone around Earth since new moon, in degrees: 90 at first quarter, 180 at
  // full moon, 270 at last quarter.
  moonAgeDegrees: number
  // The Moon keeps going around Earth (from moonAgeDegrees on).
  circling: boolean
  // Marks the middle of the Moon's near side - the side it always turns to Earth.
  showNearSide: boolean
  // Seen from the ground: how high the Moon and the Sun stand above the horizon, in degrees (the
  // Sun below it, at dusk or dawn).
  moonAltitudeDegrees: number
  sunAltitudeDegrees: number
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
  // Other orders the chapters can be shown in, picked from the dock's Sort menu (the planets
  // lesson: by size, by mass, ...). The first is the lesson's own `chapters`.
  sortings?: LessonSorting[]
}

export interface LessonSorting {
  id: string
  // In the Sort menu, with a hint below it where the name alone would mislead.
  name: string
  hint?: string
  chapters: Chapter[]
  // Under each planet's name in the lineup: its value in this order, e.g. "778 million km".
  planetNotes: Record<string, string>
}
