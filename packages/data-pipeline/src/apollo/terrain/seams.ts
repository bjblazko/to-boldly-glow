import type { Raster } from './evenShadows'

// The terrain model's seams. LROC's NAC terrain models are stitched from several stereo models
// along the strip; where two meet the heights may step by up to a metre (the product's README,
// "NACL and NACR seams") - here a line running the length of the tile, north to south. A lit
// surface would show it as a bright or dark line. Between each two columns we take the step every
// row agrees on (the median); real ground sloping east or west steps alike over many columns, a
// seam stands out over a few: what stands out well above the columns around it is taken away from
// everything east of it. The seam wanders by a column or two from row to row, so the photo evened
// out with these heights may still show a faint line: that is taken out of the photo the same way
// (a column brighter or darker from top to bottom than its neighbours is an artefact).

// Columns either side compared with (a regional slope or brightness is what they share).
const NEIGHBOURS = 15
// How far above the noise a value must stand, and at least; its soft edges, leaning the same way,
// are taken with it down to EDGE_NOISE_TIMES the noise.
const NOISE_TIMES = 6
const EDGE_NOISE_TIMES = 1

const median = (values: ArrayLike<number>) => {
  const sorted = Float64Array.from(values).sort()
  return sorted[sorted.length >> 1]
}

// How much each value in a run stands above the values around it, where it stands out at all
// (by more than `least`); 0 elsewhere.
export function standingOut(values: number[], least: number): number[] {
  const excess = values.map((value, i) => value - median(values.slice(Math.max(0, i - NEIGHBOURS), i + NEIGHBOURS + 1)))
  const noise = 1.4826 * median(excess.map(Math.abs))
  const threshold = Math.max(NOISE_TIMES * noise, least)
  const marked = excess.map((value) => Math.abs(value) > threshold)
  const edge = (i: number, from: number) => i >= 0 && i < excess.length && !marked[i] && Math.sign(excess[i]) === Math.sign(excess[from]) && Math.abs(excess[i]) > EDGE_NOISE_TIMES * noise
  for (const core of excess.flatMap((value, i) => (Math.abs(value) > threshold ? [i] : []))) {
    for (const way of [-1, 1]) for (let i = core + way; edge(i, core); i += way) marked[i] = true
  }
  return excess.map((value, i) => (marked[i] ? value : 0))
}

// A column's values, top to bottom.
function column({ width, height, data }: Raster, index: number, of: (value: number, i: number) => number): number[] {
  return Array.from({ length: height }, (_, row) => of(data[row * width + index], row * width + index))
}

// Steps (metres) between columns that stand out: seams. At least 3 cm, below which no light shows it.
export function seamSteps(raster: Raster): number[] {
  const steps = Array.from({ length: raster.width - 1 }, (_, index) => median(column(raster, index, (value, i) => raster.data[i + 1] - value)))
  return standingOut(steps, 0.03)
}

export function withoutSeams(raster: Raster): Raster {
  const seams = seamSteps(raster)
  if (seams.every((value) => value === 0)) return raster
  const shift = new Float32Array(raster.width)
  for (let index = 1; index < raster.width; index++) shift[index] = shift[index - 1] + seams[index - 1]
  return { ...raster, data: raster.data.map((value, i) => value - shift[i % raster.width]) }
}

// The photo with columns brighter or darker than their neighbours (by at least half a percent)
// brought back in line.
export function destriped(raster: Raster): Raster {
  const levels = Array.from({ length: raster.width }, (_, index) => Math.log(median(column(raster, index, (value) => value))))
  const stripes = standingOut(levels, 0.005)
  if (stripes.every((value) => value === 0)) return raster
  return { ...raster, data: raster.data.map((value, i) => value * Math.exp(-stripes[i % raster.width])) }
}
