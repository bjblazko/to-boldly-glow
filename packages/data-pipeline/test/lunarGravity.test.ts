import { describe, expect, it } from 'vitest'
import { harmonicAcceleration, harmonicPotential, unnormalized, type GravityField } from '../src/apollo/trajectory/lunarGravity'

const R = 1738
const MU = 4902.8

// A field with only the given unnormalized coefficients (degree up to 2).
function field(coefficients: Record<string, [number, number]>, degree = 2): GravityField {
  const c = Array.from({ length: degree + 1 }, () => new Float64Array(degree + 1))
  const s = Array.from({ length: degree + 1 }, () => new Float64Array(degree + 1))
  for (const [key, [cv, sv]] of Object.entries(coefficients)) {
    const [n, m] = key.split(',').map(Number)
    c[n][m] = cv
    s[n][m] = sv
  }
  return { radius: R, mu: MU, degree, c, s }
}

describe("the Moon's gravity field", () => {
  it('is a point mass at degree 0', () => {
    const r: [number, number, number] = [1200, -900, 700]
    const d = Math.hypot(...r)
    const a = harmonicAcceleration(field({ '0,0': [1, 0] }), r, 0)
    r.forEach((value, k) => expect(a[k]).toBeCloseTo((-MU * value) / d ** 3, 12))
  })

  it('pulls as the closed form of J2 says, for an oblate Moon', () => {
    const j2 = 2.03e-4
    const r: [number, number, number] = [1300, 600, 900]
    const d = Math.hypot(...r)
    const q = (r[2] / d) ** 2
    const expected = [r[0] * (1 - 5 * q), r[1] * (1 - 5 * q), r[2] * (3 - 5 * q)].map((v) => ((-1.5 * j2 * MU * R * R) / d ** 5) * v)
    const a = harmonicAcceleration(field({ '2,0': [-j2, 0] }), r, 2)
    a.forEach((value, k) => expect(value).toBeCloseTo(expected[k], 14))
  })

  it('turns fully normalized coefficients into unnormalized ones', () => {
    // C20: N = sqrt(5); C22: N = sqrt(2 * 5 * 0! / 4!) = sqrt(10 / 24).
    expect(unnormalized(2, 0, 1)).toBeCloseTo(Math.sqrt(5), 12)
    expect(unnormalized(2, 2, 1)).toBeCloseTo(Math.sqrt(10 / 24), 12)
  })

  it('is the gradient of its potential, for every degree and order (a random field to degree 6)', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 1e-4
    const coefficients: Record<string, [number, number]> = { '0,0': [1, 0] }
    for (let n = 2; n <= 6; n++) for (let m = 0; m <= n; m++) coefficients[`${n},${m}`] = [random(), m === 0 ? 0 : random()]
    const f = field(coefficients, 6)
    const r: [number, number, number] = [1100, -1250, 640]
    const a = harmonicAcceleration(f, r, 0)
    const h = 1e-3
    for (let k = 0; k < 3; k++) {
      const [plus, minus] = [[...r], [...r]] as [number, number, number][]
      plus[k] += h
      minus[k] -= h
      expect(a[k]).toBeCloseTo((harmonicPotential(f, plus) - harmonicPotential(f, minus)) / (2 * h), 10)
    }
  })
})

