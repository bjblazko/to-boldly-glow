import { describe, expect, it } from 'vitest'
import { APOLLO11_EVENTS, eventUtc, getSeconds } from '../src/missions/apollo11/apollo11Events'

describe("Apollo 11's events", () => {
  it('reads a mission time (hhh:mm:ss.ss) into seconds', () => {
    expect(getSeconds('102:45:39.90')).toBeCloseTo(102 * 3600 + 45 * 60 + 39.9, 6)
  })

  it('puts them in UTC from range zero, 13:32:00 UTC on 16 July 1969 - the landing at 20:17:39.9, the first step at 02:56:15 on 21 July', () => {
    const at = (id: string) => eventUtc(APOLLO11_EVENTS.find((event) => event.id === id) ?? { id, get: 0 })
    expect(new Date(at('landing')).toISOString()).toBe('1969-07-20T20:17:39.900Z')
    expect(new Date(at('firstStep')).toISOString()).toBe('1969-07-21T02:56:15.000Z')
  })

  it('runs in order, from range zero to splashdown at 195:18:35', () => {
    const times = APOLLO11_EVENTS.map((event) => event.get)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(APOLLO11_EVENTS[0].id).toBe('rangeZero')
    expect(APOLLO11_EVENTS.at(-1)).toMatchObject({ id: 'splashdown', get: getSeconds('195:18:35.00') })
  })
})
