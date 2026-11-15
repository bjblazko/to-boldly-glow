import type { StateVector } from './horizons'

const J2000_JULIAN_DAY = 2451545.0
const KM_PER_AU = 149597870.7
const SECONDS_PER_DAY = 86400
// The Sun's gravitational parameter, km^3/s^2 (IAU 2015 nominal).
const SUN_GM_KM3_PER_S2 = 1.3271244e11

// Drops the daily samples a straight line between their neighbours would put within `toleranceAu`
// of where they are (Douglas-Peucker along time): long straight stretches keep few points, the
// bends of a flyby keep many.
export function simplifyTrajectory(vectors: StateVector[], toleranceAu: number): StateVector[] {
  const keep = new Uint8Array(vectors.length)
  keep[0] = keep[vectors.length - 1] = 1
  const spans: [number, number][] = [[0, vectors.length - 1]]
  while (spans.length > 0) {
    const [first, last] = spans.pop()!
    const { index, distance } = farthestFromChord(vectors, first, last)
    if (distance <= toleranceAu) continue
    keep[index] = 1
    spans.push([first, index], [index, last])
  }
  return vectors.filter((_, index) => keep[index])
}

function farthestFromChord(vectors: StateVector[], first: number, last: number): { index: number; distance: number } {
  let best = { index: first, distance: 0 }
  const a = vectors[first]
  const b = vectors[last]
  for (let index = first + 1; index < last; index++) {
    const t = (vectors[index].julianDay - a.julianDay) / (b.julianDay - a.julianDay)
    const expected = a.position.map((value, axis) => value + (b.position[axis] - value) * t)
    const distance = Math.hypot(...vectors[index].position.map((value, axis) => value - expected[axis]))
    if (distance > best.distance) best = { index, distance }
  }
  return best
}

// [days since J2000, x, y, z (AU)] per sample, as float32 - the app's trajectory file.
export function trajectoryBinary(vectors: StateVector[]): Buffer {
  const values = new Float32Array(vectors.length * 4)
  vectors.forEach(({ julianDay, position }, index) => values.set([julianDay - J2000_JULIAN_DAY, ...position], index * 4))
  return Buffer.from(values.buffer)
}

// Every `stepDays`-th sample: the year, the speed around the Sun and the Sun's escape speed at that
// distance, in km/s.
export function speedSeries(vectors: StateVector[], stepDays: number): [number, number, number][] {
  return vectors
    .filter((_, index) => index % stepDays === 0)
    .map(({ julianDay, position, velocity }) => {
      const year = 2000 + (julianDay - J2000_JULIAN_DAY) / 365.25
      const speed = (Math.hypot(...velocity) * KM_PER_AU) / SECONDS_PER_DAY
      const escape = Math.sqrt((2 * SUN_GM_KM3_PER_S2) / (Math.hypot(...position) * KM_PER_AU))
      return [round(year, 3), round(speed, 2), round(escape, 2)]
    })
}

function round(value: number, decimals: number): number {
  return Math.round(value * 10 ** decimals) / 10 ** decimals
}
