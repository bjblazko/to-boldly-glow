import { describe, expect, it } from 'vitest'
import { Apollo11Clock, FADE_SECONDS, type TourStation } from '../src/missions/apollo11/apollo11Clock'

const STATIONS: TourStation[] = [
  { id: 'a', from: 1000, to: 9000, seconds: 60 },
  { id: 'b', from: 10_000, to: 20_000, seconds: 90, realTime: [{ from: 12_000, to: 12_020 }] },
  { id: 'c', from: 30_000, to: 30_060, seconds: 60, realTime: [{ from: 30_000, to: 30_060 }] },
]

function clock(animate = true) {
  const heard: string[] = []
  const c = new Apollo11Clock(STATIONS, { arrived: (i) => heard.push(`arrived ${i}`), ended: () => heard.push('ended') }, animate)
  c.start()
  return { c, heard }
}

// Runs the clock for `seconds` in small steps and gives every moment's GET.
function run(c: Apollo11Clock, seconds: number, step = 0.05): number[] {
  const gets: number[] = []
  for (let t = 0; t < seconds - 1e-9; t += step) gets.push(c.update(step).get)
  return gets
}

describe('the Apollo 11 tour clock', () => {
  it("starts at a station's first moment and reaches its last", () => {
    const { c } = clock()
    expect(c.moment.get).toBe(1000)
    const gets = run(c, 59.99, 0.01)
    expect(gets.at(-1)).toBeCloseTo(9000, -1)
  })

  it('runs at real time inside a real-time window', () => {
    const { c } = clock()
    c.jumpTo(1)
    let last = c.moment.get
    let checked = 0
    for (let t = 0; t < 90; t += 0.1) {
      const get = c.update(0.1).get
      if (last >= 12_001 && get <= 12_019) {
        expect((get - last) / 0.1).toBeCloseTo(1, 2)
        checked++
      }
      last = get
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('never goes back in time within a station', () => {
    const { c } = clock()
    c.jumpTo(1)
    const gets = run(c, 89.9)
    gets.slice(1).forEach((get, i) => expect(get).toBeGreaterThanOrEqual(gets[i] - 1e-6))
  })

  it("gives each station its length in the tour, and tells when it arrives and when the tour ends", () => {
    const { c, heard } = clock()
    run(c, 60.05)
    expect(c.moment.stationIndex).toBe(1)
    expect(c.moment.get).toBeCloseTo(10_000, -1)
    run(c, 150.1)
    expect(c.moment.ended).toBe(true)
    expect(heard).toEqual(['arrived 0', 'arrived 1', 'arrived 2', 'ended'])
  })

  it("starts a station picked from a link at that station's first moment", () => {
    const { c } = clock()
    c.jumpTo(2)
    expect(c.moment.stationIndex).toBe(2)
    expect(c.moment.get).toBe(30_000)
  })

  it('fades out at the end of a station and in at the start of the next', () => {
    const { c } = clock()
    run(c, 60 - FADE_SECONDS / 2)
    expect(c.moment.fade).toBeGreaterThan(0.3)
    run(c, FADE_SECONDS)
    expect(c.moment.stationIndex).toBe(1)
    expect(c.moment.fade).toBeGreaterThan(0)
    run(c, FADE_SECONDS)
    expect(c.moment.fade).toBe(0)
  })

  it('holds the mission time while paused; a pause asked for during a fade waits for it to end', () => {
    const { c } = clock()
    run(c, 30)
    c.setPaused(true)
    const held = c.moment.get
    run(c, 5)
    expect(c.moment.get).toBe(held)
    c.setPaused(false)
    run(c, 30 - FADE_SECONDS / 2)
    c.setPaused(true)
    expect(c.isPaused).toBe(true)
    run(c, FADE_SECONDS * 3)
    expect(c.moment.fade).toBe(0)
  })

  it('without motion still plays every station and ends', () => {
    const { c } = clock(false)
    run(c, 211)
    expect(c.moment.ended).toBe(true)
    expect(c.moment.fade).toBe(0)
  })

  it('refuses a station that would run slower than real time outside its windows', () => {
    expect(() => new Apollo11Clock([{ id: 'x', from: 0, to: 10, seconds: 60 }], { arrived: () => {}, ended: () => {} }, true)).toThrow()
  })
})

describe('scrubbing the tour', () => {
  it('knows its place in the whole tour and its length', () => {
    const { c } = clock()
    run(c, 70)
    expect(c.position).toBeCloseTo(70, 1)
    expect(c.length).toBe(210)
  })

  it('seeks anywhere: the station and its mission time follow', () => {
    const { c, heard } = clock()
    c.seek(120)
    expect(c.moment.stationIndex).toBe(1)
    expect(heard.at(-1)).toBe('arrived 1')
    c.seek(0)
    expect(c.moment.get).toBe(1000)
    c.seek(1e9)
    expect(c.position).toBe(210)
  })

  it('runs backwards, into the station before', () => {
    const { c } = clock()
    c.seek(62)
    const gets: number[] = []
    for (let i = 0; i < 40; i++) gets.push(c.update(-0.1).get)
    expect(c.moment.stationIndex).toBe(0)
    expect(gets.at(-1)!).toBeLessThan(9000)
    expect(c.position).toBeCloseTo(58, 1)
  })

  it('stops at the start when running backwards', () => {
    const { c } = clock()
    c.seek(1)
    c.update(-5)
    expect(c.position).toBe(0)
    expect(c.moment.ended).toBe(false)
  })
})

describe('a station in orbit, its time capped', () => {
  it('plays takes at no more than its speed, cutting between them', () => {
    const c = new Apollo11Clock([{ id: 'o', from: 0, to: 36_000, seconds: 35, maxRate: 90 }], { arrived: () => {}, ended: () => {} }, true)
    c.start()
    let [last, lastTake, cuts] = [c.moment.get, c.moment.take, 0]
    for (let t = 0; t < 34.9; t += 0.05) {
      const m = c.update(0.05)
      if (m.take !== lastTake) cuts++
      else expect((m.get - last) / 0.05).toBeLessThanOrEqual(90.01)
      ;[last, lastTake] = [m.get, m.take]
    }
    expect(cuts).toBe(4)
    expect(last).toBeGreaterThan(30_000)
  })
})
