// A tile of invented regolith for the tour's lunar ground, seen up close: fine, powdery, lumpy - soft
// clods at several sizes, scattered pebbles and a grain of sand - repeating seamlessly (value noise
// on a lattice that wraps round). Red: height (light is high), green: how light the ground is there
// (pebbles a little lighter, hollows a little darker). The app tiles it at two sizes and lets the
// GPU's mipmaps average it out with distance.

export const DETAIL_SIZE = 512

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

// Value noise with `cells` lattice cells across the tile, wrapping at its edges.
function periodicNoise(u: number, v: number, cells: number, seed: number): number {
  const [x, y] = [u * cells, v * cells]
  const [x0, y0] = [Math.floor(x), Math.floor(y)]
  const [fx, fy] = [x - x0, y - y0]
  const s = (t: number) => t * t * (3 - 2 * t)
  const at = (i: number, j: number) => hash(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed)
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * s(fx)
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * s(fx)
  return top + (bottom - top) * s(fy)
}

const smooth = (a: number, b: number, t: number) => {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

// Height and lightness (0 to 1) at a point of the tile (u, v in 0..1).
export function regolithAt(u: number, v: number): [number, number] {
  const clods = [8, 16, 32, 64].reduce((sum, cells, i) => sum + Math.abs(periodicNoise(u, v, cells, i + 1) - 0.5) * 0.5 ** i, 0)
  const pebbles = smooth(0.78, 0.95, periodicNoise(u, v, 48, 9)) * 0.5 + smooth(0.82, 0.97, periodicNoise(u, v, 96, 10)) * 0.3
  const grain = hash(Math.floor(u * DETAIL_SIZE), Math.floor(v * DETAIL_SIZE), 11) * 0.12
  const height = Math.min(1, clods * 0.55 + pebbles * 0.5 + grain)
  const light = Math.min(1, 0.45 + (clods - 0.35) * 0.4 + pebbles * 0.35 + (grain - 0.06) * 1.2)
  return [height, Math.max(0, light)]
}

export function regolithTile(): Uint8Array {
  const pixels = new Uint8Array(DETAIL_SIZE * DETAIL_SIZE * 4)
  for (let y = 0; y < DETAIL_SIZE; y++) {
    for (let x = 0; x < DETAIL_SIZE; x++) {
      const [height, light] = regolithAt(x / DETAIL_SIZE, y / DETAIL_SIZE)
      pixels.set([Math.round(height * 255), Math.round(light * 255), 128, 255], (y * DETAIL_SIZE + x) * 4)
    }
  }
  return pixels
}
