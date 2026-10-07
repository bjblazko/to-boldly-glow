import type { Rgb } from '../math/tuples'

// The catalog's layout (see packages/data-pipeline/src/convertBrightStarCatalog.ts): direction
// x, y, z in the scene frame, visual magnitude, B−V color index.
export const CATALOG_FLOATS_PER_STAR = 5

// What the star shader reads per star: direction (3), peak intensity, color (3), spike strength.
export const FLOATS_PER_STAR_INSTANCE = 8

// A magnitude-1 star (Spica, Antares) peaks at full brightness; brighter ones are drawn larger
// instead of brighter still (see starShader.ts).
const REFERENCE_MAGNITUDE = 1
// The eye's response to light is far from linear: compressing the 1000:1 flux range of the
// catalog keeps the faintest naked-eye stars visible next to the brightest.
const FLUX_RESPONSE = 0.5
const MAX_INTENSITY = 3
// Diffraction spikes grow on the ~20 stars brighter than this.
const SPIKE_MAGNITUDE = 1.5

// How strongly a star of this visual magnitude lights its pixel, relative to a magnitude-1 star.
export function starIntensity(magnitude: number): number {
  const flux = 10 ** (-0.4 * (magnitude - REFERENCE_MAGNITUDE))
  return Math.min(flux ** FLUX_RESPONSE, MAX_INTENSITY)
}

// 0 for most stars, rising to 1 for Sirius.
export function spikeStrength(magnitude: number): number {
  return Math.min(Math.max((SPIKE_MAGNITUDE - magnitude) / 3, 0), 1)
}

// A star's surface temperature from its B−V color index (Ballesteros 2012, a blackbody fit).
export function colorTemperature(colorIndex: number): number {
  const bv = Math.min(Math.max(colorIndex, -0.4), 2)
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
}

// The color of a blackbody at this temperature, as linear sRGB with its brightest channel at 1:
// the Planckian locus in CIE xy (Kang et al. 2002), then CIE XYZ to sRGB. Hot stars come out
// blue-white, the Sun faintly warm (sRGB's white point is a 6500 K daylight), cool giants orange.
export function blackbodyColor(kelvin: number): Rgb {
  const t = Math.min(Math.max(kelvin, 1667), 25000)
  const x = t <= 4000 ? -0.2661239e9 / t ** 3 - 0.2343589e6 / t ** 2 + 0.8776956e3 / t + 0.17991 : -3.0258469e9 / t ** 3 + 2.1070379e6 / t ** 2 + 0.2226347e3 / t + 0.24039
  const y = planckianY(x, t)
  const [bigX, bigY, bigZ] = [x / y, 1, (1 - x - y) / y]
  const rgb = [
    3.2406 * bigX - 1.5372 * bigY - 0.4986 * bigZ,
    -0.9689 * bigX + 1.8758 * bigY + 0.0415 * bigZ,
    0.0557 * bigX - 0.204 * bigY + 1.057 * bigZ,
  ].map((channel) => Math.max(channel, 0))
  const brightest = Math.max(...rgb)
  return [rgb[0] / brightest, rgb[1] / brightest, rgb[2] / brightest]
}

function planckianY(x: number, kelvin: number): number {
  if (kelvin <= 2222) return -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
  if (kelvin <= 4000) return -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
  return 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483
}

// The eye sees star colors more vividly in astrophotographs than a blackbody's muted hues; a gentle
// boost away from gray makes them read at a glance without turning garish.
const COLOR_SATURATION = 1.35

export function starColor(colorIndex: number): Rgb {
  const color = blackbodyColor(colorTemperature(colorIndex))
  const gray = (color[0] + color[1] + color[2]) / 3
  const saturated = color.map((channel) => Math.max(gray + (channel - gray) * COLOR_SATURATION, 0))
  const brightest = Math.max(...saturated)
  return [saturated[0] / brightest, saturated[1] / brightest, saturated[2] / brightest]
}

// Turns the catalog into the star shader's per-instance data.
export function starInstances(catalog: Float32Array): Float32Array {
  const count = Math.floor(catalog.length / CATALOG_FLOATS_PER_STAR)
  const instances = new Float32Array(count * FLOATS_PER_STAR_INSTANCE)
  for (let i = 0; i < count; i++) {
    const [x, y, z, magnitude, colorIndex] = catalog.subarray(i * CATALOG_FLOATS_PER_STAR, (i + 1) * CATALOG_FLOATS_PER_STAR)
    instances.set([x, y, z, starIntensity(magnitude), ...starColor(colorIndex), spikeStrength(magnitude)], i * FLOATS_PER_STAR_INSTANCE)
  }
  return instances
}
