export type PlanetType = 'rocky' | 'gas giant' | 'ice giant'

// Seen from the ground on the rocky planets: the coldest and hottest it gets. The giants have no
// ground, so theirs is the temperature at the top of their clouds (where the pressure is Earth's at
// sea level).
export type Temperature = { minC: number; maxC: number } | { cloudTopsC: number }

// Diameter/circumference derived from bodies.ts's own radiusKm (2*radiusKm, and pi*diameter -
// circumference isn't otherwise stored anywhere in the data pipeline). How long a planet takes to
// spin and to go around the Sun comes from bodies.ts too (see planetFacts). Everything else is from
// the NASA Planetary Fact Sheet (average Sun distance: semi-major axis; mass: ratio to Earth's;
// temperatures, density and gravity of the giants: at 1 bar; day: its "length of day", from one
// sunrise to the next; tilt: its "obliquity to orbit"), matching the sourcing convention documented
// on BodyDefinition's own fields in bodies.ts; the rocky planets' coldest and hottest are from
// NASA's planet pages (Earth's: the measured records).
export interface PlanetStats {
  diameterKm: number
  circumferenceKm: number
  averageDistanceKm: number
  massEarths: number
  type: PlanetType
  atmosphere: string
  temperature: Temperature
  meanTemperatureC: number
  orbitalSpeedKmPerS: number
  solarDayHours: number
  densityKgPerM3: number
  gravityMPerS2: number
  axialTiltDegrees: number
  // A sentence or two on what sets the planet apart, above its numbers.
  intro: string
}

export const PLANET_STATS: Record<string, PlanetStats> = {
  mercury: {
    diameterKm: 4_879,
    circumferenceKm: 15_329,
    averageDistanceKm: 57_909_050,
    massEarths: 0.0553,
    type: 'rocky',
    atmosphere: 'No - only traces',
    temperature: { minC: -180, maxC: 430 },
    meanTemperatureC: 167,
    orbitalSpeedKmPerS: 47.4,
    solarDayHours: 4_222.6,
    densityKgPerM3: 5_429,
    gravityMPerS2: 3.7,
    axialTiltDegrees: 0.034,
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
    meanTemperatureC: 464,
    orbitalSpeedKmPerS: 35.0,
    solarDayHours: 2_802.0,
    densityKgPerM3: 5_243,
    gravityMPerS2: 8.9,
    axialTiltDegrees: 177.4,
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
    meanTemperatureC: 15,
    orbitalSpeedKmPerS: 29.8,
    solarDayHours: 24.0,
    densityKgPerM3: 5_514,
    gravityMPerS2: 9.8,
    axialTiltDegrees: 23.4,
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
    meanTemperatureC: -65,
    orbitalSpeedKmPerS: 24.1,
    solarDayHours: 24.7,
    densityKgPerM3: 3_934,
    gravityMPerS2: 3.7,
    axialTiltDegrees: 25.2,
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
    meanTemperatureC: -110,
    orbitalSpeedKmPerS: 13.1,
    solarDayHours: 9.9,
    densityKgPerM3: 1_326,
    gravityMPerS2: 23.1,
    axialTiltDegrees: 3.1,
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
    meanTemperatureC: -140,
    orbitalSpeedKmPerS: 9.7,
    solarDayHours: 10.7,
    densityKgPerM3: 687,
    gravityMPerS2: 9.0,
    axialTiltDegrees: 26.7,
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
    meanTemperatureC: -195,
    orbitalSpeedKmPerS: 6.8,
    solarDayHours: 17.2,
    densityKgPerM3: 1_270,
    gravityMPerS2: 8.7,
    axialTiltDegrees: 97.8,
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
    meanTemperatureC: -200,
    orbitalSpeedKmPerS: 5.4,
    solarDayHours: 16.1,
    densityKgPerM3: 1_638,
    gravityMPerS2: 11.0,
    axialTiltDegrees: 28.3,
    intro: 'The farthest planet: an ice giant with the fastest winds in the Solar System, up to 2,000 km/h. Sunlight takes over four hours to get there.',
  },
}
