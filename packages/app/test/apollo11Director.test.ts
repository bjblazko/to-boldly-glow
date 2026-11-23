import { mat4 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { shotAt } from '../src/missions/apollo11/director'
import { flipShot, frame, lensFov, type ShotContext } from '../src/missions/apollo11/shots'
import { STATION_SHOTS } from '../src/missions/apollo11/stationShots'
import { APOLLO11_STATIONS } from '../src/missions/apollo11/apollo11Stations'

const FAR = new Set(['body'])
const CLOSE = new Set(['detail', 'hull', 'watch', 'ground'])

describe("the tour's shots", () => {
  it('has shots for every station, a far one and a close one among them', () => {
    for (const station of APOLLO11_STATIONS) {
      const specs = STATION_SHOTS[station.id].shots.map((s) => s.spec)
      const kinds = specs.map((s) => s.kind)
      // Far: a body behind the craft - or on the Moon's ground, a long lens from far off.
      const far = (s: (typeof specs)[number]) => FAR.has(s.kind) || (s.kind === 'ground' && (s.lens === 'tele' || s.lens === 'longTele')) || (s.kind === 'orbit' && s.distance >= 1000)
      expect(specs.some(far), station.id).toBe(true)
      expect(kinds.some((k) => CLOSE.has(k)), station.id).toBe(true)
    }
  })

  it('never cuts to the same lens and kind again', () => {
    for (const [id, plan] of Object.entries(STATION_SHOTS)) {
      plan.shots.forEach((shot, i) => {
        const next = plan.shots[(i + 1) % plan.shots.length]
        expect(shot.spec.lens === next.spec.lens && shot.spec.kind === next.spec.kind, `${id} ${i}`).toBe(false)
      })
    }
  })

  it('plays them in turn, the same at the same place, and a pinned moment wins', () => {
    const first = shotAt('landing', 0, 102 * 3600 + 33 * 60)
    const later = shotAt('landing', 8, 102 * 3600 + 34 * 60)
    expect(first.key).not.toBe(later.key)
    expect(shotAt('landing', 8, 102 * 3600 + 34 * 60)).toEqual(later)
    expect(shotAt('landing', 150, 102 * 3600 + 45 * 60).shot.spec.kind).toBe('ground')
  })
})

describe('framing a shot', () => {
  const context: ShotContext = {
    seconds: 0,
    subjectKm: [0, 0, 0],
    turn: mat4.create(),
    velocity: [1.6, 0, 0],
    up: [0, 0, 1],
    size: 11,
    centre: [0, 0, 0],
    earthKm: [-380_000, 0, 0],
    moonKm: [0, -1850, 0],
    toSun: [0, 1, 0],
    otherKm: null,
    otherTurn: null,
    siteKm: null,
    siteUp: null,
  }

  it('puts the body behind the craft, the craft its share of the picture', () => {
    const f = frame({ kind: 'body', lens: 'longTele', body: 'moon', share: 0.02 }, context)
    // The eye on the far side from the Moon, looking at the craft (and on to the Moon).
    expect(f.eyeKm[1]).toBeGreaterThan(0)
    const distanceM = Math.hypot(...f.eyeKm) * 1000
    expect(11 / (2 * distanceM * Math.tan(lensFov('longTele') / 2))).toBeCloseTo(0.02, 4)
  })

  it('stands a fixed camera still beside the craft, a drifting one goes round', () => {
    const fixed = (seconds: number) => frame({ kind: 'orbit', lens: 'normal', distance: 50, azimuth: 30, elevation: 10 }, { ...context, seconds })
    expect(fixed(5).eyeKm).toEqual(fixed(0).eyeKm)
    const drifting = (seconds: number) => frame({ kind: 'orbit', lens: 'normal', distance: 50, azimuth: 30, elevation: 10, drift: 3 }, { ...context, seconds })
    expect(drifting(5).eyeKm).not.toEqual(drifting(0).eyeKm)
  })

  it('puts a hull shot right against the hull', () => {
    const f = frame({ kind: 'hull', lens: 'ultraWide', eye: [2.6, 1.2, 0.9], look: [0, 10.4, 0] }, context)
    expect(Math.hypot(...f.eyeKm) * 1000).toBeLessThan(3.2)
  })
})

describe('the mix of shots', () => {
  it('has a far shot (a body behind) at most once a station', () => {
    for (const [id, plan] of Object.entries(STATION_SHOTS)) expect(plan.shots.filter((s) => s.spec.kind === 'body').length, id).toBeLessThanOrEqual(1)
  })
})

describe('light on a camera beside the craft', () => {
  it('takes the side the Sun is on', () => {
    const lit = { seconds: 0, subjectKm: [0, 0, 0], turn: mat4.create(), velocity: [1, 0, 0], up: [0, 0, 1], size: 11, centre: [0, 0, 0], earthKm: [1e5, 0, 0], moonKm: [0, 1e5, 0], toSun: [-1, 0, 0], otherKm: null, otherTurn: null, siteKm: null, siteUp: null } as ShotContext
    // Asked for from ahead (azimuth 180 = in front, the Sun behind the craft), it goes behind: sunward.
    const spec = { kind: 'orbit', lens: 'normal', distance: 50, azimuth: 180, elevation: 0 } as const
    const f = frame(spec, { ...lit, flipped: flipShot(spec, lit) })
    expect(f.eyeKm[0]).toBeLessThan(0)
  })
})
