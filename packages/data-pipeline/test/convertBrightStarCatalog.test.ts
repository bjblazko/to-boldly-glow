import { describe, expect, it } from 'vitest'
import {
  convertCatalog,
  magnitudeToBrightness,
  parseBscLine,
  raDecToUnitVector,
} from '../src/convertBrightStarCatalog'

describe('raDecToUnitVector', () => {
  it('always produces a unit-length vector', () => {
    const samples: [number, number][] = [
      [0, 0],
      [6.75, -16.72],
      [2.53, 89.26],
      [23.99, -89.99],
      [12, 45],
    ]
    for (const [raHours, decDeg] of samples) {
      const [x, y, z] = raDecToUnitVector(raHours, decDeg)
      expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(1, 5)
    }
  })

  it('maps a declination of +90 to straight up regardless of RA', () => {
    const [x, y, z] = raDecToUnitVector(5, 90)
    expect(x).toBeCloseTo(0, 5)
    expect(y).toBeCloseTo(1, 5)
    expect(z).toBeCloseTo(0, 5)
  })
})

describe('magnitudeToBrightness', () => {
  it('is monotonically decreasing as magnitude increases (dimmer stars are less bright)', () => {
    const magnitudes = [-1.46, -1, 0, 1, 2, 3, 4, 5, 6, 6.5]
    const brightnesses = magnitudes.map(magnitudeToBrightness)
    for (let i = 1; i < brightnesses.length; i++) {
      expect(brightnesses[i]).toBeLessThan(brightnesses[i - 1])
    }
  })

  it('clamps out-of-range magnitudes to the same brightness as the range boundary', () => {
    expect(magnitudeToBrightness(-10)).toBeCloseTo(magnitudeToBrightness(-1.46), 5)
    expect(magnitudeToBrightness(20)).toBeCloseTo(magnitudeToBrightness(6.5), 5)
  })

  it('stays within [0.05, 1.0] for any input', () => {
    for (const vmag of [-1.46, -1, 0, 3.5, 6.5, -100, 100]) {
      const brightness = magnitudeToBrightness(vmag)
      expect(brightness).toBeGreaterThanOrEqual(0.05)
      expect(brightness).toBeLessThanOrEqual(1.0)
    }
  })
})

describe('parseBscLine', () => {
  // Real BSC5 (CDS V/50 ASCII edition) lines, hand-transcribed from the catalog file. HR numbers
  // match the line number in the source file. Expected RA/Dec/Vmag are the real, independently
  // known J2000 values for these stars, used here as a ground-truth check on the byte offsets.
  const SIRIUS_LINE =
    '2491  9Alp CMaBD-16 1591  48915151881 257I   5423           064044.6-163444064508.9-164258227.22-08.88-1.46   0.00 -0.05 -0.03   A1Vm               -0.553-1.205 +.375-008SBO    13 10.3  11.2AB   4*'
  const POLARIS_LINE =
    ' 424  1Alp UMiBD+88    8   8890   308 907    1477  Alp UMi  012233.7+884626023148.7+891551123.28 26.46 2.02  +0.60 +0.38 +0.31   F7:Ib-II          v+0.038-0.015 +.007-017SBO    17  6.8  18.4AB   5*'

  it('parses Sirius (HR 2491) RA/Dec/Vmag correctly', () => {
    const star = parseBscLine(SIRIUS_LINE)
    expect(star).not.toBeNull()
    expect(star!.raHours).toBeCloseTo(6 + 45 / 60 + 8.9 / 3600, 4)
    expect(star!.decDeg).toBeCloseTo(-(16 + 42 / 60 + 58 / 3600), 4)
    expect(star!.vmag).toBeCloseTo(-1.46, 5)
  })

  it('parses Polaris (HR 424) RA/Dec/Vmag correctly', () => {
    const star = parseBscLine(POLARIS_LINE)
    expect(star).not.toBeNull()
    expect(star!.raHours).toBeCloseTo(2 + 31 / 60 + 48.7 / 3600, 4)
    expect(star!.decDeg).toBeCloseTo(89 + 15 / 60 + 51 / 3600, 4)
    expect(star!.vmag).toBeCloseTo(2.02, 5)
  })

  it('returns null for a blank/short line', () => {
    expect(parseBscLine('')).toBeNull()
    expect(parseBscLine('   1'.padEnd(106, ' '))).toBeNull()
  })
})

describe('convertCatalog', () => {
  const SIRIUS_LINE =
    '2491  9Alp CMaBD-16 1591  48915151881 257I   5423           064044.6-163444064508.9-164258227.22-08.88-1.46   0.00 -0.05 -0.03   A1Vm               -0.553-1.205 +.375-008SBO    13 10.3  11.2AB   4*'
  const BLANK_LINE = ''

  it('emits 4 floats per valid star and skips blank/unparseable lines', () => {
    const buffer = convertCatalog([SIRIUS_LINE, BLANK_LINE, SIRIUS_LINE].join('\n'))
    expect(buffer.length).toBe(2 * 4)
    // Both entries are the same star, so their unit vectors and brightness should match.
    expect(buffer[0]).toBeCloseTo(buffer[4], 5)
    expect(buffer[1]).toBeCloseTo(buffer[5], 5)
    expect(buffer[2]).toBeCloseTo(buffer[6], 5)
    expect(buffer[3]).toBeCloseTo(buffer[7], 5)
  })
})
