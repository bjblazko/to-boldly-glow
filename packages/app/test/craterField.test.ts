import { describe, expect, it } from 'vitest'
import { boulderField, craterField, craterHeight } from '../src/missions/apollo11/craterField'

describe("Tranquility Base's made-up craters and boulders", () => {
  const craters = craterField()

  it('are the same at every visit, many small and few large, none on Eagle', () => {
    expect(craterField()).toEqual(craters)
    const small = craters.filter((c) => c.radius < 10).length
    const large = craters.filter((c) => c.radius > 30).length
    expect(small).toBeGreaterThan(large * 4)
    for (const c of craters) expect(Math.hypot(c.east, c.north)).toBeGreaterThan(30)
  })

  it('make bowls with rims', () => {
    const one = [{ east: 0, north: 0, radius: 20 }]
    expect(craterHeight(one, 0, 0)).toBeCloseTo(-8, 6)
    expect(craterHeight(one, 20, 0)).toBeGreaterThan(1)
    expect(craterHeight(one, 50, 0)).toBeCloseTo(0, 2)
  })

  it('scatter boulders round the site, clear of Eagle', () => {
    const boulders = boulderField(craters)
    expect(boulders.length).toBeGreaterThan(900)
    for (const b of boulders) expect(Math.hypot(b.east, b.north)).toBeGreaterThan(12)
  })
})
