// Tens of thousands of asteroids and Kuiper belt objects, generated (not catalogued) with the
// orbital statistics of the real populations, so the belts have the right shape - and their
// structure comes out of the orbits themselves: the Kirkwood gaps Jupiter clears from the main
// belt, the triangle the Hildas trace in step with Jupiter, the two swarms of Trojans leading and
// trailing it, and the plutinos keeping clear of Neptune like Pluto does.

// Per asteroid: semi-major axis (AU), eccentricity, inclination, ascending node, argument of
// perihelion, mean anomaly at J2000 (radians), radius (km), color (0 = gray carbonaceous, 1 = red).
export const FLOATS_PER_ASTEROID = 8

const DEGREES = Math.PI / 180
const TWO_PI = 2 * Math.PI
// Mean longitudes at J2000.0 (Standish, JPL approximate planetary elements).
const JUPITER_MEAN_LONGITUDE = 34.396 * DEGREES
const NEPTUNE_MEAN_LONGITUDE = 304.88 * DEGREES
const JUPITER_SEMI_MAJOR_AXIS = 5.2026

// Mean-motion resonances with Jupiter that empty the main belt (semi-major axis, half-width in AU).
export const KIRKWOOD_GAPS: ReadonlyArray<[number, number]> = [
  [2.502, 0.035], // 3:1
  [2.825, 0.025], // 5:2
  [2.958, 0.015], // 7:3
  [3.279, 0.045], // 2:1
]

export const POPULATION_COUNTS = { mainBelt: 30000, hildas: 1500, trojans: 3000, kuiperBelt: 6000 }

interface Orbit {
  a: number
  e: number
  i: number
  node: number
  perihelionArgument: number
  meanAnomaly: number
  radiusKm: number
  color: number
}

type Random = () => number

export function asteroidPopulation(seed = 1): Float32Array {
  const random = seededRandom(seed)
  const orbits = [
    ...repeat(POPULATION_COUNTS.mainBelt, () => mainBeltOrbit(random)),
    ...repeat(POPULATION_COUNTS.hildas, () => hildaOrbit(random)),
    ...repeat(POPULATION_COUNTS.trojans, () => trojanOrbit(random)),
    ...repeat(POPULATION_COUNTS.kuiperBelt, () => kuiperBeltOrbit(random)),
  ]
  const values = new Float32Array(orbits.length * FLOATS_PER_ASTEROID)
  orbits.forEach((o, index) => values.set([o.a, o.e, o.i, o.node, o.perihelionArgument, o.meanAnomaly, o.radiusKm, o.color], index * FLOATS_PER_ASTEROID))
  return values
}

export function inKirkwoodGap(a: number): boolean {
  return KIRKWOOD_GAPS.some(([center, halfWidth]) => Math.abs(a - center) < halfWidth)
}

// Between the 4:1 resonance at 2.06 AU and the 2:1 at 3.28 AU, stony (red) types dominating the
// inner belt and dark carbonaceous ones the outer.
function mainBeltOrbit(random: Random): Orbit {
  let a = 2.1 + random() * 1.2
  while (inKirkwoodGap(a)) a = 2.1 + random() * 1.2
  const e = Math.min(rayleigh(random, 0.09), 0.33)
  const color = random() < 1.4 - (a - 2.1) / 1.2 ? 0.7 + random() * 0.3 : random() * 0.3
  return { a, e, i: Math.min(rayleigh(random, 7), 35) * DEGREES, ...randomAngles(random), radiusKm: sizeKm(random, 120), color }
}

// In 3:2 resonance with Jupiter: the resonant angle 3λJ - 2λ - ϖ stays near zero, which keeps
// their aphelia toward Jupiter's L3, L4 and L5 points - a triangle turning with Jupiter.
function hildaOrbit(random: Random): Orbit {
  const a = JUPITER_SEMI_MAJOR_AXIS * (2 / 3) ** (2 / 3) + (random() - 0.5) * 0.01
  const longitude = random() * TWO_PI
  const perihelionLongitude = 3 * JUPITER_MEAN_LONGITUDE - 2 * longitude + gaussian(random) * 15 * DEGREES
  return resonantOrbit({ a, e: 0.1 + random() * 0.15, i: rayleigh(random, 6) * DEGREES }, longitude, perihelionLongitude, random)
}

