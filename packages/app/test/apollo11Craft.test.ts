import { describe, expect, it } from 'vitest'
import { getSeconds } from '../src/missions/apollo11/apollo11Events'
import { craftAt } from '../src/missions/apollo11/craftChoreography'

const at = (time: string) => craftAt(getSeconds(time))
const models = (time: string) => at(time).columbia.map((actor) => actor.model)

describe("the craft along Apollo 11's mission", () => {
  it('flies as the whole stack in Earth orbit, the third stage under Columbia', () => {
    expect(models('001:00:00')).toEqual(['saturnV', 'lm', 'csm'])
    expect(at('001:00:00').eagle).toBeNull()
  })

  it('docks Columbia to Eagle and pulls it out of the third stage, which falls behind and is gone later', () => {
    const docked = at('003:30:00').columbia
    const csm = docked.find((a) => a.model === 'csm')!
    expect(csm.rotation.x).toBeCloseTo(Math.PI, 3)
    expect(models('010:00:00')).toEqual(['lm', 'csm'])
  })

  it('lets Eagle go at the undocking, with its legs out', () => {
    const eagle = at('100:30:00').eagle!
    expect(eagle.pose.fold).toBe(0)
    expect(models('100:30:00')).toEqual(['csm'])
  })

  it('leaves the descent stage on the site at liftoff and brings the ascent stage back to Columbia', () => {
    const after = at('124:30:00')
    expect(after.site).not.toBeNull()
    expect(after.eagle!.pose.visibility.descent).toBe(0)
    expect(models('129:00:00')).toEqual(['csm', 'lm'])
    expect(at('129:00:00').eagle).toBeNull()
  })

  it('casts the ascent stage off, and at entry only the command module is left', () => {
    expect(models('140:00:00')).toEqual(['csm'])
    const entry = at('195:00:00').columbia[0]
    expect(entry.visibility.sm).toBe(0)
  })

  it("puts Eagle's drawn place onto Columbia's nose while docked to it", () => {
    const eagle = at('128:02:59.9').eagle!
    expect(eagle.frame).toBe('columbia')
    expect(eagle.pose.translation[1]).toBeGreaterThan(17)
  })
})
