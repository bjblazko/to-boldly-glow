import { describe, expect, it } from 'vitest'
import { chaseShot, nearFloorUnits } from '../src/missions/apollo11/chaseShot'

describe('the simple chase camera', () => {
  const shot = chaseShot([0, 0, 0], { velocity: [1.6, 0, 0], up: [0, 0, 1], altitudeKm: 110, body: 'moon' })

  it('rides some 25 to 40 m behind and above the craft, looking at it', () => {
    const metres = Math.hypot(...shot.eyeKm) * 1000
    expect(metres).toBeGreaterThan(25)
    expect(metres).toBeLessThan(40)
    expect(shot.eyeKm[0]).toBeLessThan(0)
    expect(shot.eyeKm[2]).toBeGreaterThan(0)
    expect(shot.lookKm).toEqual([0, 0, 0])
  })

  it('keeps the near plane well short of the ground below', () => {
    // The near plane is 4% of the floor (scene units, 1,000 km); the Moon's surface is 110 km away.
    expect(nearFloorUnits(1, 110) * 0.04 * 1000).toBeLessThanOrEqual(11)
    expect(nearFloorUnits(0.00003, 110)).toBeLessThanOrEqual(0.00003)
  })
})
