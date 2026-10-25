import { MOON_ORBIT_TILT_DEGREES, REAL_MOON_ORBIT_TILT_DEGREES } from '../eclipse/eclipseGeometry'
import { msg } from '../../i18n/i18n'
import type { Chapter, Lesson, PhasesStage } from '../lessonTypes'
import { MOON_ANGULAR_RADIUS_DEGREES } from '../phases/phasesGeometry'

const TEXT = msg.lessons.moonPhases

// The real Moon's angular radius seen from Earth, for the note on how much bigger it looks here.
const REAL_MOON_ANGULAR_RADIUS_DEGREES = 0.259

function stage(overrides: Partial<PhasesStage>): PhasesStage {
  return { moonAgeDegrees: 0, circling: false, showNearSide: false, moonAltitudeDegrees: 10, sunAltitudeDegrees: -6, ...overrides }
}

// Only 'orbit' and 'staged' chapters read seasonPhaseDegrees (see lessonTypes.ts).
function chapter(fields: Omit<Chapter, 'seasonPhaseDegrees'>): Chapter {
  return { seasonPhaseDegrees: 0, ...fields }
}

const CHAPTERS: Chapter[] = [
  chapter({
    id: 'always-half-lit',
    ...TEXT.chapters['always-half-lit'],
    kind: 'phasesOrbit',
    phases: stage({ moonAgeDegrees: 20, circling: true }),
  }),
  chapter({
    id: 'not-earths-shadow',
    ...TEXT.chapters['not-earths-shadow'],
    kind: 'phasesShadow',
    phases: stage({ moonAgeDegrees: 180 }),
  }),
  chapter({
    id: 'same-face',
    ...TEXT.chapters['same-face'],
    kind: 'phasesOrbit',
    phases: stage({ moonAgeDegrees: 200, circling: true, showNearSide: true }),
  }),
  chapter({
    id: 'evening-crescent',
    ...TEXT.chapters['evening-crescent'],
    kind: 'phasesSky',
    phases: stage({ moonAgeDegrees: 40, moonAltitudeDegrees: 10, sunAltitudeDegrees: -7 }),
  }),
  chapter({
    id: 'first-quarter',
    ...TEXT.chapters['first-quarter'],
    kind: 'phasesSky',
    phases: stage({ moonAgeDegrees: 90, moonAltitudeDegrees: 14, sunAltitudeDegrees: -2 }),
  }),
  chapter({
    id: 'full-moon',
    ...TEXT.chapters['full-moon'],
    kind: 'phasesSky',
    phases: stage({ moonAgeDegrees: 180, moonAltitudeDegrees: 5, sunAltitudeDegrees: -5 }),
  }),
  chapter({
    id: 'last-quarter',
    ...TEXT.chapters['last-quarter'],
    kind: 'phasesSky',
    phases: stage({ moonAgeDegrees: 270, moonAltitudeDegrees: 14, sunAltitudeDegrees: -2 }),
  }),
]

const SKY_ENLARGEMENT = Math.round(MOON_ANGULAR_RADIUS_DEGREES / REAL_MOON_ANGULAR_RADIUS_DEGREES)
const TILT_EXAGGERATION = Math.round(MOON_ORBIT_TILT_DEGREES / REAL_MOON_ORBIT_TILT_DEGREES)

export const MOON_PHASES_LESSON: Lesson = {
  id: 'moonPhases',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by phases chapters - see lessonTypes.ts's doc comment
  note: TEXT.note(SKY_ENLARGEMENT, TILT_EXAGGERATION),
}
