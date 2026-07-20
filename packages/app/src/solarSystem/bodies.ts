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
  /** Hand-picked radius (scene units) at the fully-"compact" end of the scale toggle. */
  compactVisualRadius: number
  /**
   * Sidereal orbital period in days. Source: NASA Planetary Fact Sheet. Used only to sample one
   * full orbit for the orbit-path line (Task 5) — not used for body positioning, which comes
   * from VSOP87 via `position` below.
   */
  siderealPeriodDays: number | null
  position: HeliocentricPosition | null
  /** Path (under public/) to a 2K equirectangular albedo texture. See CREDITS.md for sourcing. */
  textureUrl: string
  /**
   * Axial rotation period, hours. Source: NASA Planetary Fact Sheet. Negative means retrograde
   * (spins opposite its orbital direction — Venus and, due to its extreme axial tilt, Uranus).
   * Drives the body's own spin around its local Z axis (see poleOrientation.ts - tilt happens on
   * top of this spin, not instead of it); unrelated to siderealPeriodDays (orbital motion) above.
   * This sign is independent of poleRightAscensionDegrees/poleDeclinationDegrees below - tilt
   * magnitude does NOT reliably indicate spin direction (IAU's own published pole for Uranus
   * derives a tilt under 90° despite Uranus's rotation being genuinely retrograde relative to it -
   * see the design spec §3), so this field keeps carrying that fact explicitly.
   */
  siderealRotationHours: number
  /**
   * North pole right ascension and declination, degrees, J2000 equatorial (ICRF) frame, as
   * published by the IAU Working Group on Cartographic Coordinates and Rotational Elements
   * (WGCCRE). Converted to an ecliptic-frame direction vector by
   * poleOrientation.ts's equatorialToEclipticPoleDirection, then used to tilt the body's spin
   * axis (and, for Saturn, its ring) into its real 3D orientation.
   */
  poleRightAscensionDegrees: number
  poleDeclinationDegrees: number
}

/** 1 astronomical unit, kilometers (IAU-defined exact value). */
export const AU_KM = 149_597_870.7

export const SUN: BodyDefinition = {
  id: 'sun',
  name: 'Sun',
  color: [1.0, 0.9, 0.6],
  radiusKm: 696_000,
  compactVisualRadius: 3,
  siderealPeriodDays: null,
  position: null,
  textureUrl: '/textures/sun.jpg',
  siderealRotationHours: 609.12,
  poleRightAscensionDegrees: 286.13,
  poleDeclinationDegrees: 63.87,
}

export const PLANETS: BodyDefinition[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    color: [0.65, 0.65, 0.65],
    radiusKm: 2439.7,
    compactVisualRadius: 0.4,
    siderealPeriodDays: 87.969,
    position: {
      longitude: mercuryHeliocentricL,
      latitude: mercuryHeliocentricB,
      distance: mercuryHeliocentricR,
    },
    textureUrl: '/textures/mercury.jpg',
    siderealRotationHours: 1407.6,
    poleRightAscensionDegrees: 281.01,
    poleDeclinationDegrees: 61.41,
  },
  {
    id: 'venus',
    name: 'Venus',
    color: [0.9, 0.8, 0.6],
    radiusKm: 6051.8,
    compactVisualRadius: 0.9,
    siderealPeriodDays: 224.701,
    position: { longitude: venusHeliocentricL, latitude: venusHeliocentricB, distance: venusHeliocentricR },
    textureUrl: '/textures/venus.jpg',
    siderealRotationHours: -5832.5,
    poleRightAscensionDegrees: 92.76,
    poleDeclinationDegrees: -67.16,
  },
  {
    id: 'earth',
    name: 'Earth',
    color: [0.25, 0.45, 0.75],
    radiusKm: 6371.0,
    compactVisualRadius: 1.0,
    siderealPeriodDays: 365.256,
    position: { longitude: earthHeliocentricL, latitude: earthHeliocentricB, distance: earthHeliocentricR },
    textureUrl: '/textures/earth.jpg',
    siderealRotationHours: 23.9345,
    poleRightAscensionDegrees: 0,
    poleDeclinationDegrees: 90,
  },
  {
    id: 'mars',
    name: 'Mars',
    color: [0.75, 0.35, 0.2],
    radiusKm: 3389.5,
    compactVisualRadius: 0.55,
    siderealPeriodDays: 686.98,
    position: { longitude: marsHeliocentricL, latitude: marsHeliocentricB, distance: marsHeliocentricR },
    textureUrl: '/textures/mars.jpg',
    siderealRotationHours: 24.6229,
    poleRightAscensionDegrees: 317.68,
    poleDeclinationDegrees: 52.89,
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    color: [0.8, 0.7, 0.55],
    radiusKm: 69_911,
    compactVisualRadius: 2.2,
    siderealPeriodDays: 4332.59,
    position: {
      longitude: jupiterHeliocentricL,
      latitude: jupiterHeliocentricB,
      distance: jupiterHeliocentricR,
    },
    textureUrl: '/textures/jupiter.jpg',
    siderealRotationHours: 9.925,
    poleRightAscensionDegrees: 268.06,
    poleDeclinationDegrees: 64.50,
  },
  {
    id: 'saturn',
    name: 'Saturn',
    color: [0.85, 0.75, 0.55],
    radiusKm: 58_232,
    compactVisualRadius: 1.9,
    siderealPeriodDays: 10_759.22,
    position: { longitude: saturnHeliocentricL, latitude: saturnHeliocentricB, distance: saturnHeliocentricR },
    textureUrl: '/textures/saturn.jpg',
    siderealRotationHours: 10.656,
    poleRightAscensionDegrees: 40.59,
    poleDeclinationDegrees: 83.54,
  },
  {
    id: 'uranus',
    name: 'Uranus',
    color: [0.6, 0.85, 0.9],
    radiusKm: 25_362,
    compactVisualRadius: 1.3,
    siderealPeriodDays: 30_688.5,
    position: { longitude: uranusHeliocentricL, latitude: uranusHeliocentricB, distance: uranusHeliocentricR },
    textureUrl: '/textures/uranus.jpg',
    siderealRotationHours: -17.24,
    poleRightAscensionDegrees: 257.31,
    poleDeclinationDegrees: -15.18,
  },
  {
    id: 'neptune',
    name: 'Neptune',
    color: [0.25, 0.4, 0.9],
    radiusKm: 24_622,
    compactVisualRadius: 1.25,
    siderealPeriodDays: 60_182.0,
    position: {
      longitude: neptuneHeliocentricL,
      latitude: neptuneHeliocentricB,
      distance: neptuneHeliocentricR,
    },
    textureUrl: '/textures/neptune.jpg',
    siderealRotationHours: 16.11,
    poleRightAscensionDegrees: 299.33,
    poleDeclinationDegrees: 42.95,
  },
]
