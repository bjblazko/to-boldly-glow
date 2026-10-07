// The nebulae, galaxies and star clouds painted into the sky backdrop: what long-exposure
// photographs of the night sky show beyond the stars. Positions are real (J2000 right ascension
// and declination, mostly from the NGC/IC, Sharpless and Lynds catalogs as listed by SIMBAD);
// sizes, shapes and brightnesses are the painter's, chosen to look like a wide-field photograph
// rather than measured.

// emission: a glowing gas cloud (hydrogen-alpha red, oxygen-III teal); reflection: dust lit by a
// nearby star (blue); galaxy: a galaxy's integrated starlight; starCloud: an unusually dense
// stretch of the Milky Way; dark: a dust cloud blotting out the light behind it; shell: the rim
// of a bubble blown by a supernova or massive stars.
export type DeepSkyKind = 'emission' | 'reflection' | 'galaxy' | 'starCloud' | 'dark' | 'shell'

export interface DeepSkyObject {
  name: string
  kind: DeepSkyKind
  raHours: number
  decDegrees: number
  // Half the apparent extent along the major axis, degrees.
  radiusDegrees: number
  // Minor-to-major axis ratio (1 = round) and the major axis's position angle, east of north.
  axisRatio?: number
  positionAngleDegrees?: number
  // Display-space color (sRGB 0..1) at full brightness; for dark clouds, the optical depth.
  color: [number, number, number]
  brightness: number
  // Shells only: the rim's thickness relative to its radius, and which side shows (an arc).
  rimWidth?: number
  arcDirectionDegrees?: number
}

const HYDROGEN_ALPHA: [number, number, number] = [1, 0.32, 0.42]
const OXYGEN_TEAL: [number, number, number] = [0.55, 0.95, 0.9]
const REFLECTION_BLUE: [number, number, number] = [0.45, 0.62, 1]
const STARLIGHT: [number, number, number] = [1, 0.93, 0.82]
const DUST: [number, number, number] = [1, 1, 1]

