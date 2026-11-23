import { describe, expect, it } from 'vitest'
import { getSeconds } from '../src/missions/apollo11/apollo11Events'
import { burnsAt } from '../src/missions/apollo11/engineBurns'

describe("the engines' burns", () => {
  it('lights the J-2 for TLI, the SPS for LOI and TEI, the descent and ascent engines on the Moon', () => {
    expect(burnsAt(getSeconds('002:47:00'))).toEqual([{ engine: 'j2', strength: 1 }])
    expect(burnsAt(getSeconds('075:52:00'))[0].engine).toBe('sps')
    expect(burnsAt(getSeconds('135:25:00'))[0].engine).toBe('sps')
    expect(burnsAt(getSeconds('102:40:00'))[0].engine).toBe('descent')
    expect(burnsAt(getSeconds('124:25:00'))[0].engine).toBe('ascent')
    expect(burnsAt(getSeconds('090:00:00'))).toEqual([])
  })

  it('throttles the descent: low at first, full, then down to land', () => {
    const at = (t: string) => burnsAt(getSeconds(t))[0].strength
    expect(at('102:33:20')).toBeCloseTo(0.1, 6)
    expect(at('102:36:00')).toBe(1)
    expect(at('102:44:00')).toBeCloseTo(0.55, 6)
  })

  it('eases each burn in and out', () => {
    expect(burnsAt(getSeconds('002:44:16.80'))[0].strength).toBeGreaterThan(0.3)
    expect(burnsAt(getSeconds('002:44:16.80'))[0].strength).toBeLessThan(0.7)
  })
})
