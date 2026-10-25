import { msg } from '../../i18n/i18n'
import { PLANETS } from '../../solarSystem/bodies'
import type { Chapter, ChapterFact, Lesson, LessonSorting } from '../lessonTypes'
import { formatCelsius, formatDistance, formatMass, formatNumber, formatRotation, formatYear, TYPE_NAMES } from '../sizes/planetFormat'
import { orderedPlanetIds, PLANET_ORDERS, planetNotes, type PlanetOrder } from '../sizes/planetOrders'
import { PLANET_STATS, type Temperature } from '../sizes/planetStats'

const TEXT = msg.lessons.planetSizes
const FACTS = msg.planets.facts
const UNITS = msg.planets.units

function temperatureFact(temperature: Temperature): ChapterFact {
  if ('cloudTopsC' in temperature) return { icon: 'thermometer', label: FACTS.cloudTops, value: formatCelsius(temperature.cloudTopsC) }
  const { minC, maxC } = temperature
  const value = minC === maxC ? UNITS.dayAndNight(formatCelsius(minC)) : UNITS.range(formatCelsius(minC), formatCelsius(maxC))
  return { icon: 'thermometer', label: FACTS.temperature, value }
}

function planetFacts(id: string): ChapterFact[] {
  const stats = PLANET_STATS[id]
  const body = PLANETS.find((planet) => planet.id === id)!
  return [
    { icon: 'diameter', label: FACTS.diameter, value: `${formatNumber(stats.diameterKm)} km` },
    { icon: 'circumference', label: FACTS.circumference, value: `${formatNumber(stats.circumferenceKm)} km` },
    { icon: 'mass', label: FACTS.mass, value: formatMass(stats.massEarths) },
    { icon: stats.type === 'rocky' ? 'rock' : 'giant', label: FACTS.type, value: TYPE_NAMES[stats.type] },
    { icon: 'atmosphere', label: FACTS.atmosphere, value: msg.planets.atmospheres[id] },
    temperatureFact(stats.temperature),
    { icon: 'sun-distance', label: FACTS.fromSun, value: formatDistance(stats.averageDistanceKm) },
    { icon: 'rotation', label: FACTS.spin, value: formatRotation(body.siderealRotationHours) },
    { icon: 'orbit', label: FACTS.year, value: formatYear(body.siderealPeriodDays!) },
  ]
}

function planetChapter(id: string, name: string): Chapter {
  return {
    id,
    title: name,
    kind: 'sizes',
    seasonPhaseDegrees: 0, // unused by 'sizes' chapters - see lessonTypes.ts's doc comment
    text: msg.planets.intros[id],
    facts: planetFacts(id),
    focusPlanetId: id,
  }
}

const LINEUP_CHAPTER: Chapter = {
  id: 'lineup',
  ...TEXT.lineup,
  kind: 'sizes',
  seasonPhaseDegrees: 0,
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
  title: TEXT.title,
  chapters: SORTINGS[0].chapters,
  markerLatitudeDegrees: 0, // unused by 'sizes' chapters - see lessonTypes.ts's doc comment
  note: TEXT.note,
  sortings: SORTINGS,
}
