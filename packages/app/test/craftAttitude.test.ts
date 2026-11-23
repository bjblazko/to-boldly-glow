import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { columbiaAttitude, eagleAttitude, type Kinematics } from '../src/missions/apollo11/craftAttitude'
import { getSeconds } from '../src/missions/apollo11/apollo11Events'

const k = (get: string, extra: Partial<Kinematics> = {}): Kinematics => ({ get: getSeconds(get), velocity: [1, 0, 0], up: [0, 1, 0], toOther: null, ...extra })
const nose = (m: ArrayLike<number>) => vec3.fromValues(m[4], m[5], m[6])

describe("the craft's attitudes", () => {
  it('points Columbia forward for TLI, backward for LOI (braking) and forward again for TEI', () => {
    expect(nose(columbiaAttitude(k('002:47:00')))[0]).toBeCloseTo(1, 3)
    expect(nose(columbiaAttitude(k('075:52:00')))[0]).toBeCloseTo(-1, 3)
    expect(nose(columbiaAttitude(k('135:25:00')))[0]).toBeCloseTo(1, 3)
  })

  it('rolls slowly across the ecliptic on the coast (passive thermal control)', () => {
    const [a, b] = [columbiaAttitude(k('030:00:00')), columbiaAttitude(k('030:00:10'))]
    expect(nose(a)[2]).toBeCloseTo(1, 3)
    expect(Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * (180 / Math.PI)).toBeCloseTo(3, 0)
  })

  it('changes attitude smoothly, never in one frame', () => {
    const [a, b] = [columbiaAttitude(k('075:40:59.9')), columbiaAttitude(k('075:41:00.1'))]
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
