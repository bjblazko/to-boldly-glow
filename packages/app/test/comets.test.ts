import { describe, expect, it } from 'vitest'
import { cometActivity, cometState, sceneUnitsPerAu } from '../src/smallBodies/cometActivity'
import { packCometParts } from '../src/smallBodies/cometRenderer'
import { FLOATS_PER_COMET_PART } from '../src/smallBodies/cometShader'
import { COMETS } from '../src/smallBodies/smallBodyCatalog'

const daysSinceJ2000 = (date: string) => (Date.parse(date) - Date.UTC(2000, 0, 1, 12)) / 86400000
const halley = COMETS.find((comet) => comet.id === 'halley')!

describe('cometActivity', () => {
  it('wakes up as a comet nears the Sun, and is stronger for a larger nucleus', () => {
    expect(cometActivity(0.6, 5)).toBeGreaterThan(cometActivity(2, 5))
    expect(cometActivity(2, 5)).toBeGreaterThan(cometActivity(5, 5) * 10)
    expect(cometActivity(1, 30)).toBeGreaterThan(cometActivity(1, 2))
  })
})

describe('cometState', () => {
  it('grows long tails pointing away from the Sun near perihelion, and none far out', () => {
    const atPerihelion = cometState(halley, daysSinceJ2000('1986-02-09T11:00Z'), 1)
    const farOut = cometState(halley, daysSinceJ2000('2023-12-09T00:00Z'), 1)
    expect(atPerihelion.ionTailLength).toBeGreaterThan(farOut.ionTailLength * 100)
    const [x, y, z] = atPerihelion.position
    const outward = (x * atPerihelion.antiSunward[0] + y * atPerihelion.antiSunward[1] + z * atPerihelion.antiSunward[2]) / Math.hypot(x, y, z)
    expect(outward).toBeCloseTo(1, 6)
    expect(atPerihelion.dustTailLength).toBeLessThan(atPerihelion.ionTailLength)
  })

  it('sizes tails by the local scale: 20 scene units per AU at Realistic scale', () => {
    expect(sceneUnitsPerAu(1, 0)).toBe(20)
    expect(sceneUnitsPerAu(1, 1)).toBeCloseTo(30, 6)
  })
})

describe('packCometParts', () => {
  it('lays out every ion tail and dust tail first, then every coma', () => {
    const states = COMETS.slice(0, 2).map((comet) => cometState(comet, 0, 1))
    const parts = packCometParts(states)
    expect(parts).toHaveLength(6 * FLOATS_PER_COMET_PART)
    const kinds = [0, 1, 2, 3, 4, 5].map((part) => parts[part * FLOATS_PER_COMET_PART + 3])
    expect(kinds).toEqual([0, 1, 0, 1, 2, 2])
  })
})
