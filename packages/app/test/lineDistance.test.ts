import { describe, expect, it } from 'vitest'
import { computeCumulativeLineDistances } from '../src/renderer/lineDistance'

describe('computeCumulativeLineDistances', () => {
  it('returns [0] for a single point', () => {
    const points = new Float32Array([1, 2, 3])
    expect(Array.from(computeCumulativeLineDistances(points))).toEqual([0])
  })

  it('accumulates Euclidean distance along a right-angle path', () => {
    // (0,0,0) -> (3,0,0) -> (3,4,0): segment lengths 3 and 4 (a path along two legs of a
    // 3-4-5 right triangle, not the 5-length hypotenuse — the two segments are traversed in
    // turn, not shortcut in a straight line).
    const points = new Float32Array([0, 0, 0, 3, 0, 0, 3, 4, 0])
    const distances = Array.from(computeCumulativeLineDistances(points))
    expect(distances[0]).toBeCloseTo(0, 10)
    expect(distances[1]).toBeCloseTo(3, 10)
    expect(distances[2]).toBeCloseTo(7, 10)
  })

  it('produces a monotonically non-decreasing sequence for an arbitrary path', () => {
    const points = new Float32Array([0, 0, 0, 1, 1, 1, 0.5, 0.5, 0.5, 2, 0, 0])
    const distances = Array.from(computeCumulativeLineDistances(points))
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1])
    }
  })
})
