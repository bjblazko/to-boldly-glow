import { MOON_ORBIT_TILT_DEGREES, REAL_MOON_ORBIT_TILT_DEGREES } from '../eclipse/eclipseGeometry'
import type { Chapter, Lesson, PhasesStage } from '../lessonTypes'
import { MOON_ANGULAR_RADIUS_DEGREES } from '../phases/phasesGeometry'

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
    title: 'Always Half Lit',
    kind: 'phasesOrbit',
    phases: stage({ moonAgeDegrees: 20, circling: true }),
    text:
      'The Sun always lights exactly half of the Moon - the half facing it, just as it lights half ' +
      'of Earth. What changes over a month is how much of that lit half faces us. At new moon it ' +
      'faces away; at full moon it faces us; at first and last quarter we see half of it. The card ' +
      'in the corner shows the Moon as seen from Earth right now.',
  }),
  chapter({
    id: 'not-earths-shadow',
    title: "Not Earth's Shadow",
    kind: 'phasesShadow',
    phases: stage({ moonAgeDegrees: 180 }),
    text:
      "A common mix-up: the phases are not Earth's shadow on the Moon. Earth's shadow points " +
      'straight away from the Sun, so the Moon could only be in it at full moon - just when we see ' +
      "it fully lit. And because the Moon's orbit is tilted, the full Moon nearly always passes a " +
      'little above or below the shadow. When it does pass through, that is a lunar eclipse - a rare ' +
      'event, not the monthly phases.',
  }),
  chapter({
    id: 'same-face',
    title: 'Always the Same Face',
    kind: 'phasesOrbit',
    phases: stage({ moonAgeDegrees: 200, circling: true, showNearSide: true }),
    text:
      'The Moon turns once around itself in exactly the time it takes to go once around Earth, so ' +
      'it always shows us the same side - the marker points at its middle. The far side is not ' +
      'dark, though: at new moon it is the far side that lies in full sunlight. And from one new ' +
      "moon to the next takes 29.5 days, about two days more than the Moon's 27.3-day trip around " +
      'Earth: meanwhile Earth has moved on along its orbit, so the Moon needs a little longer to ' +
      'line up with the Sun again.',
  }),
  chapter({
    id: 'evening-crescent',
    title: 'From the Ground: Evening Crescent',
    kind: 'phasesSky',
    phases: stage({ moonAgeDegrees: 40, moonAltitudeDegrees: 10, sunAltitudeDegrees: -7 }),
    text:
      'About three days after new moon, look west just after sunset: a thin crescent hangs low over ' +
      'the glow where the Sun went down, its lit side turned toward it. The rest of the Moon glows ' +
      "faintly too: that's earthshine, sunlight reflected by Earth's day side - which, seen from " +
      'the Moon, is nearly full. Each evening the Moon stands about 12° farther from the Sun, and its ' +
      'crescent grows.',
  }),
  chapter({
    id: 'first-quarter',
    title: 'First Quarter',
    kind: 'phasesSky',
    phases: stage({ moonAgeDegrees: 90, moonAltitudeDegrees: 14, sunAltitudeDegrees: -2 }),
    text:
      'A week after new moon, the Moon has gone a quarter of the way around Earth and stands 90° ' +
      'from the Sun. At sunset it is in the south, its right half lit (seen from the southern ' +
      "hemisphere, its left). It is called a quarter for where the Moon is in its orbit, not for " +
      'its shape.',
  }),
  chapter({
    id: 'full-moon',
    title: 'Full Moon Rising',
    kind: 'phasesSky',
    phases: stage({ moonAgeDegrees: 180, moonAltitudeDegrees: 5, sunAltitudeDegrees: -5 }),
    text:
      'Two weeks after new moon, the Moon stands opposite the Sun: as the Sun sets in the west, ' +
      'the full Moon rises in the east, and it stays up all night. Above the eastern horizon at ' +
      'dusk, look for a pink band - the Belt of Venus, sunlight still reaching the high air - over ' +
      "the darker blue of Earth's own shadow.",
  }),
  chapter({
    id: 'last-quarter',
    title: 'Last Quarter',
    kind: 'phasesSky',
    phases: stage({ moonAgeDegrees: 270, moonAltitudeDegrees: 14, sunAltitudeDegrees: -2 }),
    text:
      'Three weeks in, the Moon has gone three quarters of the way around. It rises around ' +
      'midnight and is still in the southern sky at sunrise, now lit on its left. Over the next ' +
      'week it shrinks back to a thin crescent in the dawn - and then to new moon, when it passes ' +
      'between the Sun and Earth and can cause a solar eclipse.',
  }),
]

const SKY_ENLARGEMENT = Math.round(MOON_ANGULAR_RADIUS_DEGREES / REAL_MOON_ANGULAR_RADIUS_DEGREES)
const TILT_EXAGGERATION = Math.round(MOON_ORBIT_TILT_DEGREES / REAL_MOON_ORBIT_TILT_DEGREES)

export const MOON_PHASES_LESSON: Lesson = {
  id: 'moonPhases',
  title: 'Why does the Moon have phases?',
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by phases chapters - see lessonTypes.ts's doc comment
  note:
    'Not to scale: the Moon is drawn far closer to Earth than it is, goes around in seconds instead ' +
    `of a month, and seen from the ground looks about ${SKY_ENLARGEMENT} times bigger than in the sky. ` +
    `In the side view its orbit is tilted about ${TILT_EXAGGERATION} times more steeply than its real ` +
    '5°. True to life: which part of the Moon the Sun lights, and so its shape from Earth.',
}
