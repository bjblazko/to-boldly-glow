import { describe, expect, it } from 'vitest'
import { regolithAt } from '../src/apollo/terrain/regolithDetail'

describe('the regolith tile', () => {
  it('repeats seamlessly: its edges meet', () => {
    for (const t of [0.1, 0.37, 0.8]) {
      const [a, b] = [regolithAt(0, t), regolithAt(1 - 1e-9, t)]
      expect(Math.abs(a[0] - b[0])).toBeLessThan(0.15)
    }
  })

  it('has relief and lightness in range', () => {
    const samples = Array.from({ length: 400 }, (_, i) => regolithAt((i * 0.618) % 1, (i * 0.371) % 1))
    const heights = samples.map((s) => s[0])
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.3)
    for (const [h, l] of samples) {
      expect(h).toBeGreaterThanOrEqual(0)
      expect(l).toBeLessThanOrEqual(1)
    }
  })
})
