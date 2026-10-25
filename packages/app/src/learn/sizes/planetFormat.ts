import { formatNumber, formatSignificant, msg } from '../../i18n/i18n'
import type { PlanetType } from './planetStats'

export { formatNumber } from '../../i18n/i18n'

const HOURS_PER_DAY = 24
const DAYS_PER_YEAR = 365.25
const UNITS = msg.planets.units

export const TYPE_NAMES: Record<PlanetType, string> = {
  rocky: msg.planets.types.rocky,
  'gas giant': msg.planets.types.gasGiant,
  'ice giant': msg.planets.types.iceGiant,
}

export function formatCelsius(value: number): string {
  return `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value))} °C`
}

export function formatDistance(km: number): string {
  return km >= 1e9 ? UNITS.billionKm(formatNumber(km / 1e9, 2)) : UNITS.millionKm(formatNumber(km / 1e6, 1))
}

// Earth is the yardstick for the others' mass.
export function formatMass(massEarths: number): string {
  return massEarths === 1 ? `${formatNumber(5.97, 2)} × 10²⁴ kg` : formatTimesEarth(massEarths)
}

export function formatTimesEarth(ratio: number): string {
  return UNITS.timesEarth(formatSignificant(ratio, 3))
}

// Hours up to three days, days beyond.
export function formatHours(hours: number): string {
  return hours < 3 * HOURS_PER_DAY ? UNITS.hours(formatNumber(hours, 1)) : UNITS.days(formatNumber(hours / HOURS_PER_DAY, 1))
}

// Negative rotation periods turn the other way round (see BodyDefinition.siderealRotationHours).
export function formatRotation(hours: number): string {
  const time = formatHours(Math.abs(hours))
  return hours < 0 ? UNITS.backwards(time) : time
}

export function formatYear(days: number): string {
  return days < 2 * DAYS_PER_YEAR ? UNITS.days(formatNumber(days)) : UNITS.years(formatNumber(days / DAYS_PER_YEAR, 1))
}