export const DEEP_SKY_OBJECTS: readonly DeepSkyObject[] = [
  // Orion
  { name: 'Orion Nebula (M42)', kind: 'emission', raHours: 5.588, decDegrees: -5.39, radiusDegrees: 0.55, axisRatio: 0.8, color: HYDROGEN_ALPHA, brightness: 0.55 },
  { name: 'Orion Nebula core', kind: 'emission', raHours: 5.588, decDegrees: -5.4, radiusDegrees: 0.12, color: OXYGEN_TEAL, brightness: 0.45 },
  { name: 'Running Man (NGC 1977)', kind: 'reflection', raHours: 5.59, decDegrees: -4.83, radiusDegrees: 0.22, color: REFLECTION_BLUE, brightness: 0.18 },
  { name: 'Flame Nebula (NGC 2024)', kind: 'emission', raHours: 5.693, decDegrees: -1.85, radiusDegrees: 0.2, color: [1, 0.55, 0.35], brightness: 0.2 },
  { name: 'IC 434 (Horsehead)', kind: 'emission', raHours: 5.68, decDegrees: -2.45, radiusDegrees: 0.6, axisRatio: 0.25, positionAngleDegrees: 0, color: HYDROGEN_ALPHA, brightness: 0.12 },
  { name: "Barnard's Loop", kind: 'shell', raHours: 5.45, decDegrees: -3.5, radiusDegrees: 6.5, axisRatio: 0.9, color: HYDROGEN_ALPHA, brightness: 0.09, rimWidth: 0.12, arcDirectionDegrees: 90 },
  { name: 'Lambda Orionis Ring', kind: 'shell', raHours: 5.58, decDegrees: 9.93, radiusDegrees: 4.2, color: HYDROGEN_ALPHA, brightness: 0.05, rimWidth: 0.25 },
  { name: 'Rosette Nebula', kind: 'shell', raHours: 6.5625, decDegrees: 4.98, radiusDegrees: 0.55, color: HYDROGEN_ALPHA, brightness: 0.22, rimWidth: 0.5 },
  // Taurus, Perseus, Cassiopeia
  { name: 'Pleiades (M45)', kind: 'reflection', raHours: 3.79, decDegrees: 24.12, radiusDegrees: 0.8, color: REFLECTION_BLUE, brightness: 0.2 },
  { name: 'California Nebula', kind: 'emission', raHours: 4.055, decDegrees: 36.42, radiusDegrees: 1.3, axisRatio: 0.3, positionAngleDegrees: 125, color: HYDROGEN_ALPHA, brightness: 0.12 },
  { name: 'Heart Nebula', kind: 'emission', raHours: 2.556, decDegrees: 61.43, radiusDegrees: 0.75, color: HYDROGEN_ALPHA, brightness: 0.12 },
  { name: 'Soul Nebula', kind: 'emission', raHours: 2.85, decDegrees: 60.43, radiusDegrees: 0.75, axisRatio: 0.7, color: HYDROGEN_ALPHA, brightness: 0.1 },
  { name: 'Simeis 147', kind: 'shell', raHours: 5.65, decDegrees: 28, radiusDegrees: 1.5, color: HYDROGEN_ALPHA, brightness: 0.05, rimWidth: 0.35 },
  { name: 'Taurus Molecular Cloud', kind: 'dark', raHours: 4.5, decDegrees: 26, radiusDegrees: 5, axisRatio: 0.6, positionAngleDegrees: 120, color: DUST, brightness: 0.9 },
  // Cygnus
  { name: 'North America Nebula', kind: 'emission', raHours: 20.988, decDegrees: 44.52, radiusDegrees: 1.2, axisRatio: 0.85, color: HYDROGEN_ALPHA, brightness: 0.24 },
  { name: 'Pelican Nebula', kind: 'emission', raHours: 20.847, decDegrees: 44.35, radiusDegrees: 0.55, color: HYDROGEN_ALPHA, brightness: 0.14 },
  { name: 'Sadr Region (IC 1318)', kind: 'emission', raHours: 20.37, decDegrees: 40.25, radiusDegrees: 2.2, axisRatio: 0.7, positionAngleDegrees: 45, color: HYDROGEN_ALPHA, brightness: 0.1 },
  { name: 'Veil Nebula', kind: 'shell', raHours: 20.85, decDegrees: 30.67, radiusDegrees: 1.5, axisRatio: 0.85, color: OXYGEN_TEAL, brightness: 0.1, rimWidth: 0.18 },
  { name: 'Cygnus Star Cloud', kind: 'starCloud', raHours: 20.0, decDegrees: 36, radiusDegrees: 3.5, axisRatio: 0.6, positionAngleDegrees: 30, color: STARLIGHT, brightness: 0.07 },
  // Sagittarius, Scutum, Scorpius, Ophiuchus
  { name: 'Lagoon Nebula (M8)', kind: 'emission', raHours: 18.06, decDegrees: -24.38, radiusDegrees: 0.6, axisRatio: 0.55, positionAngleDegrees: 90, color: HYDROGEN_ALPHA, brightness: 0.4 },
  { name: 'Trifid Nebula (M20)', kind: 'emission', raHours: 18.04, decDegrees: -23.03, radiusDegrees: 0.2, color: [1, 0.45, 0.6], brightness: 0.3 },
  { name: 'Eagle Nebula (M16)', kind: 'emission', raHours: 18.313, decDegrees: -13.82, radiusDegrees: 0.35, color: HYDROGEN_ALPHA, brightness: 0.26 },
  { name: 'Omega Nebula (M17)', kind: 'emission', raHours: 18.34, decDegrees: -16.17, radiusDegrees: 0.22, axisRatio: 0.6, color: HYDROGEN_ALPHA, brightness: 0.28 },
  { name: 'Small Sagittarius Star Cloud (M24)', kind: 'starCloud', raHours: 18.28, decDegrees: -18.5, radiusDegrees: 0.9, axisRatio: 0.5, color: STARLIGHT, brightness: 0.12 },
  { name: 'Scutum Star Cloud', kind: 'starCloud', raHours: 18.62, decDegrees: -6.5, radiusDegrees: 2, axisRatio: 0.7, color: STARLIGHT, brightness: 0.1 },
  { name: 'Rho Ophiuchi', kind: 'reflection', raHours: 16.426, decDegrees: -23.45, radiusDegrees: 0.7, color: REFLECTION_BLUE, brightness: 0.16 },
  { name: 'Antares Nebula', kind: 'reflection', raHours: 16.49, decDegrees: -26.43, radiusDegrees: 0.9, color: [1, 0.8, 0.45], brightness: 0.16 },
  { name: 'Sigma Scorpii Nebula', kind: 'emission', raHours: 16.353, decDegrees: -25.59, radiusDegrees: 0.6, color: HYDROGEN_ALPHA, brightness: 0.12 },
  { name: 'Rho Ophiuchi Dark Cloud', kind: 'dark', raHours: 16.5, decDegrees: -24.6, radiusDegrees: 2.2, axisRatio: 0.5, positionAngleDegrees: 60, color: DUST, brightness: 1.6 },
  { name: 'Pipe Nebula', kind: 'dark', raHours: 17.3, decDegrees: -26.8, radiusDegrees: 3.5, axisRatio: 0.25, positionAngleDegrees: 95, color: DUST, brightness: 1.8 },
  { name: 'NGC 6188', kind: 'emission', raHours: 16.668, decDegrees: -48.78, radiusDegrees: 0.6, axisRatio: 0.6, color: HYDROGEN_ALPHA, brightness: 0.14 },
  { name: 'Norma Star Cloud', kind: 'starCloud', raHours: 16.3, decDegrees: -52, radiusDegrees: 2, color: STARLIGHT, brightness: 0.06 },
  // Carina, Crux, Vela
  { name: 'Carina Nebula', kind: 'emission', raHours: 10.752, decDegrees: -59.87, radiusDegrees: 1, axisRatio: 0.8, color: HYDROGEN_ALPHA, brightness: 0.45 },
  { name: 'Running Chicken (IC 2944)', kind: 'emission', raHours: 11.64, decDegrees: -63.37, radiusDegrees: 0.6, color: HYDROGEN_ALPHA, brightness: 0.16 },
  { name: 'Coalsack', kind: 'dark', raHours: 12.83, decDegrees: -62.5, radiusDegrees: 3, axisRatio: 0.85, color: DUST, brightness: 1.4 },
  { name: 'Vela Supernova Remnant', kind: 'shell', raHours: 8.58, decDegrees: -45.2, radiusDegrees: 4, axisRatio: 0.9, color: OXYGEN_TEAL, brightness: 0.06, rimWidth: 0.3 },
  { name: 'Gum Nebula', kind: 'shell', raHours: 8.5, decDegrees: -43, radiusDegrees: 18, axisRatio: 0.9, color: HYDROGEN_ALPHA, brightness: 0.03, rimWidth: 0.4 },
  // Galaxies
  { name: 'Andromeda Galaxy (M31)', kind: 'galaxy', raHours: 0.7123, decDegrees: 41.27, radiusDegrees: 1.6, axisRatio: 0.32, positionAngleDegrees: 35, color: STARLIGHT, brightness: 0.3 },
  { name: 'Triangulum Galaxy (M33)', kind: 'galaxy', raHours: 1.564, decDegrees: 30.66, radiusDegrees: 0.5, axisRatio: 0.65, positionAngleDegrees: 23, color: [0.85, 0.9, 1], brightness: 0.08 },
  { name: 'Large Magellanic Cloud', kind: 'galaxy', raHours: 5.393, decDegrees: -69.75, radiusDegrees: 4.5, axisRatio: 0.85, positionAngleDegrees: 170, color: [0.92, 0.94, 1], brightness: 0.13 },
  { name: 'LMC bar', kind: 'galaxy', raHours: 5.35, decDegrees: -69.6, radiusDegrees: 2.2, axisRatio: 0.3, positionAngleDegrees: 115, color: [1, 0.95, 0.85], brightness: 0.12 },
  { name: 'Tarantula Nebula', kind: 'emission', raHours: 5.645, decDegrees: -69.1, radiusDegrees: 0.35, color: [1, 0.4, 0.55], brightness: 0.3 },
  { name: 'Small Magellanic Cloud', kind: 'galaxy', raHours: 0.879, decDegrees: -72.83, radiusDegrees: 2.3, axisRatio: 0.55, positionAngleDegrees: 45, color: [0.92, 0.94, 1], brightness: 0.12 },
]
