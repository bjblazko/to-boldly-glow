import type { Chapter, Lesson } from '../lessonTypes'

// Diameter/circumference derived from bodies.ts's own radiusKm (2*radiusKm, and pi*diameter -
// circumference isn't otherwise stored anywhere in the data pipeline). Average Sun distance
// (km/AU) is the one fact not already in bodies.ts - both figures are the standard NASA Planetary
// Fact Sheet semi-major-axis values, matching the sourcing convention documented on
// BodyDefinition's own fields in bodies.ts.
interface PlanetStats {
  diameterKm: number
  circumferenceKm: number
  averageDistanceKm: number
  averageDistanceAu: number
}

const PLANET_STATS: Record<string, PlanetStats> = {
  mercury: { diameterKm: 4_879, circumferenceKm: 15_329, averageDistanceKm: 57_909_050, averageDistanceAu: 0.387 },
  venus: { diameterKm: 12_104, circumferenceKm: 38_025, averageDistanceKm: 108_208_000, averageDistanceAu: 0.723 },
  earth: { diameterKm: 12_742, circumferenceKm: 40_030, averageDistanceKm: 149_598_023, averageDistanceAu: 1.0 },
  mars: { diameterKm: 6_779, circumferenceKm: 21_297, averageDistanceKm: 227_939_200, averageDistanceAu: 1.524 },
  jupiter: { diameterKm: 139_822, circumferenceKm: 439_264, averageDistanceKm: 778_570_000, averageDistanceAu: 5.203 },
  saturn: { diameterKm: 116_464, circumferenceKm: 365_882, averageDistanceKm: 1_433_530_000, averageDistanceAu: 9.537 },
  uranus: { diameterKm: 50_724, circumferenceKm: 159_354, averageDistanceKm: 2_872_460_000, averageDistanceAu: 19.191 },
  neptune: { diameterKm: 49_244, circumferenceKm: 154_705, averageDistanceKm: 4_495_060_000, averageDistanceAu: 30.069 },
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

function planetChapter(id: string, name: string): Chapter {
  const stats = PLANET_STATS[id]
  return {
    id,
    title: name,
    kind: 'sizes',
    seasonPhaseDegrees: 0, // unused by 'sizes' chapters - see lessonTypes.ts's doc comment
    text:
      `${name} - Durchmesser (diameter): ${formatNumber(stats.diameterKm)} km. ` +
      `Umfang (circumference): ${formatNumber(stats.circumferenceKm)} km. ` +
      `Average distance to the Sun: ${formatNumber(stats.averageDistanceKm)} km ` +
      `(${stats.averageDistanceAu} AU).`,
  }
}

// Same largest-to-smallest order the lineup itself is laid out in (see main.ts's sizesLineupById)
// so each page's planet is also the one currently nearest the frame's right/Sun-ward edge.
const CHAPTERS: Chapter[] = [
  {
    id: 'lineup',
    title: 'The Solar System, to Scale',
    kind: 'sizes',
    seasonPhaseDegrees: 0,
    text:
      'The Sun and all 8 planets, lined up largest to smallest, at their true relative sizes. ' +
      "The Sun alone holds about 99.8% of the Solar System's mass - it dwarfs even Jupiter, the " +
      "largest planet, which in turn dwarfs Earth. This lineup shows size only, not distance: " +
      "the planets' real spacing (light-hours to light-days apart) would spread them far outside " +
      'any single view. Step through the following pages for each planet\'s own numbers.',
  },
  planetChapter('jupiter', 'Jupiter'),
  planetChapter('saturn', 'Saturn'),
  planetChapter('uranus', 'Uranus'),
  planetChapter('neptune', 'Neptune'),
  planetChapter('earth', 'Earth'),
  planetChapter('venus', 'Venus'),
  planetChapter('mars', 'Mars'),
  planetChapter('mercury', 'Mercury'),
]

export const PLANET_SIZES_LESSON: Lesson = {
  id: 'planetSizes',
  title: 'How big are the planets?',
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by 'sizes' chapters - see lessonTypes.ts's doc comment
}
