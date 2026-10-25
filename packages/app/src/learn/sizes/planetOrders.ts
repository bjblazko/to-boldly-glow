import { PLANETS } from '../../solarSystem/bodies'
import { formatCelsius, formatDistance, formatHours, formatNumber, formatTimesEarth, formatYear, TYPE_NAMES } from './planetFormat'
import { PLANET_STATS, type PlanetStats, type PlanetType } from './planetStats'

const EARTH_GRAVITY_M_PER_S2 = PLANET_STATS.earth.gravityMPerS2
const TYPE_RANKS: Record<PlanetType, number> = { rocky: 0, 'gas giant': 1, 'ice giant': 2 }

// One way to line the planets up: by `key`, first the planet where `key` is the smallest (or the
// largest, `descending`); a tie keeps the planets' order out from the Sun.
export interface PlanetOrder {
  id: string
  // In the Sort menu.
  name: string
  // Under the name in the Sort menu, where the name alone would mislead.
  hint?: string
  key: (stats: PlanetStats, id: string) => number
  descending?: boolean
  // Under each planet's name in the lineup: its value by this order.
  note: (stats: PlanetStats, id: string) => string
}

const siderealYearDays = (id: string) => PLANETS.find((planet) => planet.id === id)!.siderealPeriodDays!

// The first is the lesson's own order.
export const PLANET_ORDERS: PlanetOrder[] = [
  {
    id: 'distance',
    name: 'Out from the Sun',
    key: (stats) => stats.averageDistanceKm,
    note: (stats) => formatDistance(stats.averageDistanceKm),
  },
  {
    id: 'size',
    name: 'Size',
    key: (stats) => stats.diameterKm,
    descending: true,
    note: (stats) => `${formatNumber(stats.diameterKm)} km`,
  },
  {
    id: 'mass',
    name: 'Mass',
    key: (stats) => stats.massEarths,
    descending: true,
    note: (stats) => formatTimesEarth(stats.massEarths),
  },
  {
    id: 'type',
    name: 'Rock, gas or ice',
    key: (stats) => TYPE_RANKS[stats.type],
    note: (stats) => TYPE_NAMES[stats.type],
  },
  {
    id: 'speed',
    name: 'Speed around the Sun',
    hint: 'The closer to the Sun, the faster a planet flies.',
    key: (stats) => stats.orbitalSpeedKmPerS,
    descending: true,
    note: (stats) => `${formatNumber(stats.orbitalSpeedKmPerS, 1)} km/s`,
  },
  {
    id: 'day',
    name: 'Length of a day',
    hint: 'From one sunrise to the next - not the same as one spin.',
    key: (stats) => stats.solarDayHours,
    note: (stats) => formatHours(stats.solarDayHours),
  },
  {
    id: 'year',
    name: 'Length of a year',
    key: (_, id) => siderealYearDays(id),
    note: (_, id) => formatYear(siderealYearDays(id)),
  },
  {
    id: 'temperature',
    name: 'Temperature',
    hint: 'On average. On the giants: at the top of their clouds.',
    key: (stats) => stats.meanTemperatureC,
    descending: true,
    note: (stats) => formatCelsius(stats.meanTemperatureC),
  },
  {
    id: 'density',
    name: 'Density',
    hint: 'Water has 1 g/cm³ - Saturn would float in it.',
    key: (stats) => stats.densityKgPerM3,
    descending: true,
    note: (stats) => `${formatNumber(stats.densityKgPerM3 / 1000, 2)} g/cm³`,
  },
  {
    id: 'gravity',
    name: 'Gravity',
    hint: 'How heavy you would feel. On the giants: at the top of their clouds.',
    key: (stats) => stats.gravityMPerS2,
    descending: true,
    note: (stats) => formatTimesEarth(stats.gravityMPerS2 / EARTH_GRAVITY_M_PER_S2),
  },
  {
    id: 'tilt',
    name: 'Axial tilt',
    hint: 'Over 90°, a planet spins backwards.',
    key: (stats) => stats.axialTiltDegrees,
    note: (stats) => `${formatNumber(stats.axialTiltDegrees, 1)}°`,
  },
]

// The planets' ids in this order.
export function orderedPlanetIds(order: PlanetOrder): string[] {
  const sign = order.descending ? -1 : 1
  const keyOf = (id: string) => order.key(PLANET_STATS[id], id)
  const outFromSun = [...PLANETS].sort((a, b) => PLANET_STATS[a.id].averageDistanceKm - PLANET_STATS[b.id].averageDistanceKm)
  return outFromSun.map((planet) => planet.id).sort((a, b) => sign * (keyOf(a) - keyOf(b)))
}

// Each planet's value by this order, for under its name in the lineup.
export function planetNotes(order: PlanetOrder): Record<string, string> {
  return Object.fromEntries(PLANETS.map((planet) => [planet.id, order.note(PLANET_STATS[planet.id], planet.id)]))
}
