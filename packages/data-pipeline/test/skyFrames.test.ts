import { describe, expect, it } from 'vitest'
import { parseBscLine } from '../src/convertBrightStarCatalog'
import { equatorialToGalactic, equatorialToScene, equatorialVector, galacticLongitudeLatitude, galacticVector } from '../src/skyFrames'

const OBLIQUITY = (23.4392911 * Math.PI) / 180

describe('equatorialToScene', () => {
  it('keeps the vernal equinox on the x axis and tips the celestial pole by the obliquity', () => {
    const equinox = equatorialToScene(equatorialVector(0, 0))
    expect(equinox[0]).toBeCloseTo(1, 6)
    const pole = equatorialToScene(equatorialVector(0, 90))
    expect(pole[0]).toBeCloseTo(0, 6)
    expect(pole[1]).toBeCloseTo(Math.sin(OBLIQUITY), 6)
    expect(pole[2]).toBeCloseTo(Math.cos(OBLIQUITY), 6)
  })

  it('puts the summer solstice point, where the Sun stands in June, in the ecliptic plane', () => {
    const solstice = equatorialToScene(equatorialVector(6, 23.4392911))
    expect(solstice[1]).toBeCloseTo(1, 6)
    expect(solstice[2]).toBeCloseTo(0, 6)
  })
})

describe('galactic coordinates', () => {
  // The catalog lists each star's galactic longitude and latitude (bytes 91-102): an independent
  // check of the rotation.
  const LINES = [
    '2491  9Alp CMaBD-16 1591  48915151881 257I   5423           064044.6-163444064508.9-164258227.22-08.88-1.46   0.00 -0.05 -0.03   A1Vm               -0.553-1.205 +.375-008SBO    13 10.3  11.2AB   4*',
    ' 424  1Alp UMiBD+88    8   8890   308 907    1477  Alp UMi  012233.7+884626023148.7+891551123.28 26.46 2.02  +0.60 +0.38 +0.31   F7:Ib-II          v+0.038-0.015 +.007-017SBO    17  6.8  18.4AB   5*',
  ]

  it('matches the galactic longitude and latitude the catalog gives for its stars', () => {
    for (const line of LINES) {
      const star = parseBscLine(line)!
      const { l, b } = galacticLongitudeLatitude(equatorialToGalactic(equatorialVector(star.raHours, star.decDeg)))
      expect(l).toBeCloseTo(Number(line.slice(90, 96)), 1)
      expect(b).toBeCloseTo(Number(line.slice(96, 102)), 1)
    }
  })

  it('puts the galactic center (Sagittarius A*) at l = 0, b = 0', () => {
    const { l, b } = galacticLongitudeLatitude(equatorialToGalactic(equatorialVector(17 + 45.6 / 60, -(28 + 56.2 / 60))))
    expect(Math.min(l, 360 - l)).toBeLessThan(0.1)
    expect(Math.abs(b)).toBeLessThan(0.1)
  })

  it('round-trips longitude and latitude', () => {
    const { l, b } = galacticLongitudeLatitude(galacticVector(287.5, -33.25))
    expect(l).toBeCloseTo(287.5, 6)
    expect(b).toBeCloseTo(-33.25, 6)
  })
})
