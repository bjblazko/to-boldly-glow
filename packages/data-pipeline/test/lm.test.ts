import { describe, expect, it } from 'vitest'
import { COCKPIT_ASSEMBLIES, LM_ASSEMBLIES, lmAssemblyKind, lmExplodeOffset, lmInsides } from '../src/apollo/lmParts'
import { LM_HEIGHTS } from '../src/apollo/lmProfile'

const FT = 0.3048
const IN = 0.0254

describe('the lunar module', () => {
  it('has the News Reference sizes: 22 ft 11 in tall, the descent stage 10 ft 7 in of it', () => {
    expect(LM_HEIGHTS.overall).toBeCloseTo(22 * FT + 11 * IN, 3)
    expect(LM_HEIGHTS.interstage).toBeCloseTo(10 * FT + 7 * IN, 3)
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
