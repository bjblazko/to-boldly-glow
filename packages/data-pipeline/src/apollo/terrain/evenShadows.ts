// The orthophoto's shadows evened out. The photo was taken with the Sun some 57° from overhead (LRO,
// January 2011): slopes facing it are bright, slopes facing away dark, and hollows lie in cast
// shadow - none of which fits the Sun of the scene it is draped over. From the terrain model we
// know each pixel's slope, so the photo's own lighting can be divided out, leaving how bright the
// ground itself is (its albedo, near enough); where the photo shows only shadow there is nothing to
// recover, and the ground's brightness is taken from the lit ground around it.

export interface Raster {
  width: number
  height: number
  // Row by row from the north-west corner; NaN where there is no data.
  data: Float32Array
}

// A direction as east, north, up.
export type Direction = [number, number, number]

// Slopes (rise per metre) toward east and north at a pixel, from its neighbours.
function slopes({ width, height, data }: Raster, index: number, spacing: number): [number, number] {
  const [row, column] = [Math.floor(index / width), index % width]
  const at = (r: number, c: number) => data[Math.min(height - 1, Math.max(0, r)) * width + Math.min(width - 1, Math.max(0, c))]
  const [west, east] = [Math.max(0, column - 1), Math.min(width - 1, column + 1)]
  const [north, south] = [Math.max(0, row - 1), Math.min(height - 1, row + 1)]
  return [(at(row, east) - at(row, west)) / ((east - west) * spacing), (at(north, column) - at(south, column)) / ((south - north) * spacing)]
}

// The photo's Sun, from how its brightness follows the slopes: for a Lambert surface brightness goes
// as sun_up - p sun_east - q sun_north (p, q the slopes east and north, small), so a least-squares
// fit of brightness = a + b p + c q gives the Sun's direction as (-b, -c, a).
export function fitSun(heights: Raster, image: Raster, spacing: number): Direction {
  const { normal, right } = normalEquations(heights, image, spacing)
  // A whisper of damping on the slopes' terms, so ground sloping one way only (no slopes north,
  // say) still gives an answer: that component then comes out nil.
  const damping = normal[0][0] * 1e-9
  normal[1][1] += damping
  normal[2][2] += damping
  const [a, b, c] = solve3(normal, right)
  const length = Math.hypot(a, b, c)
  return [-b / length, -c / length, a / length]
}

// The least-squares normal equations of brightness = a + b p + c q, over every third pixel.
function normalEquations(heights: Raster, image: Raster, spacing: number): { normal: Float64Array[]; right: Float64Array } {
  const normal = [new Float64Array(3), new Float64Array(3), new Float64Array(3)]
  const right = new Float64Array(3)
  for (let i = 0; i < image.data.length; i += 3) {
    const brightness = image.data[i]
    const [p, q] = slopes(heights, i, spacing)
    if (!Number.isFinite(brightness + p + q)) continue
    const x = [1, p, q]
    for (let k = 0; k < 3; k++) {
      right[k] += x[k] * brightness
      for (let j = 0; j < 3; j++) normal[k][j] += x[k] * x[j]
    }
  }
  return { normal, right }
}

function determinant(m: ArrayLike<number>[]): number {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
}

// Cramer's rule, for the 3 × 3 normal equations.
function solve3(m: Float64Array[], right: Float64Array): number[] {
  const whole = determinant(m)
  return [0, 1, 2].map((k) => determinant(m.map((row, i) => Array.from(row, (value, j) => (j === k ? right[i] : value)))) / whole)
}

