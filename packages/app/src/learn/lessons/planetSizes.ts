import { PLANETS } from '../../solarSystem/bodies'
import type { Chapter, ChapterFact, Lesson, LessonSorting } from '../lessonTypes'
import { formatCelsius, formatDistance, formatMass, formatNumber, formatRotation, formatYear, TYPE_NAMES } from '../sizes/planetFormat'
import { orderedPlanetIds, PLANET_ORDERS, planetNotes, type PlanetOrder } from '../sizes/planetOrders'
import { PLANET_STATS, type Temperature } from '../sizes/planetStats'

function temperatureFact(temperature: Temperature): ChapterFact {
  if ('cloudTopsC' in temperature) return { icon: 'thermometer', label: 'Cloud tops', value: formatCelsius(temperature.cloudTopsC) }
  const { minC, maxC } = temperature
  const value = minC === maxC ? `${formatCelsius(minC)}, day and night` : `${formatCelsius(minC)} to ${formatCelsius(maxC)}`
  return { icon: 'thermometer', label: 'Temperature', value }
}

function planetFacts(id: string): ChapterFact[] {
  const stats = PLANET_STATS[id]
  const body = PLANETS.find((planet) => planet.id === id)!
  return [
    { icon: 'diameter', label: 'Diameter', value: `${formatNumber(stats.diameterKm)} km` },
    { icon: 'circumference', label: 'Circumference', value: `${formatNumber(stats.circumferenceKm)} km` },
    { icon: 'mass', label: 'Mass', value: formatMass(stats.massEarths) },
    { icon: stats.type === 'rocky' ? 'rock' : 'giant', label: 'Type', value: TYPE_NAMES[stats.type] },
    { icon: 'atmosphere', label: 'Atmosphere', value: stats.atmosphere },
    temperatureFact(stats.temperature),
    { icon: 'sun-distance', label: 'From the Sun', value: formatDistance(stats.averageDistanceKm) },
    { icon: 'rotation', label: 'One spin', value: formatRotation(body.siderealRotationHours) },
    { icon: 'orbit', label: 'Year', value: formatYear(body.siderealPeriodDays!) },
  ]
}

function planetChapter(id: string, name: string): Chapter {
  return {
    id,
    title: name,
    kind: 'sizes',
    seasonPhaseDegrees: 0, // unused by 'sizes' chapters - see lessonTypes.ts's doc comment
    text: PLANET_STATS[id].intro,
    facts: planetFacts(id),
    focusPlanetId: id,
  }
}

const LINEUP_CHAPTER: Chapter = {
  id: 'lineup',
  title: 'The Solar System, to Scale',
  kind: 'sizes',
  seasonPhaseDegrees: 0,
  text:
    'The Sun and all 8 planets side by side, at their true relative sizes. ' +
    "The Sun alone holds about 99.8% of the Solar System's mass - it dwarfs even Jupiter, the " +
    "largest planet, which in turn dwarfs Earth. This lineup shows size only, not distance: " +
    "the planets' real spacing (light-hours to light-days apart) would spread them far outside " +
    'any single view. They start in their order out from the Sun; Sort lines them up by size, ' +
    'mass, temperature and more. The following pages fly to each planet in turn, with its own numbers.',
}

const PLANET_CHAPTERS = new Map(PLANETS.map((planet) => [planet.id, planetChapter(planet.id, planet.name)]))

// The lineup itself is laid out in the same order (see sizes/sizesLineup.ts), so the camera moves
// along the row one neighbor at a time.
function sorting(order: PlanetOrder): LessonSorting {
  const chapters = [LINEUP_CHAPTER, ...orderedPlanetIds(order).map((id) => PLANET_CHAPTERS.get(id)!)]
  return { id: order.id, name: order.name, hint: order.hint, chapters, planetNotes: planetNotes(order) }
}

const SORTINGS = PLANET_ORDERS.map(sorting)

export const PLANET_SIZES_LESSON: Lesson = {
  id: 'planetSizes',
  title: 'Get to know the planets',
  chapters: SORTINGS[0].chapters,
  markerLatitudeDegrees: 0, // unused by 'sizes' chapters - see lessonTypes.ts's doc comment
  note: 'Sizes are to scale. Distances are not: the planets are lined up side by side.',
  sortings: SORTINGS,
}
