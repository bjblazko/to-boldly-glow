import { describe, expect, it } from 'vitest'
import { computeCanvasSize } from '../src/renderer/canvasSize'

describe('computeCanvasSize', () => {
  it('matches client size exactly at devicePixelRatio 1', () => {
    expect(computeCanvasSize(800, 600, 1)).toEqual({ width: 800, height: 600 })
  })

  it('scales up by devicePixelRatio for crisp rendering on high-DPI displays', () => {
    expect(computeCanvasSize(800, 600, 2)).toEqual({ width: 1600, height: 1200 })
  })

  it('rounds fractional results from a non-integer devicePixelRatio', () => {
    expect(computeCanvasSize(801, 601, 1.5)).toEqual({ width: 1202, height: 902 })
  })

  it('clamps zero client size to a minimum of 1x1, avoiding an invalid zero-size texture', () => {
    expect(computeCanvasSize(0, 0, 1)).toEqual({ width: 1, height: 1 })
  })
})
