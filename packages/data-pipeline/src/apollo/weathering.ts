// The Saturn V's paint as it looked on the pad, not fresh from the shop: the white a little uneven,
// fine grain, thin streaks run down from the joints and vents, and the base dark with soot and dust.
// Drawn over the paint (rgb, row by row from the nose down), the same every time (a fixed seed), and
// seamless where the image wraps round the rocket.

const SEED = 506 // AS-506, Apollo 11's Saturn V
const STREAKS = 160
// The share of the height, from the base, that soot darkens.
const SOOT_SHARE = 0.05

// A small, fast, repeatable random number generator (mulberry32).
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Smooth noise from a coarse grid of random values, wrapping across (u in 0..1 joins up).
class WrappingNoise {
  private readonly values: Float32Array

  constructor(
    private readonly across: number,
    private readonly down: number,
    next: () => number,
  ) {
    this.values = Float32Array.from({ length: across * (down + 1) }, next)
  }

  at(u: number, v: number): number {
    const [x, y] = [u * this.across, v * this.down]
    const [x0, y0] = [Math.floor(x), Math.floor(y)]
    const [fx, fy] = [ease(x - x0), ease(y - y0)]
    const value = (i: number, j: number) => this.values[Math.min(j, this.down) * this.across + (((i % this.across) + this.across) % this.across)]
    const top = value(x0, y0) + (value(x0 + 1, y0) - value(x0, y0)) * fx
    const bottom = value(x0, y0 + 1) + (value(x0 + 1, y0 + 1) - value(x0, y0 + 1)) * fx
    return top + (bottom - top) * fy
  }
}

function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

// How much each pixel keeps of its colour: mottling, grain and the soot at the base.
function wearFactors(width: number, height: number, next: () => number): Float32Array {
  const [broad, fine] = [new WrappingNoise(6, 40, next), new WrappingNoise(24, 300, next)]
  const factors = new Float32Array(width * height)
  for (let row = 0; row < height; row++) {
    const v = row / height
    const soot = Math.max(0, (v - (1 - SOOT_SHARE)) / SOOT_SHARE)
    for (let column = 0; column < width; column++) {
      const u = column / width
      const mottle = 0.07 * broad.at(u, v) + 0.045 * fine.at(u, v) + 0.02 * next()
      factors[row * width + column] = 1 - mottle - soot * soot * (0.25 + 0.2 * fine.at(u, v))
    }
  }
  return factors
}

// Thin streaks running down from where they start, fading as they go.
function streak(factors: Float32Array, width: number, height: number, next: () => number): void {
  const [column, top] = [Math.floor(next() * width), Math.floor(next() * height * 0.9)]
  const [length, strength, thickness] = [height * (0.01 + 0.04 * next()), 0.06 + 0.1 * next(), 1 + Math.floor(next() * 3)]
  for (let row = top; row < Math.min(height, top + length); row++) {
    const fade = 1 - (row - top) / length
    for (let k = 0; k < thickness; k++) factors[row * width + ((column + k) % width)] *= 1 - strength * fade
  }
}

export function weather(rgb: Uint8Array, width: number, height: number): Uint8Array {
  const next = random(SEED)
  const factors = wearFactors(width, height, next)
  for (let i = 0; i < STREAKS; i++) streak(factors, width, height, next)
  const out = new Uint8Array(rgb.length)
  for (let pixel = 0; pixel < width * height; pixel++) {
    const f = factors[pixel]
    // Grime is a little warm: blue fades a touch more than red.
    out[pixel * 3] = rgb[pixel * 3] * f
    out[pixel * 3 + 1] = rgb[pixel * 3 + 1] * f * (1 - (1 - f) * 0.1)
    out[pixel * 3 + 2] = rgb[pixel * 3 + 2] * f * (1 - (1 - f) * 0.25)
  }
  return out
}
