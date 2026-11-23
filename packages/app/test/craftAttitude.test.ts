import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { columbiaAttitude, eagleAttitude, type Kinematics } from '../src/missions/apollo11/craftAttitude'
import { getSeconds } from '../src/missions/apollo11/apollo11Events'
import { APOLLO11_STATIONS } from '../src/missions/apollo11/apollo11Stations'

const k = (get: string, extra: Partial<Kinematics> = {}): Kinematics => ({ get: getSeconds(get), velocity: [1, 0, 0], up: [0, 1, 0], toOther: null, ...extra })
const nose = (m: ArrayLike<number>) => vec3.fromValues(m[4], m[5], m[6])

describe("the craft's attitudes", () => {
  it('points Columbia forward for TLI, backward in lunar orbit (LOI braking) and forward again for TEI', () => {
    expect(nose(columbiaAttitude(k('002:47:00')))[0]).toBeCloseTo(1, 3)
    expect(nose(columbiaAttitude(k('075:52:00')))[0]).toBeCloseTo(-1, 3)
    expect(nose(columbiaAttitude(k('090:00:00')))[0]).toBeCloseTo(-1, 3)
    expect(nose(columbiaAttitude(k('135:25:00')))[0]).toBeCloseTo(1, 3)
  })

  it('holds still on the coasts, in the attitude its burn ended in', () => {
    const velocityAt = () => [0, 1, 0] as [number, number, number]
    const [a, b] = [columbiaAttitude(k('030:00:00', { velocityAt })), columbiaAttitude(k('060:00:00', { velocity: [1, 0, 0], velocityAt }))]
    expect(nose(a)[1]).toBeCloseTo(1, 3)
    expect([...a]).toEqual([...b])
  })

  it('turns only in the cuts between stations, or in its own burn', () => {
    const turns = [[2, 51, 0], [75, 41, 30], [135, 13, 0], [135, 27, 0], [194, 41, 0]].map(([h, m, sec]) => h * 3600 + m * 60 + sec)
    for (const turn of turns) {
      const station = APOLLO11_STATIONS.find((st) => turn + 120 > st.from && turn < st.to)
      const inBurn = (station?.realTime ?? []).some((w) => turn <= w.to + 60)
      expect(!station || inBurn || station.id === 'tei' || station.id === 'tli', String(turn)).toBe(true)
    }
  })

  it('changes attitude smoothly, never in one frame', () => {
    const [a, b] = [columbiaAttitude(k('075:41:59.9')), columbiaAttitude(k('075:42:00.1'))]
    expect(vec3.dot(nose(a), nose(b))).toBeGreaterThan(0.999)
  })

  it('stands Eagle upright on the ground and climbs off upward', () => {
    expect(nose(eagleAttitude(k('110:00:00', { altitudeKm: 0 })))[1]).toBeCloseTo(1, 3)
    expect(nose(eagleAttitude(k('124:22:05', { altitudeKm: 0.05 })))[1]).toBeGreaterThan(0.95)
  })

  it("brakes Eagle engine-first high up and turns it upright near the ground", () => {
    expect(nose(eagleAttitude(k('102:35:00', { altitudeKm: 14 })))[0]).toBeLessThan(-0.8)
    expect(nose(eagleAttitude(k('102:45:30', { altitudeKm: 0.01 })))[1]).toBeGreaterThan(0.95)
  })

  it("turns Eagle's roof to Columbia on the way to the docking", () => {
    expect(nose(eagleAttitude(k('127:00:00', { toOther: [0, 0, 1], altitudeKm: 100 })))[2]).toBeCloseTo(1, 3)
  })
})