// Sharing Jupiter's orbit 60° ahead of it (L4) and behind it (L5), librating about those points.
function trojanOrbit(random: Random): Orbit {
  const a = JUPITER_SEMI_MAJOR_AXIS + (random() - 0.5) * 0.02
  const side = random() < 0.6 ? 1 : -1
  const longitude = JUPITER_MEAN_LONGITUDE + side * 60 * DEGREES + gaussian(random) * 12 * DEGREES
  const perihelionLongitude = random() * TWO_PI
  return { ...resonantOrbit({ a, e: Math.min(rayleigh(random, 0.06), 0.2), i: rayleigh(random, 11) * DEGREES }, longitude, perihelionLongitude, random), color: 0.5 + random() * 0.3 }
}

// Cold classical objects on near-circular, flat orbits, a dynamically hot population, plutinos
// in 3:2 resonance with Neptune (perihelia kept away from it), and the scattered disk.
function kuiperBeltOrbit(random: Random): Orbit {
  const pick = random()
  const color = 0.6 + random() * 0.4
  if (pick < 0.45) return { a: 42.5 + random() * 4.5, e: rayleigh(random, 0.05), i: rayleigh(random, 2.5) * DEGREES, ...randomAngles(random), radiusKm: sizeKm(random, 300), color }
  if (pick < 0.7) return { a: 40 + random() * 8, e: Math.min(rayleigh(random, 0.1), 0.3), i: rayleigh(random, 12) * DEGREES, ...randomAngles(random), radiusKm: sizeKm(random, 300), color }
  if (pick < 0.9) return { ...plutinoOrbit(random), color }
  return { a: 50 + random() * 70, e: 0.3 + random() * 0.3, i: rayleigh(random, 15) * DEGREES, ...randomAngles(random), radiusKm: sizeKm(random, 300), color }
}

function plutinoOrbit(random: Random): Orbit {
  const longitude = random() * TWO_PI
  const perihelionLongitude = 3 * longitude - 2 * NEPTUNE_MEAN_LONGITUDE - Math.PI + gaussian(random) * 30 * DEGREES
  return resonantOrbit({ a: 39.45 + (random() - 0.5) * 0.3, e: 0.1 + random() * 0.2, i: rayleigh(random, 10) * DEGREES }, longitude, perihelionLongitude, random)
}

// An orbit given its mean longitude and longitude of perihelion at J2000 (what resonances fix).
function resonantOrbit(shape: Pick<Orbit, 'a' | 'e' | 'i'>, meanLongitude: number, perihelionLongitude: number, random: Random): Orbit {
  const node = random() * TWO_PI
  return {
    ...shape,
    node,
    perihelionArgument: wrap(perihelionLongitude - node),
    meanAnomaly: wrap(meanLongitude - perihelionLongitude),
    radiusKm: sizeKm(random, shape.a > 30 ? 300 : 120),
    color: random() * 0.5,
  }
}

function randomAngles(random: Random): Pick<Orbit, 'node' | 'perihelionArgument' | 'meanAnomaly'> {
  return { node: random() * TWO_PI, perihelionArgument: random() * TWO_PI, meanAnomaly: random() * TWO_PI }
}

// Many small bodies, few large ones: a power law from 1 km up to `largestKm`.
function sizeKm(random: Random, largestKm: number): number {
  return Math.min(1 / Math.max(random(), 1e-4) ** 0.7, largestKm)
}

function rayleigh(random: Random, sigma: number): number {
  return sigma * Math.sqrt(-2 * Math.log(1 - random()))
}

function gaussian(random: Random): number {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(TWO_PI * random())
}

function wrap(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI
}

function repeat<T>(count: number, make: () => T): T[] {
  return Array.from({ length: count }, make)
}

// mulberry32: small, fast and seedable, so every visit shows the same belts.
function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
