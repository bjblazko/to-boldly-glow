import { describe, expect, it } from 'vitest'
import { chaseShot, worldFloorUnits } from '../src/missions/apollo11/chaseShot'

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

  it("puts the world's near plane a third of the way to the ground", () => {
    expect(worldFloorUnits(110) * 0.04 * 1000).toBeCloseTo(33, 6)
  })
})
