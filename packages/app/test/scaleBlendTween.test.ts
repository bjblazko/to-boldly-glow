import { describe, expect, it } from 'vitest'
import { ScaleBlendTween } from '../src/solarSystem/scaleBlendTween'

describe('ScaleBlendTween', () => {
  it('starts at rest (not animating) at its initial value', () => {
    const tween = new ScaleBlendTween(1)
    expect(tween.isAnimating).toBe(false)
    expect(tween.target).toBe(1)
  })

  it('animates from the initial value to the retargeted value over the full duration', () => {
    const tween = new ScaleBlendTween(1, 2)
    tween.retarget(0, 1)
    expect(tween.isAnimating).toBe(true)
    expect(tween.update(0)).toBeCloseTo(1, 10)
    const mid = tween.update(1)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    const end = tween.update(1)
    expect(end).toBeCloseTo(0, 10)
    expect(tween.isAnimating).toBe(false)
  })

  it('stops animating once the duration elapses, even if update is called again', () => {
    const tween = new ScaleBlendTween(1, 1)
    tween.retarget(0, 1)
    tween.update(1)
    expect(tween.isAnimating).toBe(false)
    expect(tween.update(0.5)).toBeCloseTo(0, 10)
  })

  it('re-targeting mid-tween continues smoothly from the current value, not the original start', () => {
    const tween = new ScaleBlendTween(0, 2)
    tween.retarget(1, 0)
    const midway = tween.update(1) // halfway to 1
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(1)

    // Flip back toward 0 from wherever the tween currently is, not from the original start (0).
    tween.retarget(0, midway)
    expect(tween.isAnimating).toBe(true)
    expect(tween.update(0)).toBeCloseTo(midway, 10)
    const settled = tween.update(2)
    expect(settled).toBeCloseTo(0, 10)
  })

  it('clamps a zero duration to settle immediately at the target', () => {
    const tween = new ScaleBlendTween(0, 0)
    tween.retarget(1, 0)
    expect(tween.update(0)).toBeCloseTo(1, 10)
    expect(tween.isAnimating).toBe(false)
  })
})
