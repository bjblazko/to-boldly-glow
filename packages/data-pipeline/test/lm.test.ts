import { describe, expect, it } from 'vitest'
import { applyHinge, hingeMatrix } from '../../app/src/spacecraft/modelHinge'
import { COCKPIT_ASSEMBLIES, LM_ASSEMBLIES, lmAssemblyKind, lmExplodeOffset, lmInsides } from '../src/apollo/lmParts'
import { ASCENT_STAGE, DESCENT_STAGE, FOOTPAD, LEGS, legHinge, LM_HEIGHTS, PROBE_LENGTH } from '../src/apollo/lmProfile'

const FT = 0.3048
const IN = 0.0254

describe('the lunar module', () => {
  it('has the News Reference sizes: 22 ft 11 in tall, 31 ft across the gear, both stages 14 ft 1 in wide', () => {
    expect(LM_HEIGHTS.overall).toBeCloseTo(22 * FT + 11 * IN, 3)
    expect(LM_HEIGHTS.ascentTop - LM_HEIGHTS.interstage).toBeCloseTo(12 * FT + 4 * IN, 3)
    expect(LM_HEIGHTS.interstage).toBeCloseTo(10 * FT + 7 * IN, 3)
    expect(DESCENT_STAGE.width).toBeCloseTo(14 * FT + 1 * IN, 3)
    expect(ASCENT_STAGE.width).toBeCloseTo(14 * FT + 1 * IN, 3)
  })

  it('stands on four 37 in footpads, 31 ft across from edge to edge', () => {
    expect(LEGS).toHaveLength(4)
    expect(FOOTPAD.radius * 2).toBeCloseTo(37 * IN, 3)
    const [front, , back] = LEGS
    const across = Math.hypot(front.footpad[0] - back.footpad[0], front.footpad[2] - back.footpad[2]) + FOOTPAD.radius * 2
    expect(across).toBeCloseTo(31 * FT, 2)
    for (const leg of LEGS) expect(leg.footpad[1]).toBeCloseTo(0, 6)
  })

  it('has its probes about 5 ft long on three legs - none on the ladder leg in front (+Z)', () => {
    expect(PROBE_LENGTH).toBeCloseTo(5 * FT, 3)
    expect(LEGS.filter((leg) => leg.probe).map((leg) => leg.azimuthDegrees)).toEqual([90, 180, 270])
    expect(LEGS[0].azimuthDegrees).toBe(0)
  })

  it('folds each leg up beside the stages, inside the adapter (6.6 m across) and lower than the top', () => {
    for (const leg of LEGS) {
      const folded = applyHinge(hingeMatrix(legHinge(leg), 1), leg.footpad)
      expect(Math.hypot(folded[0], folded[2]) + FOOTPAD.radius, `leg at ${leg.azimuthDegrees}°`).toBeLessThan(3.3)
      expect(folded[1]).toBeGreaterThan(LM_HEIGHTS.interstage)
      expect(folded[1]).toBeLessThan(LM_HEIGHTS.overall)
    }
  })
})


describe("Eagle's parts", () => {
  it('are at most 16 to a model, the stages\' shells cut open, what is in them shown then', () => {
    expect(LM_ASSEMBLIES.length).toBeLessThanOrEqual(16)
    expect(COCKPIT_ASSEMBLIES.length).toBeLessThanOrEqual(16)
    expect(LM_ASSEMBLIES.filter((assembly) => lmAssemblyKind(assembly) === 'shell')).toEqual(['descent', 'ascent'])
    expect([...COCKPIT_ASSEMBLIES, 'descentInside', 'ascentInside'].every((assembly) => lmAssemblyKind(assembly as never) === 'inside')).toBe(true)
  })

  it('lift the cockpit and the ascent stage\'s inside with the ascent stage', () => {
    for (const assembly of [...COCKPIT_ASSEMBLIES, 'ascentInside'] as const) expect(lmExplodeOffset(assembly)).toEqual(lmExplodeOffset('ascent'))
    expect(lmExplodeOffset('descent')).toEqual([0, 0, 0])
  })

  it('add the stages\' tanks and engines and the person to NASSP\'s outside', () => {
    expect([...lmInsides().keys()]).toEqual(['descentInside', 'ascentInside', 'person'])
  })
})
