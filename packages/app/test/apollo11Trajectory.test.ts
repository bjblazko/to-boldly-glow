import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { apollo11Trajectory, parseTrack, sampleTrack } from '../src/missions/apollo11/apollo11Trajectory'

const T = (h: number, m: number, s: number) => h * 3600 + m * 60 + s
const DATA = join(__dirname, '../public/data/apollo11')
const file = (name: string) => {
  const bytes = readFileSync(join(DATA, `${name}.bin`))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}
const records = (...rows: number[][]) => Float32Array.from(rows.flatMap(([t, x, y, z]) => [Math.floor(t), t - Math.floor(t), x, y, z])).buffer
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, k) => v - b[k]))

describe('a trajectory track', () => {
  it('reads whole seconds and their fraction, and positions', () => {
    const track = parseTrack(records([460980.25, 1, 2, 3], [460990.5, 4, 5, 6]))
    expect(track.times[0]).toBeCloseTo(460980.25, 4)
    expect(track.times[1]).toBeCloseTo(460990.5, 4)
    expect([...track.positions.slice(3)]).toEqual([4, 5, 6])
  })

  it('passes through its points, moves smoothly between them, and has nothing outside', () => {
    const track = parseTrack(records([0, 0, 0, 0], [10, 10, 0, 0], [20, 20, 0, 0], [30, 30, 0, 0]))
    expect(sampleTrack(track, 10)).toEqual([10, 0, 0])
    expect(sampleTrack(track, 15)![0]).toBeCloseTo(15, 9)
    expect(sampleTrack(track, -1)).toBeNull()
    expect(sampleTrack(track, 31)).toBeNull()
  })
})

describe("Apollo 11's trajectory", () => {
  const trajectory = apollo11Trajectory({ translunar: file('translunar'), lunar: file('lunar'), eagle: file('eagle'), transearth: file('transearth'), moon: file('moon') })

  it('has Columbia from Earth orbit to entry, always moving smoothly (no jump at the joins)', () => {
    expect(trajectory.columbia(T(0, 5, 0))).toBeNull()
    for (const get of [T(75, 53, 29), T(135, 23, 42), T(135, 25, 0), T(135, 26, 13)]) {
      const [a, b] = [trajectory.columbia(get - 1)!, trajectory.columbia(get + 1)!]
      expect(distance(a, b)).toBeLessThan(2 * 11)
    }
  })

  it('has Columbia in lunar orbit some 100 km above the Moon', () => {
    const get = T(110, 0, 0)
    const altitude = distance(trajectory.columbia(get)!, trajectory.moon(get)!) - 1737.4
    expect(altitude).toBeGreaterThan(90)
    expect(altitude).toBeLessThan(130)
  })

  it('puts Eagle with Columbia until the undocking and after the docking, on its own between', () => {
    const before = T(99, 0, 0)
    expect(trajectory.eagle(before)).toEqual({ position: trajectory.columbia(before), alone: false })
    const landed = trajectory.eagle(T(110, 0, 0))!
    expect(landed.alone).toBe(true)
    expect(distance(landed.position, trajectory.moon(T(110, 0, 0))!)).toBeCloseTo(1735.5, 0)
    expect(trajectory.eagle(T(129, 0, 0))!.alone).toBe(false)
  })

  it('brings Eagle back to Columbia at the docking', () => {
    const get = T(128, 2, 59)
    expect(distance(trajectory.eagle(get)!.position, trajectory.columbia(get)!)).toBeLessThan(0.05)
  })
})
