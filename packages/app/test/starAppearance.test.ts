import { describe, expect, it } from 'vitest'
import { CATALOG_FLOATS_PER_STAR, colorTemperature, FLOATS_PER_STAR_INSTANCE, spikeStrength, starColor, starInstances, starIntensity } from '../src/starfield/starAppearance'

describe('star colors', () => {
  it('turns a B-V color index into the temperature of a blackbody of that color', () => {
    expect(colorTemperature(0.65)).toBeCloseTo(5780, -2)
    expect(colorTemperature(-0.3)).toBeGreaterThan(15000)
    expect(colorTemperature(1.85)).toBeLessThan(3500)
  })

  it('makes hot stars blue-white and cool ones orange', () => {
    const [r1, , b1] = starColor(-0.2)
    const [r2, , b2] = starColor(1.6)
    expect(b1).toBeGreaterThan(r1)
    expect(r2).toBeGreaterThan(b2 * 2)
  })
})

describe('star brightness', () => {
  it('compresses the catalog flux range, saturating at the brightest stars', () => {
    expect(starIntensity(1)).toBeCloseTo(1, 6)
    expect(starIntensity(6)).toBeGreaterThan(0.05)
    expect(starIntensity(-1.46)).toBeLessThanOrEqual(3)
  })

  it('gives only the brightest stars diffraction spikes', () => {
    expect(spikeStrength(3)).toBe(0)
    expect(spikeStrength(-1.46)).toBeGreaterThan(0.9)
  })
})

describe('starInstances', () => {
  it('turns each catalog record into the shader instance layout', () => {
    const catalog = new Float32Array([0, 0, 1, 1, 0.65, 1, 0, 0, 5, 1.2])
    const instances = starInstances(catalog)
    expect(instances).toHaveLength((catalog.length / CATALOG_FLOATS_PER_STAR) * FLOATS_PER_STAR_INSTANCE)
    expect(Array.from(instances.slice(0, 4))).toEqual([0, 0, 1, 1])
  })
})
