import type { Raster } from './evenShadows'

// Cutting and packing the terrain tile.

// A square of `size` pixels centred (as near as whole pixels allow) on a pixel, clipped to the
// raster; its top-left pixel's place in the raster.
export function cropAround(raster: Raster, centre: { line: number; sample: number }, size: number, columns?: { first: number; last: number }): { raster: Raster; origin: { line: number; sample: number } } {
  const first = columns?.first ?? 0
  const last = columns?.last ?? raster.width - 1
  const sample = Math.min(last + 1 - size, Math.max(first, Math.round(centre.sample - size / 2)))
  const line = Math.min(raster.height - size, Math.max(0, Math.round(centre.line - size / 2)))
  const data = new Float32Array(size * size)
  for (let row = 0; row < size; row++) data.set(raster.data.subarray((line + row) * raster.width + sample, (line + row) * raster.width + sample + size), row * size)
  return { raster: { width: size, height: size, data }, origin: { line, sample } }
}

// Half the size each way, each pixel the mean of four.
export function halve({ width, height, data }: Raster): Raster {
  const [w, h] = [Math.floor(width / 2), Math.floor(height / 2)]
  const out = Float32Array.from({ length: w * h }, (_, i) => {
    const [row, column] = [Math.floor(i / w) * 2, (i % w) * 2]
    return (data[row * width + column] + data[row * width + column + 1] + data[(row + 1) * width + column] + data[(row + 1) * width + column + 1]) / 4
  })
  return { width: w, height: h, data: out }
}

// Heights in 16 bits: height = offset + value × scale (metres), the whole range used.
export function packHeights({ data }: Raster): { values: Uint16Array; offset: number; scale: number } {
  let [low, high] = [Infinity, -Infinity]
  for (const value of data) [low, high] = [Math.min(low, value), Math.max(high, value)]
  const scale = Math.max(high - low, 1e-6) / 65535
  return { values: Uint16Array.from(data, (value) => Math.round((value - low) / scale)), offset: low, scale }
}

// Brightness to 8-bit grey: the darkest and brightest half percent clipped, so nothing glares.
export function toGrey({ data }: Raster): Uint8Array {
  const sorted = Float32Array.from(data).sort()
  const [low, high] = [sorted[Math.floor(sorted.length * 0.005)], sorted[Math.floor(sorted.length * 0.995)]]
  return Uint8Array.from(data, (value) => Math.round(255 * Math.min(1, Math.max(0, (value - low) / (high - low)))))
}
