import type { PlanetType } from './planetStats'

const HOURS_PER_DAY = 24
const DAYS_PER_YEAR = 365.25

export const TYPE_NAMES: Record<PlanetType, string> = { rocky: 'Rocky planet', 'gas giant': 'Gas giant', 'ice giant': 'Ice giant' }

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString('en-US', { maximumFractionDigits })
}

export function formatCelsius(value: number): string {
  return `${value < 0 ? '−' : ''}${Math.abs(value)} °C`
}

export function formatDistance(km: number): string {
  return km >= 1e9 ? `${formatNumber(km / 1e9, 2)} billion km` : `${formatNumber(km / 1e6, 1)} million km`
}

// Earth is the yardstick for the others' mass.
export function formatMass(massEarths: number): string {
  return massEarths === 1 ? '5.97 × 10²⁴ kg' : formatTimesEarth(massEarths)
}

export function formatTimesEarth(ratio: number): string {
  return `${ratio.toLocaleString('en-US', { maximumSignificantDigits: 3 })} × Earth`
}

// Hours up to three days, days beyond.
export function formatHours(hours: number): string {
  return hours < 3 * HOURS_PER_DAY ? `${formatNumber(hours, 1)} hours` : `${formatNumber(hours / HOURS_PER_DAY, 1)} days`
}

// Negative rotation periods turn the other way round (see BodyDefinition.siderealRotationHours).
export function formatRotation(hours: number): string {
  const time = formatHours(Math.abs(hours))
  return hours < 0 ? `${time}, backwards` : time
}

export function formatYear(days: number): string {
  return days < 2 * DAYS_PER_YEAR ? `${formatNumber(days)} days` : `${formatNumber(days / DAYS_PER_YEAR, 1)} years`
}
