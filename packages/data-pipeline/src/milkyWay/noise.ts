// Seeded 3D gradient noise (Ken Perlin's improved noise, 2002), sampled at points on the unit sphere
// scaled by a frequency: the sky picture has no seam and no pinching at the poles, wherever the
// equirectangular projection puts them.

export interface Noise3 {
  // Roughly -1..1, smooth, zero at every integer lattice point.
  at(x: number, y: number, z: number): number
}

export function createNoise(seed: number): Noise3 {
  const permutation = shuffledBytes(seed)
  const p = new Uint8Array(512)
  for (let i = 0; i < 512; i++) p[i] = permutation[i & 255]
  return { at: (x, y, z) => gradientNoise(p, x, y, z) }
}

// Fractal sum of octaves, normalized to roughly -1..1: each octave doubles the frequency and
// halves the amplitude (or `gain`), so large structure carries ever finer detail.
export function fbm(noise: Noise3, [x, y, z]: readonly [number, number, number], octaves: number, gain = 0.5): number {
  let sum = 0
  let amplitude = 1
  let total = 0
  let frequency = 1
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * noise.at(x * frequency + octave * 17.1, y * frequency, z * frequency)
    total += amplitude
    amplitude *= gain
    frequency *= 2
  }
  return sum / total
}

// Sharp-crested ridges (0..1) where the noise crosses zero: the look of filaments and lanes.
export function ridged(noise: Noise3, [x, y, z]: readonly [number, number, number], octaves: number): number {
  let sum = 0
  let amplitude = 1
  let total = 0
  let frequency = 1
  for (let octave = 0; octave < octaves; octave++) {
    const ridge = 1 - Math.abs(noise.at(x * frequency, y * frequency + octave * 31.7, z * frequency))
    sum += amplitude * ridge * ridge
    total += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return sum / total
}

function gradientNoise(p: Uint8Array, x: number, y: number, z: number): number {
  const [xi, yi, zi] = [Math.floor(x), Math.floor(y), Math.floor(z)]
  const [xf, yf, zf] = [x - xi, y - yi, z - zi]
  const [X, Y, Z] = [xi & 255, yi & 255, zi & 255]
  const [u, v, w] = [fade(xf), fade(yf), fade(zf)]
  const A = p[X] + Y
  const AA = p[A] + Z
  const AB = p[A + 1] + Z
  const B = p[X + 1] + Y
  const BA = p[B] + Z
  const BB = p[B + 1] + Z
  const x0 = lerp(u, grad(p[AA], xf, yf, zf), grad(p[BA], xf - 1, yf, zf))
  const x1 = lerp(u, grad(p[AB], xf, yf - 1, zf), grad(p[BB], xf - 1, yf - 1, zf))
  const x2 = lerp(u, grad(p[AA + 1], xf, yf, zf - 1), grad(p[BA + 1], xf - 1, yf, zf - 1))
  const x3 = lerp(u, grad(p[AB + 1], xf, yf - 1, zf - 1), grad(p[BB + 1], xf - 1, yf - 1, zf - 1))
  return lerp(w, lerp(v, x0, x1), lerp(v, x2, x3))
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a)
}

// One of the 12 cube-edge gradient directions, picked by the hash.
function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

// 0..255 in a seeded random order (Fisher-Yates driven by mulberry32).
function shuffledBytes(seed: number): Uint8Array {
  const random = mulberry32(seed)
  const bytes = Uint8Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[bytes[i], bytes[j]] = [bytes[j], bytes[i]]
  }
  return bytes
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
