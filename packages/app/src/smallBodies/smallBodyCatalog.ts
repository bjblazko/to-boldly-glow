import type { Rgb } from '../math/tuples'
import { fromPerihelion, type OrbitalElements } from './keplerOrbit'

export type SmallBodyKind = 'comet' | 'dwarfPlanet' | 'asteroid'

export interface SmallBodyDefinition {
  id: string
  name: string
  kind: SmallBodyKind
  orbit: OrbitalElements
  // Nucleus or body radius, kilometers.
  radiusKm: number
  // Radius (scene units) at the fully-Compact end of the scale toggle - as for the planets, what
  // the camera frames when it flies there. A comet is framed by its coma, far larger than its
  // nucleus.
  compactVisualRadius: number
  color: Rgb
}

// The asteroid shader draws minor planets at this Compact radius per sqrt(km) (see asteroidBelt.ts).
export const COMPACT_SIZE_PER_SQRT_KM = 0.004
const COMET_COMPACT_RADIUS = 0.12

// Osculating elements, J2000 ecliptic, rounded from the JPL Small-Body Database and the Minor
// Planet Center (comets at their perihelion passage, minor planets at a recent epoch).
const comet = (id: string, name: string, radiusKm: number, orbit: OrbitalElements): SmallBodyDefinition => ({
  id,
  name,
  kind: 'comet',
  orbit,
  radiusKm,
  compactVisualRadius: COMET_COMPACT_RADIUS,
  color: [0.75, 0.82, 0.9],
})

export const COMETS: readonly SmallBodyDefinition[] = [
  comet('halley', "Halley's Comet", 5.5, fromPerihelion(0.586, 0.96714, { inclinationDegrees: 162.26, ascendingNodeDegrees: 58.42, perihelionArgumentDegrees: 111.33 }, '1986-02-09T11:00Z')),
  // Due back at perihelion on 10 February 2027: brightening in the default (present-day) sky.
  comet('encke', 'Comet Encke', 2.4, fromPerihelion(0.339, 0.8471, { inclinationDegrees: 11.34, ascendingNodeDegrees: 334.01, perihelionArgumentDegrees: 187.28 }, '2027-02-10T00:00Z')),
  comet('churyumov-gerasimenko', '67P/Churyumov–Gerasimenko', 2, fromPerihelion(1.211, 0.6497, { inclinationDegrees: 3.87, ascendingNodeDegrees: 36.33, perihelionArgumentDegrees: 22.13 }, '2021-11-02T02:00Z')),
  comet('hale-bopp', 'Comet Hale–Bopp', 30, fromPerihelion(0.914, 0.995, { inclinationDegrees: 89.43, ascendingNodeDegrees: 282.47, perihelionArgumentDegrees: 130.59 }, '1997-04-01T03:00Z')),
  comet('swift-tuttle', 'Comet Swift–Tuttle', 13, fromPerihelion(0.9595, 0.9632, { inclinationDegrees: 113.45, ascendingNodeDegrees: 139.38, perihelionArgumentDegrees: 152.98 }, '1992-12-11T22:00Z')),
  comet('pons-brooks', 'Comet Pons–Brooks', 15, fromPerihelion(0.7808, 0.9548, { inclinationDegrees: 74.19, ascendingNodeDegrees: 255.86, perihelionArgumentDegrees: 198.99 }, '2024-04-21T03:00Z')),
  comet('neowise', 'Comet NEOWISE', 2.5, fromPerihelion(0.2946, 0.9992, { inclinationDegrees: 128.94, ascendingNodeDegrees: 61.01, perihelionArgumentDegrees: 37.28 }, '2020-07-03T16:00Z')),
]

const minorPlanet = (definition: Omit<SmallBodyDefinition, 'orbit' | 'compactVisualRadius'>, semiMajorAxisAu: number, elements: Omit<OrbitalElements, 'semiMajorAxisAu' | 'perihelionDaysSinceJ2000'>, perihelionDate: string): SmallBodyDefinition => {
  const { perihelionDaysSinceJ2000 } = fromPerihelion(1, 0, { inclinationDegrees: 0, ascendingNodeDegrees: 0, perihelionArgumentDegrees: 0 }, perihelionDate)
  const compactVisualRadius = COMPACT_SIZE_PER_SQRT_KM * Math.sqrt(definition.radiusKm)
  return { ...definition, compactVisualRadius, orbit: { semiMajorAxisAu, ...elements, perihelionDaysSinceJ2000 } }
}

export const MINOR_PLANETS: readonly SmallBodyDefinition[] = [
  minorPlanet({ id: 'ceres', name: 'Ceres', kind: 'dwarfPlanet', radiusKm: 470, color: [0.62, 0.6, 0.57] }, 2.7675, { eccentricity: 0.0785, inclinationDegrees: 10.59, ascendingNodeDegrees: 80.3, perihelionArgumentDegrees: 73.6 }, '2022-12-07T00:00Z'),
  minorPlanet({ id: 'vesta', name: 'Vesta', kind: 'asteroid', radiusKm: 263, color: [0.72, 0.68, 0.62] }, 2.3615, { eccentricity: 0.0894, inclinationDegrees: 7.14, ascendingNodeDegrees: 103.71, perihelionArgumentDegrees: 151.66 }, '2021-12-26T00:00Z'),
  minorPlanet({ id: 'pallas', name: 'Pallas', kind: 'asteroid', radiusKm: 256, color: [0.6, 0.6, 0.62] }, 2.7724, { eccentricity: 0.2302, inclinationDegrees: 34.93, ascendingNodeDegrees: 172.9, perihelionArgumentDegrees: 310.9 }, '2023-03-07T00:00Z'),
  minorPlanet({ id: 'pluto', name: 'Pluto', kind: 'dwarfPlanet', radiusKm: 1188, color: [0.85, 0.75, 0.62] }, 39.482, { eccentricity: 0.2488, inclinationDegrees: 17.16, ascendingNodeDegrees: 110.3, perihelionArgumentDegrees: 113.83 }, '1989-09-05T00:00Z'),
]

export const SMALL_BODIES: readonly SmallBodyDefinition[] = [...COMETS, ...MINOR_PLANETS]
