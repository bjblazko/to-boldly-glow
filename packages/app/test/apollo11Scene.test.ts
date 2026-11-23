import { mat4, vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { getSeconds } from '../src/missions/apollo11/apollo11Events'
import { Apollo11Scene, KM_PER_UNIT } from '../src/missions/apollo11/apollo11Scene'
import { moonAxes } from '../src/missions/apollo11/moonOrientation'
import { realApollo11Trajectory } from './support/apollo11Files'

const scene = new Apollo11Scene(realApollo11Trajectory())
const DEG = 180 / Math.PI

// Latitude and longitude (degrees) of a direction from the Moon's centre, in its own frame.
function selenographic(direction: number[], julianDay: number): { lat: number; lon: number } {
  const inverse = mat4.invert(mat4.create(), moonAxes(julianDay))!
  const [x, y, z] = vec3.transformMat4(vec3.create(), vec3.normalize(vec3.create(), direction), inverse)
  return { lat: Math.asin(z) * DEG, lon: Math.atan2(y, x) * DEG }
}

describe("Apollo 11's world at true scale", () => {
  it('puts Eagle on the Moon at Tranquility Base at the landing', () => {
    scene.setMoment(getSeconds('102:46:00'), 'eagle')
    const moon = scene.layout().moons[0]
    expect(Math.hypot(...moon.position) * KM_PER_UNIT).toBeCloseTo(1735.5, 0)
    const julianDay = 2440418.5 + 0.5640046 + getSeconds('102:46:00') / 86400
    const { lat, lon } = selenographic(moon.position.map((v) => -v), julianDay)
    expect(lat).toBeCloseTo(0.674, 1)
    expect(lon).toBeCloseTo(23.473, 1)
  })

  it('draws the site where the Moon map has it: the body renderer turns the map by the pose', () => {
    scene.setMoment(getSeconds('102:46:00'), 'eagle')
    const moon = scene.layout().moons[0]
    // The mesh puts longitude 0 on local -Y and 90 E on local +X; the site's local direction:
    const [la, lo] = [0.67416 / DEG, 23.47314 / DEG]
    const local = vec3.fromValues(Math.cos(la) * Math.sin(lo), -Math.cos(la) * Math.cos(lo), Math.sin(la))
    const world = vec3.transformMat4(vec3.create(), local, moon.tilt)
    const toEagle = vec3.normalize(vec3.create(), moon.position.map((v) => -v))
    expect(vec3.dot(world, toEagle)).toBeGreaterThan(Math.cos(0.05 / DEG))
  })

  it('shows Earth close below in Earth orbit and the Sun at its size', () => {
    scene.setMoment(getSeconds('001:00:00'), 'columbia')
    const layout = scene.layout()
    const altitude = Math.hypot(...layout.planets[0].position) * KM_PER_UNIT - 6378
    expect(altitude).toBeGreaterThan(150)
    expect(altitude).toBeLessThan(220)
    const sunDegrees = Math.atan(layout.sun.radius / Math.hypot(...layout.sun.position)) * DEG * 2
    expect(sunDegrees).toBeCloseTo(0.53, 1)
  })

  it('keeps every position finite over the whole mission', () => {
    for (let get = getSeconds('000:12:00'); get < getSeconds('195:03:00'); get += 1800) {
      scene.setMoment(get, 'columbia')
      for (const body of [...scene.layout().planets, ...scene.layout().moons]) expect(body.position.every(Number.isFinite)).toBe(true)
    }
  })
})

describe("the craft's motion", () => {
  it('is measured from the Moon in lunar orbit and from Earth on the way', () => {
    scene.setMoment(getSeconds('090:00:00'), 'columbia')
    const inOrbit = scene.motion('columbia')!
    expect(inOrbit.body).toBe('moon')
    expect(Math.hypot(...inOrbit.velocity)).toBeCloseTo(1.63, 1)
    expect(inOrbit.altitudeKm).toBeGreaterThan(90)
    expect(inOrbit.altitudeKm).toBeLessThan(130)
    scene.setMoment(getSeconds('030:00:00'), 'columbia')
    expect(scene.motion('columbia')!.body).toBe('earth')
  })
})

describe('Tranquility Base', () => {
  it('keeps the descent stage where Eagle stood, turning with the Moon', () => {
    scene.setMoment(getSeconds('124:21:00'), 'eagle')
    const before = scene.siteKm()!
    expect(Math.hypot(...before)).toBeLessThan(0.01)
    scene.setMoment(getSeconds('126:00:00'), 'columbia')
    const later = scene.siteKm()!
    expect(Math.hypot(...later.map((v, i) => v - scene.moonKm()[i]))).toBeCloseTo(1735.5, 0)
  })
})
