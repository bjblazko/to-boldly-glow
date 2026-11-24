// Craters and boulders made up for Tranquility Base's ground, where the terrain model (a point every
// few metres) is too coarse to hold them: many small craters and few large ones (their number grows
// as the inverse square of their size, as on the maria), bowls a fifth as deep as they are wide
// with a low raised rim; and boulders scattered over the ground, more of them on the rims. All from
// one seed, so the same at every visit; the ground right round Eagle kept clear. Places in metres
// east and north of the site.

export interface Crater {
  east: number
  north: number
  radius: number
}

export interface Boulder {
  east: number
  north: number
  size: number
  // Its own seed (its shape) and turn about the vertical (radians).
  seed: number
  turn: number
}

const SEED = 1969

// A small, good-enough pseudo-random sequence (mulberry32).
export function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// `reach`: how far from the site they lie (m); `clear`: how much round the site stays clear (m).
export function craterField(reach = 1700, clear = 30, count = 420): Crater[] {
  const next = random(SEED)
  const craters: Crater[] = []
  while (craters.length < count) {
    const [east, north] = [(next() * 2 - 1) * reach, (next() * 2 - 1) * reach]
    // Sizes from 5 to 60 m in radius, as 1 / r^2 (inverse transform sampling).
    const u = next()
    const radius = 1 / (1 / 5 - u * (1 / 5 - 1 / 60))
    if (Math.hypot(east, north) < clear + radius * 1.4) continue
    craters.push({ east, north, radius })
  }
  return craters
}

// The ground's height a crater field adds at a place (m): each a bowl to 0.2 of its width deep, a
// rim 0.04 of it high, its ejecta fading out to two radii.
export function craterHeight(craters: readonly Crater[], east: number, north: number): number {
  let height = 0
  for (const crater of craters) {
    const r = Math.hypot(east - crater.east, north - crater.north) / crater.radius
    if (r > 2.2) continue
    const [depth, rim] = [0.4 * crater.radius, 0.08 * crater.radius]
    height += r < 1 ? -depth * (1 - r * r) + rim * r ** 4 : rim * Math.exp(-((r - 1) * (r - 1)) * 6)
  }
  return height
}

// The same, quick for many places: the craters sorted into cells of a grid first.
const CELL = 100
export function craterHeights(craters: readonly Crater[]): (east: number, north: number) => number {
  const cells = new Map<string, Crater[]>()
  for (const crater of craters) {
    const reach = crater.radius * 2.2
    for (let x = Math.floor((crater.east - reach) / CELL); x <= Math.floor((crater.east + reach) / CELL); x++) {
      for (let y = Math.floor((crater.north - reach) / CELL); y <= Math.floor((crater.north + reach) / CELL); y++) {
        const key = `${x},${y}`
        cells.set(key, [...(cells.get(key) ?? []), crater])
      }
    }
  }
  return (east, north) => craterHeight(cells.get(`${Math.floor(east / CELL)},${Math.floor(north / CELL)}`) ?? [], east, north)
}

// Boulders: a sprinkle over the ground round the site and clusters on the larger craters' rims.
export function boulderField(craters: readonly Crater[], reach = 420, clear = 12): Boulder[] {
  const next = random(SEED + 1)
  const boulders: Boulder[] = []
  const add = (east: number, north: number, size: number) => {
    if (Math.hypot(east, north) > clear + size) boulders.push({ east, north, size, seed: Math.floor(next() * 1e9), turn: next() * Math.PI * 2 })
  }
  // Denser toward the site (the distance squared: as many in each ring of its width).
  for (let i = 0; i < 900; i++) {
    const [angle, r] = [next() * Math.PI * 2, clear + next() ** 1.6 * reach]
    add(Math.cos(angle) * r, Math.sin(angle) * r, 0.15 + next() ** 3 * 1.4)
  }
  for (const crater of craters.filter((c) => c.radius > 14 && Math.hypot(c.east, c.north) < reach + c.radius)) {
    for (let i = 0; i < Math.round(crater.radius / 2); i++) {
      const [angle, r] = [next() * Math.PI * 2, crater.radius * (0.9 + next() * 0.6)]
      add(crater.east + Math.cos(angle) * r, crater.north + Math.sin(angle) * r, 0.3 + next() ** 2 * 1.8)
    }
  }
  return boulders
}
