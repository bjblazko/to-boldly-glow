import { describe, expect, it } from 'vitest'
import { FrameRate } from '../src/hud/fpsMeter'

describe('FrameRate', () => {
  it('has no reading before half a second of frames', () => {
    const rate = new FrameRate()
    expect(rate.addFrame(0.1)).toBe(false)
    expect(rate.perSecond).toBeNull()
  })

  it('reads frames per second over each half second', () => {
    const rate = new FrameRate()
    // Frame times that add up exactly in binary: 32 frames of 1/64 s are half a second.
    const ready = Array.from({ length: 32 }, () => rate.addFrame(1 / 64))
    expect(ready.filter(Boolean)).toHaveLength(1)
    expect(rate.perSecond).toBe(64)
  })

  it('starts each half second afresh, so a slow stretch shows up', () => {
    const rate = new FrameRate()
    for (let i = 0; i < 32; i++) rate.addFrame(1 / 64)
    for (let i = 0; i < 4; i++) rate.addFrame(1 / 8)
    expect(rate.perSecond).toBe(8)
  })
})
