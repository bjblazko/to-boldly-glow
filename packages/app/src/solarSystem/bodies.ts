import {
  earthHeliocentricB, earthHeliocentricL, earthHeliocentricR,
  jupiterHeliocentricB, jupiterHeliocentricL, jupiterHeliocentricR,
  marsHeliocentricB, marsHeliocentricL, marsHeliocentricR,
  mercuryHeliocentricB, mercuryHeliocentricL, mercuryHeliocentricR,
  neptuneHeliocentricB, neptuneHeliocentricL, neptuneHeliocentricR,
  saturnHeliocentricB, saturnHeliocentricL, saturnHeliocentricR,
  uranusHeliocentricB, uranusHeliocentricL, uranusHeliocentricR,
  venusHeliocentricB, venusHeliocentricL, venusHeliocentricR,
} from '@toboldlyglow/engine'

export interface HeliocentricPosition {
  longitude: (T: number) => number
  latitude: (T: number) => number
  distance: (T: number) => number
}

export interface BodyDefinition {
  id: string
  name: string
  /** Approximate/illustrative color, not photometrically calibrated. */
  color: [number, number, number]
  /** True equatorial radius, kilometers. Source: NASA Planetary Fact Sheet. */
  radiusKm: number
  /** Hand-picked radius (scene units) at the fully-"explorer" end of the scale slider. */
  explorerVisualRadius: number
  /**
   * Sidereal orbital period in days. Source: NASA Planetary Fact Sheet. Used only to sample one
   * full orbit for the orbit-path line (Task 5) — not used for body positioning, which comes
   * from VSOP87 via `position` below.
   */
  siderealPeriodDays: number | null
  position: HeliocentricPosition | null
}

/** 1 astronomical unit, kilometers (IAU-defined exact value). */
export const AU_KM = 149_597_870.7

export const SUN: BodyDefinition = {
  id: 'sun',
  name: 'Sun',
  color: [1.0, 0.9, 0.6],
  radiusKm: 696_000,
  explorerVisualRadius: 3,
  siderealPeriodDays: null,
  position: null,
}

export const PLANETS: BodyDefinition[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    color: [0.65, 0.65, 0.65],
    radiusKm: 2439.7,
    explorerVisualRadius: 0.4,
    siderealPeriodDays: 87.969,
    position: {
      longitude: mercuryHeliocentricL,
      latitude: mercuryHeliocentricB,
      distance: mercuryHeliocentricR,
    },
  },
  {
    id: 'venus',
    name: 'Venus',
    color: [0.9, 0.8, 0.6],
    radiusKm: 6051.8,
    explorerVisualRadius: 0.9,
    siderealPeriodDays: 224.701,
    position: { longitude: venusHeliocentricL, latitude: venusHeliocentricB, distance: venusHeliocentricR },
  },
  {
    id: 'earth',
    name: 'Earth',
    color: [0.25, 0.45, 0.75],
    radiusKm: 6371.0,
    explorerVisualRadius: 1.0,
    siderealPeriodDays: 365.256,
    position: { longitude: earthHeliocentricL, latitude: earthHeliocentricB, distance: earthHeliocentricR },
  },
  {
    id: 'mars',
    name: 'Mars',
    color: [0.75, 0.35, 0.2],
    radiusKm: 3389.5,
    explorerVisualRadius: 0.55,
    siderealPeriodDays: 686.98,
    position: { longitude: marsHeliocentricL, latitude: marsHeliocentricB, distance: marsHeliocentricR },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    color: [0.8, 0.7, 0.55],
    radiusKm: 69_911,
    explorerVisualRadius: 2.2,
    siderealPeriodDays: 4332.59,
    position: {
      longitude: jupiterHeliocentricL,
      latitude: jupiterHeliocentricB,
      distance: jupiterHeliocentricR,
    },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    color: [0.85, 0.75, 0.55],
    radiusKm: 58_232,
    explorerVisualRadius: 1.9,
    siderealPeriodDays: 10_759.22,
    position: { longitude: saturnHeliocentricL, latitude: saturnHeliocentricB, distance: saturnHeliocentricR },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    color: [0.6, 0.85, 0.9],
    radiusKm: 25_362,
    explorerVisualRadius: 1.3,
    siderealPeriodDays: 30_688.5,
    position: { longitude: uranusHeliocentricL, latitude: uranusHeliocentricB, distance: uranusHeliocentricR },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    color: [0.25, 0.4, 0.9],
    radiusKm: 24_622,
    explorerVisualRadius: 1.25,
    siderealPeriodDays: 60_182.0,
    position: {
      longitude: neptuneHeliocentricL,
      latitude: neptuneHeliocentricB,
      distance: neptuneHeliocentricR,
    },
  },
]
