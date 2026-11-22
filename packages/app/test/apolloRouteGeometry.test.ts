import { describe, expect, it } from 'vitest'
import {
  eaglePoint,
  LANDING_SITE,
  LUNAR_ORBIT_RADIUS,
  PARKING_RADIUS,
  RENDEZVOUS,
  ROUTE_EARTH,
  ROUTE_EARTH_RADIUS,
  ROUTE_MOON,
  ROUTE_MOON_RADIUS,
  routePoint,
  UNDOCKING,
} from '../src/learn/apolloRoute/routeGeometry'

type V = ArrayLike<number>
const sub = (a: V, b: V) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a: V) => Math.hypot(a[0], a[1], a[2])
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
// The z part of a x b: positive when b turns counterclockwise from a, seen from ecliptic north.
const turn = (a: V, b: V) => a[0] * b[1] - a[1] * b[0]
const toMoon = sub(ROUTE_MOON, ROUTE_EARTH).map((v) => v / len(sub(ROUTE_MOON, ROUTE_EARTH)))
// Across the Earth-Moon line, toward the Moon's motion (90 degrees counterclockwise).
const across = [-toMoon[1], toMoon[0], 0]

function velocity(progress: number): number[] {
  return sub(routePoint(progress + 1e-4), routePoint(progress - 1e-4))
}

describe('the Apollo 11 route, schematic', () => {
  it('runs on without a gap where one leg joins the next', () => {
    for (const join of [1, 2, 3, 4]) expect(len(sub(routePoint(join - 1e-6), routePoint(join + 1e-6)))).toBeLessThan(1e-3)
  })

  it('starts and ends on Earth, and never passes through Earth or the Moon in between', () => {
    expect(len(sub(routePoint(0), ROUTE_EARTH))).toBeCloseTo(ROUTE_EARTH_RADIUS, 3)
    expect(len(sub(routePoint(5), ROUTE_EARTH))).toBeCloseTo(ROUTE_EARTH_RADIUS, 3)
    for (let p = 0.01; p < 4.99; p += 0.005) {
      expect(len(sub(routePoint(p), ROUTE_EARTH))).toBeGreaterThan(ROUTE_EARTH_RADIUS)
      expect(len(sub(routePoint(p), ROUTE_MOON))).toBeGreaterThan(ROUTE_MOON_RADIUS * 1.2)
    }
  })

  it('goes round Earth prograde in its parking orbit, one and a half times', () => {
    expect(len(sub(routePoint(1.5), ROUTE_EARTH))).toBeCloseTo(PARKING_RADIUS, 5)
    for (const p of [1.1, 1.5, 1.9]) expect(turn(sub(routePoint(p), ROUTE_EARTH), velocity(p))).toBeGreaterThan(0)
    const [start, end] = [sub(routePoint(1), ROUTE_EARTH), sub(routePoint(2), ROUTE_EARTH)]
    expect(dot(start, end) / (len(start) * len(end))).toBeCloseTo(-1, 5)
  })

  it('arrives ahead of the Moon and is swung round its far side, where it brakes into a retrograde orbit', () => {
    expect(dot(sub(routePoint(2.85), ROUTE_MOON), across)).toBeGreaterThan(0)
    const arrival = sub(routePoint(3), ROUTE_MOON)
    expect(len(arrival)).toBeCloseTo(LUNAR_ORBIT_RADIUS, 5)
    expect(dot(arrival, toMoon)).toBeCloseTo(LUNAR_ORBIT_RADIUS, 5)
    for (const p of [3.1, 3.5, 3.9]) expect(turn(sub(routePoint(p), ROUTE_MOON), velocity(p))).toBeLessThan(0)
  })

  it('draws a figure eight: home on the other side of the Earth-Moon line, round Earth prograde again', () => {
    expect(dot(sub(routePoint(4.15), ROUTE_MOON), across)).toBeLessThan(0)
    expect(dot(sub(routePoint(4.85), ROUTE_EARTH), across)).toBeGreaterThan(0)
    expect(turn(sub(routePoint(4.95), ROUTE_EARTH), velocity(4.95))).toBeGreaterThan(0)
  })

  it('lands Eagle on the near side, 23 degrees east of the point under Earth, and brings it back to Columbia', () => {
    const site = sub(LANDING_SITE, ROUTE_MOON)
    const earthward = sub(ROUTE_EARTH, ROUTE_MOON)
    expect(len(site)).toBeCloseTo(ROUTE_MOON_RADIUS, 5)
    expect((Math.acos(dot(site, earthward) / (len(site) * len(earthward))) * 180) / Math.PI).toBeCloseTo(23, 3)
    expect(turn(earthward, site)).toBeGreaterThan(0)
    expect(len(sub(eaglePoint(0), routePoint(UNDOCKING)))).toBeLessThan(1e-6)
    expect(len(sub(eaglePoint(1), LANDING_SITE))).toBeLessThan(1e-6)
    expect(len(sub(eaglePoint(2), routePoint(RENDEZVOUS)))).toBeLessThan(1e-6)
    for (let p = 0; p < 0.99; p += 0.01) expect(len(sub(eaglePoint(p), ROUTE_MOON))).toBeGreaterThan(ROUTE_MOON_RADIUS)
  })
})
