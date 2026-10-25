import { msg } from '../../i18n/i18n'
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

// The order's name and hint in the Sort menu, from the catalog (an empty hint: none).
function orderText(id: keyof typeof msg.planets.orders): Pick<PlanetOrder, 'name' | 'hint'> {
  const { name, hint } = msg.planets.orders[id]
  return hint ? { name, hint } : { name }
}

const siderealYearDays = (id: string) => PLANETS.find((planet) => planet.id === id)!.siderealPeriodDays!

// The first is the lesson's own order.
export const PLANET_ORDERS: PlanetOrder[] = [
  {
    id: 'distance',
    ...orderText('distance'),
    key: (stats) => stats.averageDistanceKm,
    note: (stats) => formatDistance(stats.averageDistanceKm),
  },
  {
    id: 'size',
    ...orderText('size'),
    key: (stats) => stats.diameterKm,
    descending: true,
    note: (stats) => `${formatNumber(stats.diameterKm)} km`,
  },
  {
    id: 'mass',
    ...orderText('mass'),
    key: (stats) => stats.massEarths,
    descending: true,
    note: (stats) => formatTimesEarth(stats.massEarths),
  },
  {
    id: 'type',
    ...orderText('type'),
    key: (stats) => TYPE_RANKS[stats.type],
    note: (stats) => TYPE_NAMES[stats.type],
  },
  {
    id: 'speed',
    ...orderText('speed'),
    key: (stats) => stats.orbitalSpeedKmPerS,
    descending: true,
    note: (stats) => `${formatNumber(stats.orbitalSpeedKmPerS, 1)} km/s`,
  },
  {
    id: 'day',
    ...orderText('day'),
    key: (stats) => stats.solarDayHours,
    note: (stats) => formatHours(stats.solarDayHours),
  },
  {
    id: 'year',
    ...orderText('year'),
    key: (_, id) => siderealYearDays(id),
    note: (_, id) => formatYear(siderealYearDays(id)),
  },
  {
    id: 'temperature',
    ...orderText('temperature'),
    key: (stats) => stats.meanTemperatureC,
    descending: true,
    note: (stats) => formatCelsius(stats.meanTemperatureC),
  },
  {
    id: 'density',
    ...orderText('density'),
    key: (stats) => stats.densityKgPerM3,
    descending: true,
    note: (stats) => `${formatNumber(stats.densityKgPerM3 / 1000, 2)} g/cm³`,
  },
  {
    id: 'gravity',
    ...orderText('gravity'),
    key: (stats) => stats.gravityMPerS2,
    descending: true,
    note: (stats) => formatTimesEarth(stats.gravityMPerS2 / EARTH_GRAVITY_M_PER_S2),
  },
  {
    id: 'tilt',
    ...orderText('tilt'),
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
