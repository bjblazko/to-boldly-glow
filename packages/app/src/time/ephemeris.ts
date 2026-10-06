import { daysSinceJ2000, julianMillenniaSinceJ2000 } from '@toboldlyglow/engine'
import { currentJulianDay } from './simulationClock'

// The two time arguments the orbital mechanics need for a simulated date: Julian millennia since
// J2000 (VSOP87 planet positions) and days since J2000 (spin and moon-orbit angles).
export interface Ephemeris {
  julianMillennia: number
  daysSinceEpoch: number
}

export function ephemerisAt(date: Date): Ephemeris {
  const julianDay = currentJulianDay(date)
  return { julianMillennia: julianMillenniaSinceJ2000(julianDay), daysSinceEpoch: daysSinceJ2000(julianDay) }
}
