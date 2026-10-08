import { MOON_ORBIT_TILT_DEGREES, REAL_MOON_ORBIT_TILT_DEGREES } from '../eclipse/eclipseGeometry'
import { REAL_SUN_ANGULAR_RADIUS, SUN_ANGULAR_RADIUS } from '../eclipse/skyGeometry'
import type { Chapter, EclipseStage, Lesson } from '../lessonTypes'

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
    title: 'New Moon: Sun, Moon and Earth in a Row',
    kind: 'eclipseOrbit',
    eclipse: stage({ nodeDegrees: 0 }),
    text:
      'The Moon goes around Earth every 29.5 days. At new moon it passes between the Sun and ' +
      'Earth - and if the three line up exactly, the Moon blocks the sunlight and its shadow falls ' +
      'on Earth: a solar eclipse. The shadow has two parts. Inside the umbra (between the red ' +
      'lines) the Moon hides all of the Sun; it narrows to a point just behind Earth\'s surface, ' +
      'so it touches Earth only as a small spot. Inside the much wider penumbra (between the blue ' +
      'lines) the Moon hides only part of the Sun.',
  }),
  chapter({
    id: 'tilted-orbit',
    title: 'Why Not Every Month?',
    kind: 'eclipseOrbit',
    eclipse: stage({ nodeDegrees: 90 }),
    text:
      "The Moon's orbit is tilted by about 5° against Earth's orbit around the Sun. So at most new " +
      'moons the Moon passes a little above or below the Sun, and its shadow misses Earth. Only ' +
      'when new moon falls near one of the two points where the Moon crosses the plane of ' +
      "Earth's orbit do Sun, Moon and Earth line up. As Earth travels around the Sun, that " +
      'happens in two short "eclipse seasons" a year - which is why there are only two to five ' +
      'solar eclipses a year.',
  }),
  chapter({
    id: 'shadow-on-earth',
    title: "The Moon's Shadow on Earth",
    kind: 'eclipseShadow',
    eclipse: stage({ nodeDegrees: 0 }),
    text:
      "Seen from space, the Moon's shadow is a dark smudge sweeping across Earth's day side - " +
      'satellites photograph it during every eclipse. Everyone inside the penumbra (blue), a ' +
      'region thousands of kilometers wide, sees a partial eclipse. Only inside the umbra (red), ' +
      'at most about 270 km wide, does the Sun disappear completely. The umbra races across Earth ' +
      'at 1,700 km/h or more and draws a narrow "path of totality", so at any one place totality ' +
      'lasts only a few minutes - never more than about 7.5.',
  }),
  chapter({
    id: 'first-contact',
    title: 'From the Ground: Just a Sunny Day?',
    kind: 'eclipseSky',
    eclipse: stage({ skySeparation: 1.1 }),
    text:
      'Now we stand on Earth, in the path of totality. The Moon has already started to cover the ' +
      'Sun from its western edge - but nobody would notice: the sky stays bright blue, and the Sun ' +
      'still dazzles, far too bright to look at. Never look straight at the Sun, not even for a ' +
      'moment and not even when most of it is covered: it can burn the retina for good, without ' +
      'any pain.',
  }),
  chapter({
    id: 'partial',
    title: 'Through Eclipse Glasses: A Bite out of the Sun',
    kind: 'eclipseSky',
    eclipse: stage({ skySeparation: 0.7, glasses: 1 }),
    text:
      'Eclipse glasses (made to the ISO 12312-2 standard; sunglasses are not nearly enough) let ' +
      'through only about a hundred-thousandth of the sunlight. Everything else goes black, and the Sun ' +
      'shows as what it has become: a crescent, growing thinner for about an hour as the Moon ' +
      'slides across it. The daylight hardly changes until almost all of the Sun is covered.',
  }),
  chapter({
    id: 'diamond-ring',
    title: 'The Diamond Ring',
    kind: 'eclipseSky',
    eclipse: stage({ skySeparation: 0.075 }),
    text:
      "Seconds before totality, the last rays of sunlight shine through valleys on the Moon's edge " +
      "and the Sun's glowing outer atmosphere starts to show around the dark Moon: the diamond " +
      'ring. The light now fades within seconds, and the sky darkens. Keep the eclipse glasses on ' +
      'until the diamond has gone out.',
  }),
  chapter({
    id: 'totality',
    title: 'Totality',
    kind: 'eclipseSky',
    eclipse: stage({ skySeparation: 0 }),
    text:
      'The Moon covers all of the Sun - now, and only now, it is safe to look without glasses. The ' +
      "corona appears, the Sun's outer atmosphere, over a million degrees hot, with red " +
      "prominences at the Moon's edge. The sky turns deep blue, a sunset glow rings the whole " +
      'horizon, the brightest stars and planets come out, and it gets noticeably cooler. A perfect ' +
      'fit: the Sun is about 400 times wider than the Moon, but also about 400 times farther away. ' +
      'The next total eclipse, on 2 August 2027, crosses southern Spain, North Africa and Egypt.',
  }),
  chapter({
    id: 'annular',
    title: 'Ring of Fire',
    kind: 'eclipseSky',
    eclipse: stage({ moonSizeRatio: ANNULAR_SIZE_RATIO, glasses: 1 }),
    text:
      "The Moon's orbit is not a perfect circle. When an eclipse comes while the Moon is near its " +
      'farthest point from Earth, it looks slightly smaller than the Sun and cannot cover it: its ' +
      'umbra ends before it reaches Earth, and a ring of fire stays around the Moon. This annular ' +
      'eclipse never gets dark and the corona stays hidden - the eclipse glasses stay on the ' +
      'whole time.',
  }),
]

const TILT_EXAGGERATION = Math.round(MOON_ORBIT_TILT_DEGREES / REAL_MOON_ORBIT_TILT_DEGREES)
const SKY_ENLARGEMENT = Math.round(SUN_ANGULAR_RADIUS / REAL_SUN_ANGULAR_RADIUS)

export const SOLAR_ECLIPSE_LESSON: Lesson = {
  id: 'solarEclipse',
  title: 'What happens in a solar eclipse?',
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by eclipse chapters - see lessonTypes.ts's doc comment
  note:
    'Not to scale: the Sun, Moon and Earth are drawn far closer together than they are, the ' +
    `Moon's orbit is tilted about ${TILT_EXAGGERATION} times more steeply than its real 5°, and ` +
    `seen from the ground the Sun and Moon look about ${SKY_ENLARGEMENT} times bigger than in the ` +
    'sky. True to life: how big Earth and the Moon are compared, and the Moon looking just about ' +
    'as big as the Sun.',
}
