import { describe, expect, it } from 'vitest'
import { convertCatalog, FLOATS_PER_STAR, parseBscLine } from '../src/convertBrightStarCatalog'
import { equatorialToScene, equatorialVector } from '../src/skyFrames'

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
    expect(star!.colorIndex).toBeCloseTo(0, 5)
  })

  it('parses Polaris (HR 424) RA/Dec/Vmag correctly', () => {
    const star = parseBscLine(POLARIS_LINE)
    expect(star).not.toBeNull()
    expect(star!.raHours).toBeCloseTo(2 + 31 / 60 + 48.7 / 3600, 4)
    expect(star!.decDeg).toBeCloseTo(89 + 15 / 60 + 51 / 3600, 4)
    expect(star!.vmag).toBeCloseTo(2.02, 5)
    expect(star!.colorIndex).toBeCloseTo(0.6, 5)
  })

  it('falls back to the typical color of the spectral class where B-V is missing', () => {
    const withoutColor = POLARIS_LINE.slice(0, 109) + '     ' + POLARIS_LINE.slice(114)
    expect(parseBscLine(withoutColor)!.colorIndex).toBeCloseTo(0.45, 5)
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

  it('emits direction, magnitude and color per valid star and skips blank/unparseable lines', () => {
    const buffer = convertCatalog([SIRIUS_LINE, BLANK_LINE, SIRIUS_LINE].join('\n'))
    expect(buffer.length).toBe(2 * FLOATS_PER_STAR)
    const sirius = parseBscLine(SIRIUS_LINE)!
    const expected = [...equatorialToScene(equatorialVector(sirius.raHours, sirius.decDeg)), -1.46, 0]
    for (const offset of [0, FLOATS_PER_STAR]) {
      expected.forEach((value, i) => expect(buffer[offset + i]).toBeCloseTo(value, 5))
    }
  })
})
