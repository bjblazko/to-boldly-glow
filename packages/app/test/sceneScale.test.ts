import { describe, expect, it } from 'vitest'
import {
  AU_TO_SCENE_UNITS,
  explorerDistanceUnits,
  geometricBlend,
  scaledBodyRadiusUnits,
  scaledDistanceUnits,
  scaledPosition,
} from '../src/solarSystem/sceneScale'

const AU_KM = 149_597_870.7

describe('scaledDistanceUnits', () => {
  it('matches the linear realistic scale at blend 0', () => {
    expect(scaledDistanceUnits(5, 0)).toBeCloseTo(5 * AU_TO_SCENE_UNITS, 10)
  })

  it('matches the log1p explorer scale at blend 1', () => {
    expect(scaledDistanceUnits(5, 1)).toBeCloseTo(explorerDistanceUnits(5), 10)
  })

  it('interpolates linearly between the two endpoints at blend 0.5', () => {
    const realistic = 5 * AU_TO_SCENE_UNITS
    const explorer = explorerDistanceUnits(5)
    expect(scaledDistanceUnits(5, 0.5)).toBeCloseTo((realistic + explorer) / 2, 10)
  })

  it('compresses far distances more than near ones in explorer mode', () => {
    const mercuryAu = 0.39
    const neptuneAu = 30.1
    const ratioRealistic = scaledDistanceUnits(neptuneAu, 0) / scaledDistanceUnits(mercuryAu, 0)
    const ratioExplorer = scaledDistanceUnits(neptuneAu, 1) / scaledDistanceUnits(mercuryAu, 1)
    expect(ratioExplorer).toBeLessThan(ratioRealistic)
  })
})

describe('geometricBlend', () => {
  it('matches the realistic endpoint at blend 0', () => {
    expect(geometricBlend(0.00085, 1.0, 0)).toBeCloseTo(0.00085, 10)
  })

  it('matches the explorer endpoint at blend 1', () => {
    expect(geometricBlend(0.00085, 1.0, 1)).toBeCloseTo(1.0, 10)
  })

  it('is the geometric mean of the two endpoints at blend 0.5', () => {
    expect(geometricBlend(0.00085, 1.0, 0.5)).toBeCloseTo(Math.sqrt(0.00085 * 1.0), 10)
  })
})

describe('scaledBodyRadiusUnits', () => {
  it('matches the true-to-scale radius at blend 0', () => {
    const result = scaledBodyRadiusUnits(6371, 1.0, 0, AU_KM)
    expect(result).toBeCloseTo((6371 / AU_KM) * AU_TO_SCENE_UNITS, 10)
  })

  it('matches the hand-picked explorer radius at blend 1', () => {
    expect(scaledBodyRadiusUnits(6371, 1.0, 1, AU_KM)).toBeCloseTo(1.0, 10)
  })

  it('interpolates geometrically (not linearly) between the two endpoints at blend 0.5', () => {
    const realistic = (6371 / AU_KM) * AU_TO_SCENE_UNITS
    const explorer = 1.0
    const atHalf = scaledBodyRadiusUnits(6371, explorer, 0.5, AU_KM)
    expect(atHalf).toBeCloseTo(Math.sqrt(realistic * explorer), 10)
  })
})

describe('scaledPosition', () => {
  it('preserves direction while rescaling magnitude', () => {
    const [x, y, z] = scaledPosition(3, 4, 0, 5, 0)
    const expectedFactor = scaledDistanceUnits(5, 0) / 5
    expect(x).toBeCloseTo(3 * expectedFactor, 10)
    expect(y).toBeCloseTo(4 * expectedFactor, 10)
    expect(z).toBeCloseTo(0, 10)
  })

  it('returns the origin for a body at zero distance (the Sun)', () => {
    expect(scaledPosition(0, 0, 0, 0, 0.7)).toEqual([0, 0, 0])
  })
})
