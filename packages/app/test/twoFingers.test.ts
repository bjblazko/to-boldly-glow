import { describe, expect, it } from 'vitest'
import { twoFingerMove } from '../src/camera/input/twoFingers'

describe('twoFingerMove', () => {
  it('pans by the midpoint when both fingers move alike', () => {
    const move = twoFingerMove([{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 10, y: -4 }, { x: 110, y: -4 }])
    expect(move.pan).toEqual([10, -4])
    expect(move.factor).toBeCloseTo(1, 10)
  })

  it('pinches about a fixed midpoint without panning', () => {
    const move = twoFingerMove([{ x: 50, y: 50 }, { x: 150, y: 50 }], [{ x: 25, y: 50 }, { x: 175, y: 50 }])
    expect(move.pan).toEqual([0, 0])
    expect(move.factor).toBeCloseTo(1.5, 10)
    expect(move.center).toEqual({ x: 100, y: 50 })
  })

  it('pans and pinches in one move', () => {
    const move = twoFingerMove([{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 20 }, { x: 200, y: 20 }])
    expect(move.pan).toEqual([50, 20])
    expect(move.factor).toBeCloseTo(2, 10)
  })

  it('does not pinch from fingers that started on one spot', () => {
    expect(twoFingerMove([{ x: 5, y: 5 }, { x: 5, y: 5 }], [{ x: 0, y: 5 }, { x: 10, y: 5 }]).factor).toBe(1)
  })
})
