import { PLANETS } from '../../solarSystem/bodies'
import type { Chapter, ChapterFact, Lesson } from '../lessonTypes'

type PlanetType = 'rocky' | 'gas giant' | 'ice giant'

// Seen from the ground on the rocky planets: the coldest and hottest it gets. The giants have no
// ground, so theirs is the temperature at the top of their clouds (where the pressure is Earth's at
// sea level).
type Temperature = { minC: number; maxC: number } | { cloudTopsC: number }

// Diameter/circumference derived from bodies.ts's own radiusKm (2*radiusKm, and pi*diameter -
// circumference isn't otherwise stored anywhere in the data pipeline). How long a planet takes to
// spin and to go around the Sun comes from bodies.ts too (see planetFacts). Everything else is from
// the NASA Planetary Fact Sheet (average Sun distance: semi-major axis; mass: ratio to Earth's;
// temperatures of the giants: at 1 bar), matching the sourcing convention documented on
// BodyDefinition's own fields in bodies.ts; the rocky planets' coldest and hottest are from NASA's
// planet pages (Earth's: the measured records).
interface PlanetStats {
  diameterKm: number
  circumferenceKm: number
  averageDistanceKm: number
  massEarths: number
  type: PlanetType
  atmosphere: string
  temperature: Temperature
  // A sentence or two on what sets the planet apart, above its numbers.
  intro: string
}

const PLANET_STATS: Record<string, PlanetStats> = {
  mercury: {
    diameterKm: 4_879,
    circumferenceKm: 15_329,
    averageDistanceKm: 57_909_050,
    massEarths: 0.0553,
    type: 'rocky',
    atmosphere: 'No - only traces',
    temperature: { minC: -180, maxC: 430 },
    intro:
      'The smallest planet and the closest to the Sun. With almost no air to hold the heat, its days ' +
      'are scorching and its nights freezing.',
  },
  venus: {
    diameterKm: 12_104,
    circumferenceKm: 38_025,
    averageDistanceKm: 108_208_000,
    massEarths: 0.815,
    type: 'rocky',
    atmosphere: 'Yes, very thick: CO₂',
    temperature: { minC: 464, maxC: 464 },
    intro:
      "Nearly Earth's twin in size, but its thick air traps so much heat that it is the hottest " +
      'planet - hotter even than Mercury, which is closer to the Sun.',
  },
  earth: {
    diameterKm: 12_742,
    circumferenceKm: 40_030,
    averageDistanceKm: 149_598_023,
    massEarths: 1,
    type: 'rocky',
    atmosphere: 'Yes: nitrogen, oxygen',
    temperature: { minC: -89, maxC: 57 },
    intro: 'Our home, and the largest of the four rocky planets - the only world known to have oceans on its surface, and life.',
  },
  mars: {
    diameterKm: 6_779,
    circumferenceKm: 21_297,
    averageDistanceKm: 227_939_200,
    massEarths: 0.107,
    type: 'rocky',
    atmosphere: 'Yes, thin: CO₂',
    temperature: { minC: -153, maxC: 20 },
    intro: 'The red planet, about half as wide as Earth: rusty dust colors it red, and it has the tallest volcano in the Solar System.',
  },
  jupiter: {
    diameterKm: 139_822,
    circumferenceKm: 439_264,
    averageDistanceKm: 778_570_000,
    massEarths: 317.8,
    type: 'gas giant',
    atmosphere: 'Yes: hydrogen, helium',
    temperature: { cloudTopsC: -110 },
    intro: 'The largest planet, more than twice as massive as all the others together. A gas giant: it has no solid surface to stand on.',
  },
  saturn: {
    diameterKm: 116_464,
    circumferenceKm: 365_882,
    averageDistanceKm: 1_433_530_000,
    massEarths: 95.2,
    type: 'gas giant',
    atmosphere: 'Yes: hydrogen, helium',
    temperature: { cloudTopsC: -140 },
    intro: 'The ringed planet. Its rings are about 280,000 km across but mostly only about 10 meters thick - and Saturn itself is so light it would float in water.',
  },
  uranus: {
    diameterKm: 50_724,
    circumferenceKm: 159_354,
    averageDistanceKm: 2_872_460_000,
    massEarths: 14.5,
    type: 'ice giant',
    atmosphere: 'Yes: hydrogen, helium, methane',
    temperature: { cloudTopsC: -195 },
    intro: 'An ice giant that rolls around the Sun on its side: its axis is tipped over by 98°, so each pole has 42 years of day, then 42 years of night.',
  },
  neptune: {
    diameterKm: 49_244,
    circumferenceKm: 154_705,
    averageDistanceKm: 4_495_060_000,
    massEarths: 17.1,
    type: 'ice giant',
    atmosphere: 'Yes: hydrogen, helium, methane',
    temperature: { cloudTopsC: -200 },
    intro: 'The farthest planet: an ice giant with the fastest winds in the Solar System, up to 2,000 km/h. Sunlight takes over four hours to get there.',
  },
}

const HOURS_PER_DAY = 24
const DAYS_PER_YEAR = 365.25

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString('en-US', { maximumFractionDigits })
}

function formatCelsius(value: number): string {
  return `${value < 0 ? '−' : ''}${Math.abs(value)} °C`
}

function temperatureFact(temperature: Temperature): ChapterFact {
  if ('cloudTopsC' in temperature) return { icon: 'thermometer', label: 'Cloud tops', value: formatCelsius(temperature.cloudTopsC) }
  const { minC, maxC } = temperature
  const value = minC === maxC ? `${formatCelsius(minC)}, day and night` : `${formatCelsius(minC)} to ${formatCelsius(maxC)}`
  return { icon: 'thermometer', label: 'Temperature', value }
}

function formatDistance(km: number): string {
  return km >= 1e9 ? `${formatNumber(km / 1e9, 2)} billion km` : `${formatNumber(km / 1e6, 1)} million km`
}

// Earth is the yardstick for the others' mass.
function formatMass(massEarths: number): string {
  return massEarths === 1 ? '5.97 × 10²⁴ kg' : `${massEarths.toLocaleString('en-US', { maximumSignificantDigits: 3 })} × Earth`
}

// Negative rotation periods turn the other way round (see BodyDefinition.siderealRotationHours).
function formatRotation(hours: number): string {
  const length = Math.abs(hours)
  const time = length < 3 * HOURS_PER_DAY ? `${formatNumber(length, 1)} hours` : `${formatNumber(length / HOURS_PER_DAY, 1)} days`
  return hours < 0 ? `${time}, backwards` : time
}

function formatYear(days: number): string {
  return days < 2 * DAYS_PER_YEAR ? `${formatNumber(days)} days` : `${formatNumber(days / DAYS_PER_YEAR, 1)} years`
}

const TYPE_NAMES: Record<PlanetType, string> = { rocky: 'Rocky planet', 'gas giant': 'Gas giant', 'ice giant': 'Ice giant' }

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

// Same largest-to-smallest order the lineup itself is laid out in (see sizes/sizesLineup.ts), so
// the camera moves along the row one neighbor at a time.
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
      'any single view. The following pages fly to each planet in turn, with its own numbers.',
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
  title: 'Get to know the planets',
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by 'sizes' chapters - see lessonTypes.ts's doc comment
  note: 'Sizes are to scale. Distances are not: the planets are lined up side by side.',
}
