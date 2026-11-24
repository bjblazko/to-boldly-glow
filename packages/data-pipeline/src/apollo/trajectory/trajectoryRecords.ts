import type { Vec3 } from './propagate'

// The Apollo 11 trajectory files (public/data/apollo11/*.bin): one record per point, five float32s -
// the mission time (GET, s) as whole seconds and the fraction left over, then x, y, z (km). One
// float32 for the time would hold only about 1/32 s at 100 hours, some 50 m along the orbit; whole
// seconds stay exact in a float32 (to 2^24 s, 194 days) and the fraction to well under a
// millisecond.
export const RECORD_FLOATS = 5

export function encodeRecords(records: readonly { t: number; position: Vec3 }[]): Buffer {
  const values = new Float32Array(records.length * RECORD_FLOATS)
  records.forEach(({ t, position }, index) => {
    const whole = Math.floor(t)
    values.set([whole, t - whole, ...position], index * RECORD_FLOATS)
  })
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength)
}
