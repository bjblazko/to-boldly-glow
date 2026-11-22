import { describe, expect, it } from 'vitest'
import { EARTH_MU, integrate, type State } from '../src/apollo/trajectory/propagate'
import { gmstDegrees, localToInertial, precessionToDate } from '../src/apollo/trajectory/frames'

describe('the integrator', () => {
  it('keeps a circular orbit round a point Earth circular for a whole turn', () => {
    const r = 7000
    const v = Math.sqrt(EARTH_MU / r)
    const period = 2 * Math.PI * Math.sqrt(r ** 3 / EARTH_MU)
    const start: State = { t: 0, position: [r, 0, 0], velocity: [0, v, 0] }
    const end = integrate(start, period, { step: 10, acceleration: (_, p) => p.map((value) => (-EARTH_MU * value) / Math.hypot(...p) ** 3) as [number, number, number] })
    expect(Math.hypot(...end.position)).toBeCloseTo(r, 3)
    expect(end.position[0]).toBeCloseTo(r, 1)
  })
})

describe('the frames', () => {
  it('has Greenwich at 280.46 degrees of sidereal time at noon on 1 January 2000', () => {
    expect(gmstDegrees(2451545.0)).toBeCloseTo(280.46061837, 6)
  })

  it('precesses nothing at J2000, and about 0.43 degrees of longitude by 1969', () => {
    const identity = precessionToDate(2451545.0)
    identity.forEach((value, i) => expect(value).toBeCloseTo([1, 0, 0, 0, 1, 0, 0, 0, 1][i], 9))
    const m = precessionToDate(2440419.0)
    // The equinox of J2000 seen in 1969's frame: turned by the general precession, about 50.3"/yr.
    const turned = Math.atan2(m[3], m[0]) * (180 / Math.PI)
    expect(Math.abs(turned)).toBeGreaterThan(0.38)
    expect(Math.abs(turned)).toBeLessThan(0.45)
  })

  it('turns a speed due east over the equator at Greenwich, sidereal time 0, into +Y', () => {
    const { position, velocity } = localToInertial({ latitude: 0, longitude: 0, radius: 7000, speed: 7.5, flightPath: 0, heading: 90 }, 0)
    expect(position.map((value) => Math.round(value * 1e6) / 1e6)).toEqual([7000, 0, 0])
    expect(velocity.map((value) => Math.round(value * 1e6) / 1e6)).toEqual([0, 7.5, 0])
  })
})