// Whether a pixel lies in a cast shadow: a ray from it toward the Sun runs into higher ground.
function inCastShadow(heights: Raster, index: number, { sun, spacing, highest }: { sun: Direction; spacing: number; highest: number }): boolean {
  const { width, height, data } = heights
  const across = Math.hypot(sun[0], sun[1])
  if (across < 1e-6) return false
  const [stepColumn, stepRow, rise] = [sun[0] / across, -sun[1] / across, (sun[2] / across) * spacing]
  const [row, column] = [Math.floor(index / width), index % width]
  let ray = data[index]
  for (let step = 1; ray < highest; step++) {
    const [r, c] = [Math.round(row + step * stepRow), Math.round(column + step * stepColumn)]
    if (r < 0 || c < 0 || r >= height || c >= width) return false
    ray += rise
    if (data[r * width + c] > ray) return true
  }
  return false
}

// How much light a pixel gets from the Sun, against flat ground: Lambert, n·s / s_up; 0 in shadow.
function lighting(heights: Raster, sun: Direction, spacing: number): Float32Array {
  const highest = heights.data.reduce((top, value) => (value > top ? value : top), -Infinity)
  return heights.data.map((_, i) => {
    const [p, q] = slopes(heights, i, spacing)
    const facing = (-p * sun[0] - q * sun[1] + sun[2]) / Math.hypot(p, q, 1)
    return facing <= 0 || inCastShadow(heights, i, { sun, spacing, highest }) ? 0 : facing / sun[2]
  })
}

// Light below this (against flat ground) is too little to divide by: the ground there is filled in.
const DIM = 0.25
const [LEAST, MOST] = [0.3, 3]
const FILL_RADII = [6, 24, 96]

// `smoothing`: the heights averaged over a square this many pixels either side before lighting
// them - the terrain model's own narrow artefacts (a seam's wandering edge) then light no line.
export function evenShadows(heights: Raster, image: Raster, { sun, spacing, smoothing = 0 }: { sun: Direction; spacing: number; smoothing?: number }): Raster {
  const light = lighting(smoothing > 0 ? { ...heights, data: boxMeans(heights, smoothing) } : heights, sun, spacing)
  const albedo = image.data.map((brightness, i) => (light[i] >= DIM && Number.isFinite(brightness) ? brightness / Math.min(MOST, Math.max(LEAST, light[i])) : Number.NaN))
  return { width: image.width, height: image.height, data: filled({ width: image.width, height: image.height, data: albedo }) }
}

// NaN pixels given the mean of the known ones around them (a box, wider where the gap is wide).
function filled(raster: Raster): Float32Array {
  const out = Float32Array.from(raster.data)
  for (const radius of FILL_RADII) {
    const means = boxMeans({ ...raster, data: out }, radius)
    out.forEach((value, i) => {
      if (Number.isNaN(value) && Number.isFinite(means[i])) out[i] = means[i]
    })
  }
  return out
}

// The mean of the known values in a square around each pixel (summed-area tables).
function boxMeans({ width, height, data }: Raster, radius: number): Float32Array {
  const [sums, counts] = [new Float64Array((width + 1) * (height + 1)), new Float64Array((width + 1) * (height + 1))]
  for (let row = 0; row < height; row++)
    for (let column = 0; column < width; column++) {
      const value = data[row * width + column]
      const known = Number.isFinite(value)
      const at = (row + 1) * (width + 1) + column + 1
      sums[at] = (known ? value : 0) + sums[at - 1] + sums[at - width - 1] - sums[at - width - 2]
      counts[at] = (known ? 1 : 0) + counts[at - 1] + counts[at - width - 1] - counts[at - width - 2]
    }
  const box = (table: Float64Array, [r0, c0, r1, c1]: number[]) => table[r1 * (width + 1) + c1] - table[r0 * (width + 1) + c1] - table[r1 * (width + 1) + c0] + table[r0 * (width + 1) + c0]
  return Float32Array.from({ length: width * height }, (_, i) => {
    const [row, column] = [Math.floor(i / width), i % width]
    const square = [Math.max(0, row - radius), Math.max(0, column - radius), Math.min(height, row + radius + 1), Math.min(width, column + radius + 1)]
    const count = box(counts, square)
    return count > 0 ? box(sums, square) / count : Number.NaN
  })
}
