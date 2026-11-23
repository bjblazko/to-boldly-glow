import { describe, expect, it } from 'vitest'
import { encodeRecords, RECORD_FLOATS } from '../src/apollo/trajectory/trajectoryRecords'

describe('the Apollo 11 trajectory records', () => {
  it('keep a time at 128:03:00 to within a millisecond, and the position', () => {
    const t = 128 * 3600 + 3 * 60 + 0.123456
    const buffer = encodeRecords([{ t, position: [1737.4, -12.5, 3] }])
    const values = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)
    expect(values.length).toBe(RECORD_FLOATS)
    expect(Math.abs(values[0] + values[1] - t)).toBeLessThan(0.001)
    expect([...values.slice(2)].map((v) => Number(v.toFixed(2)))).toEqual([1737.4, -12.5, 3])
  })
})
