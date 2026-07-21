import { describe, expect, it } from 'vitest'
import { dateAtScrubPosition } from '../src/learn/lessonTypes'

describe('dateAtScrubPosition', () => {
  const range: [Date, Date] = [new Date('2026-06-14T00:00:00Z'), new Date('2026-06-28T00:00:00Z')]

  it('returns the range start at scrubT=0', () => {
    expect(dateAtScrubPosition(range, 0).toISOString()).toBe('2026-06-14T00:00:00.000Z')
  })

  it('returns the range end at scrubT=1', () => {
    expect(dateAtScrubPosition(range, 1).toISOString()).toBe('2026-06-28T00:00:00.000Z')
  })

  it('interpolates linearly at scrubT=0.5', () => {
    expect(dateAtScrubPosition(range, 0.5).toISOString()).toBe('2026-06-21T00:00:00.000Z')
  })

  it('clamps scrubT below 0 to the range start', () => {
    expect(dateAtScrubPosition(range, -0.5).toISOString()).toBe('2026-06-14T00:00:00.000Z')
  })

  it('clamps scrubT above 1 to the range end', () => {
    expect(dateAtScrubPosition(range, 1.5).toISOString()).toBe('2026-06-28T00:00:00.000Z')
  })
})
