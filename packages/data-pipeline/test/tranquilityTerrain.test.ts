import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fitSun, evenShadows, type Raster } from '../src/apollo/terrain/evenShadows'
import { mapGeometry, parseLabel, pixelOf } from '../src/apollo/terrain/pdsLabel'
import { destriped, withoutSeams } from '../src/apollo/terrain/seams'
import { cropAround, halve, packHeights } from '../src/apollo/terrain/tranquilityTile'

const LABEL = `PDS_VERSION_ID                  = PDS3\r
PRODUCT_ID                      = "NAC_DTM_APOLLO11"\r
RATIONALE_DESC                  = "Created to enable lunar science and\r
                                  exploration activities"\r
OBJECT                          = IMAGE_MAP_PROJECTION\r
  CENTER_LATITUDE               = 1.0 <DEG>\r
  CENTER_LONGITUDE              = 180.0 <DEG>\r
  A_AXIS_RADIUS                 = 1737.4 <KM>\r
  MAP_SCALE                     = 2.0000000000006 <METERS/PIXEL>\r
  MAXIMUM_LATITUDE              = 1.2365388 <DEG>\r
  MINIMUM_LATITUDE              = 0.314609 <DEG>\r
  EASTERNMOST_LONGITUDE         = 23.5115296 <DEG>\r
  WESTERNMOST_LONGITUDE         = 23.3722758 <DEG>\r
  LINE_PROJECTION_OFFSET        = 18747.5\r
  SAMPLE_PROJECTION_OFFSET      = 2374376.5\r
END_OBJECT                      = IMAGE_MAP_PROJECTION\r
END\r
`

describe('the PDS label and the map geometry', () => {
  it('reads values, with units and strings over several lines', () => {
    const label = parseLabel(LABEL)
    expect(label.PRODUCT_ID).toBe('NAC_DTM_APOLLO11')
    expect(label.RATIONALE_DESC).toBe('Created to enable lunar science and exploration activities')
    expect(label.MAP_SCALE).toBe('2.0000000000006')
  })

  it("puts the strip's corners on its first and last pixels", () => {
    const geometry = mapGeometry(parseLabel(LABEL))
    const northWest = pixelOf(geometry, 1.2365388, 23.3722758)
    const southEast = pixelOf(geometry, 0.314609, 23.5115296)
    expect(Math.abs(northWest.line)).toBeLessThan(1)
    expect(Math.abs(northWest.sample)).toBeLessThan(1)
    expect(Math.abs(southEast.line - 13977)).toBeLessThan(1)
    expect(Math.abs(southEast.sample - 2110)).toBeLessThan(1)
  })
})

// A ridge running north-south: its west face rises toward the east, its east face falls; the same
// albedo everywhere, lit by a Lambert sun low in the west.
function ridge(sun: [number, number, number]): { heights: Raster; image: Raster } {
  const size = 64
  const heights = new Float32Array(size * size)
  const image = new Float32Array(size * size)
  for (let row = 0; row < size; row++)
    for (let column = 0; column < size; column++) {
      const slope = column < size / 2 ? 0.2 : -0.2
      heights[row * size + column] = (column < size / 2 ? column : size - column) * 0.2 * 2
      const normal = [-slope, 0, 1].map((value) => value / Math.hypot(slope, 1))
      image[row * size + column] = 0.5 * Math.max(0, normal[0] * sun[0] + normal[1] * sun[1] + normal[2] * sun[2])
    }
  return { heights: { width: size, height: size, data: heights }, image: { width: size, height: size, data: image } }
}

describe('evening out the photo’s shadows', () => {
  const elevation = (33 * Math.PI) / 180
  const sun: [number, number, number] = [-Math.cos(elevation), 0, Math.sin(elevation)]

  it("finds the photo's sun from how brightness follows the slopes", () => {
    const { heights, image } = ridge(sun)
    const found = fitSun(heights, image, 2)
    expect(found[0]).toBeCloseTo(sun[0], 1)
    expect(Math.abs(found[1])).toBeLessThan(0.05)
    expect(found[2]).toBeCloseTo(sun[2], 1)
  })

  it('makes a lit and a turned-away face of the same ground come out alike', () => {
    const { heights, image } = ridge(sun)
    const albedo = evenShadows(heights, image, { sun, spacing: 2 }).data
    const [west, east] = [albedo[20 * 64 + 10], albedo[20 * 64 + 50]]
    expect(image.data[20 * 64 + 50] / image.data[20 * 64 + 10]).toBeLessThan(0.75)
    expect(Math.abs(west - east) / west).toBeLessThan(0.05)
  })
})

