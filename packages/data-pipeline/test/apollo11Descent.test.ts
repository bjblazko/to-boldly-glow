import { beforeAll, describe, expect, it } from 'vitest'
import { CALLOUTS, descentAt, type Descent, onSurface, poweredDescent, TOUCHDOWN } from '../src/apollo/trajectory/apollo11Descent'
import { eagleAtPdi, PDI } from '../src/apollo/trajectory/apollo11LunarFit'
import { grailField } from '../src/apollo/trajectory/lunarGravity'
import type { State } from '../src/apollo/trajectory/propagate'

const FT = 0.0003048

describe("Eagle's powered descent", () => {
  let atPdi: State
  let descent: Descent
  beforeAll(async () => {
    atPdi = eagleAtPdi(await grailField(60))
    descent = poweredDescent(atPdi)
  }, 120_000)

  it('starts where Eagle’s coast ends, at the same speed', () => {
    const start = descentAt(descent, PDI)
    expect(Math.hypot(...start.position.map((value, k) => value - atPdi.position[k]))).toBeLessThan(0.01)
    expect(Math.hypot(...start.velocity.map((value, k) => value - atPdi.velocity[k]))).toBeLessThan(0.002)
  })

  it('passes the crew’s callouts: the height at each moment within a tenth', () => {
    for (const { get, feet } of CALLOUTS) expect(Math.abs(descent.height(get) / FT - feet), `${feet} ft`).toBeLessThan(Math.max(0.1 * feet, 15))
  })

  it('comes down without climbing, and closes on the site all the way', () => {
    let [lastHeight, lastRange] = [Infinity, Infinity]
    for (let get = PDI; get <= TOUCHDOWN; get += 1) {
      const [height, range] = [descent.height(get), descent.range(get)]
      expect(height).toBeLessThanOrEqual(lastHeight + 1e-6)
      expect(range).toBeLessThanOrEqual(lastRange + 1e-6)
      ;[lastHeight, lastRange] = [height, range]
    }
  })

  it('touches down on Tranquility Base', () => {
    expect(descent.height(TOUCHDOWN)).toBeCloseTo(0, 6)
    expect(descent.range(TOUCHDOWN)).toBeCloseTo(0, 6)
  })

  it('then stands on the site, carried round with the Moon', () => {
    const landed = descentAt(descent, TOUCHDOWN)
    expect(Math.hypot(...onSurface(descent, TOUCHDOWN).position.map((value, k) => value - landed.position[k]))).toBeLessThan(0.001)
    // A day later the Moon has moved on some 85 000 km round Earth, and Eagle with it.
    const later = onSurface(descent, TOUCHDOWN + 86400)
    expect(Math.hypot(...later.position.map((value, k) => value - landed.position[k]))).toBeGreaterThan(50000)
  })
})

