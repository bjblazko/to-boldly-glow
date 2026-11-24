import { describe, expect, it } from 'vitest'
import { FRAME_SECONDS, jklRate, jogSeconds, MAX_RATE, shuttleRate, timecode } from '../src/missions/scrubControls'

describe('jog and shuttle', () => {
  it('stands still around the shuttle’s middle and runs faster the further it is pushed, both ways', () => {
    expect(shuttleRate(0)).toBe(0)
    expect(shuttleRate(0.03)).toBe(0)
    expect(shuttleRate(0.05)).toBeCloseTo(0.25, 9)
    expect(shuttleRate(0.1)).toBeLessThan(0.5)
    expect(shuttleRate(1)).toBe(MAX_RATE)
    expect(shuttleRate(-1)).toBe(-MAX_RATE)
    expect(shuttleRate(0.6)).toBeGreaterThan(shuttleRate(0.5))
    expect(shuttleRate(-0.6)).toBeCloseTo(-shuttleRate(0.6), 9)
  })

  it('plays J/K/L as in an editing suite: each press of L or J doubles, K stops, the other key turns round', () => {
    expect(jklRate(0, 'l')).toBe(1)
    expect(jklRate(1, 'l')).toBe(2)
    expect(jklRate(32, 'l')).toBe(MAX_RATE)
    expect(jklRate(MAX_RATE, 'l')).toBe(MAX_RATE)
    expect(jklRate(4, 'j')).toBe(-1)
    expect(jklRate(-1, 'j')).toBe(-2)
    expect(jklRate(-8, 'k')).toBe(0)
  })

  it('moves a frame per notch of the jog wheel, a second with Shift', () => {
    expect(jogSeconds(1, false)).toBeCloseTo(FRAME_SECONDS, 9)
    expect(jogSeconds(-3, false)).toBeCloseTo(-3 * FRAME_SECONDS, 9)
    expect(jogSeconds(2, true)).toBe(2)
  })

  it('writes the tour time as minutes, seconds and frames', () => {
    expect(timecode(0)).toBe('00:00:00')
    expect(timecode(61.5)).toBe('01:01:15')
    expect(timecode(25 * 60 + 59 + 29.4 / 30)).toBe('25:59:29')
  })
})