describe('the tile', () => {
  it('crops a square around a pixel and halves it by averaging', () => {
    const data = Float32Array.from({ length: 100 }, (_, i) => i)
    const crop = cropAround({ width: 10, height: 10, data }, { line: 5, sample: 4 }, 4)
    expect(crop.raster.width).toBe(4)
    expect(Array.from(crop.raster.data.slice(0, 4))).toEqual([32, 33, 34, 35])
    expect(crop.origin).toEqual({ line: 3, sample: 2 })
    const half = halve(crop.raster)
    expect(half.width).toBe(2)
    expect(half.data[0]).toBeCloseTo((32 + 33 + 42 + 43) / 4)
  })

  it('packs heights into 16 bits to the millimetre', () => {
    const heights = { width: 2, height: 2, data: Float32Array.from([-66.2, 0, 12.345, 40.1]) }
    const packed = packHeights(heights)
    expect(packed.values.length).toBe(4)
    packed.values.forEach((value, i) => expect(Math.abs(packed.offset + value * packed.scale - heights.data[i])).toBeLessThan(0.002))
  })

  it('stays a few megabytes (the built files, if built)', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const meta = JSON.parse(readFileSync(join(here, '../../app/public/data/apollo11/terrain/tranquility.json'), 'utf8')) as { heights: { width: number; height: number }; site: { heights: { x: number; y: number } } }
    const bytes = readFileSync(join(here, '../../app/public/data/apollo11/terrain/tranquility-heights.bin')).length
    const photo = readFileSync(join(here, '../../app/public/data/apollo11/terrain/tranquility-albedo.jpg')).length
    expect(bytes).toBe(meta.heights.width * meta.heights.height * 2)
    expect(bytes + photo).toBeLessThan(6_000_000)
    expect(meta.site.heights.x).toBeGreaterThan(0)
    expect(meta.site.heights.x).toBeLessThan(meta.heights.width)
  })
})

describe("the terrain model's seams", () => {
  // Gently sloping ground with small bumps; optionally a stereo models' seam: everything east of a
  // column stands 0.6 m higher.
  const ground = (seam: boolean): Raster => {
    const size = 120
    const data = Float32Array.from({ length: size * size }, (_, i) => {
      const [row, column] = [Math.floor(i / size), i % size]
      return 0.03 * column + 0.4 * Math.sin(row * 0.7) * Math.cos(column * 1.3) + (seam && column > 60 ? 0.6 : 0)
    })
    return { width: size, height: size, data }
  }
  const step = (raster: Raster, column: number) => {
    const steps = Array.from({ length: raster.height }, (_, row) => raster.data[row * raster.width + column + 1] - raster.data[row * raster.width + column]).sort((a, b) => a - b)
    return steps[steps.length >> 1]
  }

  it('takes out a step running the whole height of the tile', () => {
    const smoothed = withoutSeams(ground(true))
    expect(step(ground(true), 60)).toBeGreaterThan(0.5)
    expect(Math.abs(step(smoothed, 60) - step(smoothed, 50))).toBeLessThan(0.05)
  })

  it('leaves ground without a seam as it was', () => {
    const plain = ground(false)
    expect(Array.from(withoutSeams(plain).data)).toEqual(Array.from(plain.data))
  })
})

describe('stripes in the evened-out photo', () => {
  const speckled = (stripe: boolean): Raster => {
    const size = 100
    const data = Float32Array.from({ length: size * size }, (_, i) => {
      const [row, column] = [Math.floor(i / size), i % size]
      const ground = 100 + 20 * Math.sin(row * 1.7 + column * 0.9) * Math.cos(row * 0.3)
      return stripe && (column === 40 || column === 41) ? ground * 0.9 : ground
    })
    return { width: size, height: size, data }
  }
  const columnMean = (raster: Raster, column: number) => Array.from({ length: raster.height }, (_, row) => raster.data[row * raster.width + column]).reduce((a, b) => a + b) / raster.height

  it('lifts a column darker from top to bottom up to its neighbours', () => {
    const fixed = destriped(speckled(true))
    expect(columnMean(speckled(true), 40) / columnMean(speckled(true), 30)).toBeLessThan(0.92)
    expect(Math.abs(columnMean(fixed, 40) / columnMean(fixed, 30) - 1)).toBeLessThan(0.02)
  })

  it('leaves a photo without stripes as it was', () => {
    expect(Array.from(destriped(speckled(false)).data)).toEqual(Array.from(speckled(false).data))
  })
})
