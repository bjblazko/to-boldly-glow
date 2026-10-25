import { MOON_ORBIT_TILT_DEGREES, REAL_MOON_ORBIT_TILT_DEGREES } from '../eclipse/eclipseGeometry'
import { REAL_SUN_ANGULAR_RADIUS, SUN_ANGULAR_RADIUS } from '../eclipse/skyGeometry'
import { msg } from '../../i18n/i18n'
import type { Chapter, EclipseStage, Lesson } from '../lessonTypes'

const TEXT = msg.lessons.solarEclipse

// The Moon's apparent size over the Sun's in the ground chapters: a total eclipse (1.0 to 1.06 in
// reality) and an annular one, with the Moon near the far end of its orbit.
const TOTAL_SIZE_RATIO = 1.04
const ANNULAR_SIZE_RATIO = 0.93

function stage(overrides: Partial<EclipseStage>): EclipseStage {
  return { nodeDegrees: 0, skySeparation: 0, moonSizeRatio: TOTAL_SIZE_RATIO, glasses: 0, ...overrides }
}

// Only 'orbit' and 'staged' chapters read seasonPhaseDegrees (see lessonTypes.ts).
function chapter(fields: Omit<Chapter, 'seasonPhaseDegrees'>): Chapter {
  return { seasonPhaseDegrees: 0, ...fields }
}

const CHAPTERS: Chapter[] = [
  chapter({
    id: 'new-moon',
    ...TEXT.chapters['new-moon'],
    kind: 'eclipseOrbit',
    eclipse: stage({ nodeDegrees: 0 }),
  }),
  chapter({
    id: 'tilted-orbit',
    ...TEXT.chapters['tilted-orbit'],
    kind: 'eclipseOrbit',
    eclipse: stage({ nodeDegrees: 90 }),
  }),
  chapter({
    id: 'shadow-on-earth',
    ...TEXT.chapters['shadow-on-earth'],
    kind: 'eclipseShadow',
    eclipse: stage({ nodeDegrees: 0 }),
  }),
  chapter({
    id: 'first-contact',
    ...TEXT.chapters['first-contact'],
    kind: 'eclipseSky',
    eclipse: stage({ skySeparation: 1.1 }),
  }),
  chapter({
    id: 'partial',
    ...TEXT.chapters.partial,
    kind: 'eclipseSky',
    eclipse: stage({ skySeparation: 0.7, glasses: 1 }),
  }),
  chapter({
    id: 'diamond-ring',
    ...TEXT.chapters['diamond-ring'],
    kind: 'eclipseSky',
    eclipse: stage({ skySeparation: 0.075 }),
  }),
  chapter({
    id: 'totality',
    ...TEXT.chapters.totality,
    kind: 'eclipseSky',
    eclipse: stage({ skySeparation: 0 }),
  }),
  chapter({
    id: 'annular',
    ...TEXT.chapters.annular,
    kind: 'eclipseSky',
    eclipse: stage({ moonSizeRatio: ANNULAR_SIZE_RATIO, glasses: 1 }),
  }),
]

const TILT_EXAGGERATION = Math.round(MOON_ORBIT_TILT_DEGREES / REAL_MOON_ORBIT_TILT_DEGREES)
const SKY_ENLARGEMENT = Math.round(SUN_ANGULAR_RADIUS / REAL_SUN_ANGULAR_RADIUS)

export const SOLAR_ECLIPSE_LESSON: Lesson = {
  id: 'solarEclipse',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by eclipse chapters - see lessonTypes.ts's doc comment
  note: TEXT.note(TILT_EXAGGERATION, SKY_ENLARGEMENT),
}
