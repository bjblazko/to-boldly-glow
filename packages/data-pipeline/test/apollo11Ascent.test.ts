import { beforeAll, describe, expect, it } from 'vitest'
import { type Ascent, ascentAt, DOCKED, eagleUp, INSERTION_CUTOFF, LIFTOFF } from '../src/apollo/trajectory/apollo11Ascent'
import { grailField } from '../src/apollo/trajectory/lunarGravity'
import type { State } from '../src/apollo/trajectory/propagate'

describe("Eagle's ascent and rendezvous", () => {
  let ascent: Ascent
  let coast: State[]
  beforeAll(async () => {
    const up = eagleUp(await grailField(60))
    ascent = up.ascent
    coast = up.coast
  }, 300_000)

  it('meets Columbia: within a kilometre at the docking, after the four documented burns', () => {
    const atDock = coast.at(-1)!
    expect(atDock.t).toBeCloseTo(DOCKED, 3)
    expect(Math.hypot(...atDock.position.map((value, k) => value - ascent.columbiaAtDock.position[k]))).toBeLessThan(1)
  })

  it('reaches orbit some 6 to 12 degrees on from the site, as an ascent of seven minutes would', () => {
    expect(ascent.insertionDegrees).toBeGreaterThan(6)
    expect(ascent.insertionDegrees).toBeLessThan(12)
  })

  it('lifts off from the site at rest and climbs all the way into its orbit, without a step', () => {
    const [start, end] = [ascentAt(ascent, LIFTOFF), ascentAt(ascent, INSERTION_CUTOFF)]
    expect(Math.hypot(...start.position.map((value, k) => value - ascent.site.position[k]))).toBeLessThan(0.001)
    expect(Math.hypot(...end.position.map((value, k) => value - ascent.insertion.position[k]))).toBeLessThan(0.01)
    expect(Math.hypot(...end.velocity.map((value, k) => value - ascent.insertion.velocity[k]))).toBeLessThan(0.005)
    let last = -Infinity
    for (let get = LIFTOFF; get <= INSERTION_CUTOFF; get += 5) {
      const height = ascent.height(get)
      expect(height).toBeGreaterThanOrEqual(last - 1e-9)
      last = height
    }
  })
})
