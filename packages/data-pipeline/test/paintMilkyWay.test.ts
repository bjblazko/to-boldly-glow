import { describe, expect, it } from 'vitest'
import { skyColor, skyNoise, toByte } from '../src/paintMilkyWay'
import { DEEP_SKY_OBJECTS } from '../src/milkyWay/deepSky'
import { ellipticalRadius, placeObject } from '../src/milkyWay/deepSkyLight'
import { equatorialToGalactic, equatorialVector, galacticVector } from '../src/skyFrames'

const noise = skyNoise()
const objects = DEEP_SKY_OBJECTS.map(placeObject)
const luminance = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const meanLuminance = (l: number, b: number) => {
  let sum = 0
  for (let i = 0; i < 25; i++) sum += luminance(skyColor(galacticVector(l + (i % 5) - 2, b + Math.floor(i / 5) - 2), objects, noise))
  return sum / 25
}

describe('the painted sky', () => {
  it('is brightest toward the galactic center, fainter along the plane, and dark at the galactic poles', () => {
    const center = meanLuminance(0, 4)
    const anticenter = meanLuminance(180, 0)
    const pole = meanLuminance(0, 85)
    expect(center).toBeGreaterThan(anticenter)
    expect(anticenter).toBeGreaterThan(pole * 5)
    expect(pole).toBeLessThan(0.005)
  })

  it('shows the Andromeda Galaxy where it is, in the otherwise empty sky beside it', () => {
    const m31 = equatorialToGalactic(equatorialVector(0.7123, 41.27))
    const beside = equatorialToGalactic(equatorialVector(0.7123, 48))
    expect(luminance(skyColor(m31, objects, noise))).toBeGreaterThan(luminance(skyColor(beside, objects, noise)) * 5)
  })

  it('places every object at the center of its own ellipse', () => {
    for (const placed of objects) expect(ellipticalRadius(placed, placed.center).radius, placed.object.name).toBeCloseTo(0, 6)
  })
})

describe('toByte', () => {
  it('stores the square root of the color, for finer steps near black', () => {
    expect(toByte(0.25, 0)).toBe(127)
    expect(toByte(1 / 255 ** 2, 0.5)).toBe(1)
    expect(toByte(-1, 0)).toBe(0)
    expect(toByte(4, 0)).toBe(255)
  })
})
