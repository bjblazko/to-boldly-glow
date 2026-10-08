import { describe, expect, it } from 'vitest'
import {
  EARTH_POSITION,
  EARTH_RADIUS,
  MOON_ORBIT_RADIUS,
  MOON_RADIUS,
  SHADOW_SIZE_RATIO,
  SUN_RADIUS,
  shadowEdgeLines,
  shadowOnEarth,
  shadowOutlinePoints,
  stagedMoonPosition,
  type Sphere,
} from '../src/learn/eclipse/eclipseGeometry'
import { SHADOW_SWEEP_DEGREES } from '../src/learn/eclipse/eclipseScene'

const sun: Sphere = { position: [0, 0, 0], radius: SUN_RADIUS }
const earth: Sphere = { position: EARTH_POSITION, radius: EARTH_RADIUS }
const moonAt = (nodeDegrees: number, degreesPastNewMoon = 0): Sphere => ({ position: stagedMoonPosition(nodeDegrees, degreesPastNewMoon), radius: MOON_RADIUS })

// Where a two-point line reaches x, and its height (z) there.
function heightAt(line: Float32Array, x: number): number {
  const t = (x - line[0]) / (line[3] - line[0])
  return line[2] + (line[5] - line[2]) * t
}

// How far the shadow's middle passes from Earth's center, less the penumbra's radius there: above
// Earth's radius, not even the penumbra touches Earth.
function penumbraClearance(moon: Sphere): number {
  const position = Array.from(moon.position)
  const sunMoonDistance = Math.hypot(...position)
  const axis = position.map((value) => value / sunMoonDistance)
  const toEarth = EARTH_POSITION.map((value, i) => value - position[i])
  const along = toEarth.reduce((sum, value, i) => sum + value * axis[i], 0)
  const miss = Math.sqrt(toEarth.reduce((sum, value) => sum + value * value, 0) - along * along)
  return miss - (MOON_RADIUS + (along * (SUN_RADIUS + MOON_RADIUS)) / sunMoonDistance)
}

describe('the solar eclipse lesson seen from space', () => {
  it('keeps Earth and the Moon in their real size ratio', () => {
    expect(MOON_RADIUS / EARTH_RADIUS).toBeCloseTo(1737.4 / 6371, 6)
  })

  it('at new moon, with the orbit crossing the plane of Earth\'s orbit toward the Sun, puts the Moon right on the Sun-Earth line', () => {
    const [x, y, z] = stagedMoonPosition(0, 0)
    expect(x).toBeCloseTo(EARTH_POSITION[0] - MOON_ORBIT_RADIUS, 6)
    expect(y).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(0, 6)
  })

  it('from the ground right under it, the Moon looks SHADOW_SIZE_RATIO times as big as the Sun - just big enough to cover it', () => {
    const groundX = EARTH_POSITION[0] - EARTH_RADIUS
    const moonAngle = MOON_RADIUS / (groundX - (EARTH_POSITION[0] - MOON_ORBIT_RADIUS))
    const sunAngle = SUN_RADIUS / groundX
    expect(moonAngle / sunAngle).toBeCloseTo(SHADOW_SIZE_RATIO, 6)
    expect(SHADOW_SIZE_RATIO).toBeGreaterThan(1)
    expect(SHADOW_SIZE_RATIO).toBeLessThan(1.2)
  })

  it('casts a small umbra inside a penumbra about half as wide as Earth, centered under the Sun', () => {
    const spot = shadowOnEarth(sun, moonAt(0), earth)!
    expect(spot.center[0]).toBeCloseTo(EARTH_POSITION[0] - EARTH_RADIUS, 6)
    expect(spot.umbraRadius).toBeGreaterThan(0)
    expect(spot.umbraRadius / EARTH_RADIUS).toBeLessThan(0.05)
    expect(spot.penumbraRadius / EARTH_RADIUS).toBeGreaterThan(0.45)
    expect(spot.penumbraRadius / EARTH_RADIUS).toBeLessThan(0.65)
  })

  it('with new moon farthest from the crossing points, the whole shadow - penumbra included - passes above Earth', () => {
    const moon = moonAt(90)
    expect(moon.position[2]).toBeGreaterThan(0)
    expect(shadowOnEarth(sun, moon, earth)).toBeNull()
    expect(penumbraClearance(moon)).toBeGreaterThan(EARTH_RADIUS)
    const { umbra, penumbra } = shadowEdgeLines(sun, moon, [0, 0, 1], EARTH_POSITION[0] + 6)
    for (const edge of [...umbra, ...penumbra]) expect(heightAt(edge, EARTH_POSITION[0])).toBeGreaterThan(EARTH_RADIUS)
  })

  it("draws the umbra's edges grazing the Sun and the Moon on the same side, meeting at the umbra's tip just inside Earth", () => {
    const moon = moonAt(0)
    const { umbra } = shadowEdgeLines(sun, moon, [0, 0, 1], 50)
    const [upper, lower] = umbra
    expect(upper[2]).toBeCloseTo(SUN_RADIUS, 6)
    expect(heightAt(upper, moon.position[0])).toBeCloseTo(MOON_RADIUS, 6)
    expect(lower[2]).toBeCloseTo(-SUN_RADIUS, 6)
    expect(heightAt(lower, moon.position[0])).toBeCloseTo(-MOON_RADIUS, 6)
    // Both end at the same point, on the Sun-Moon line, between Earth's sunward surface and center.
    expect(upper.slice(3)).toEqual(lower.slice(3))
    expect(upper[5]).toBeCloseTo(0, 6)
    expect(upper[3]).toBeGreaterThan(EARTH_POSITION[0] - EARTH_RADIUS)
    expect(upper[3]).toBeLessThan(EARTH_POSITION[0])
  })

  it("draws the penumbra's edges crossing over from one side of the Sun to the other side of the Moon, out to the given reach", () => {
    const moon = moonAt(0)
    const { penumbra } = shadowEdgeLines(sun, moon, [0, 0, 1], 46)
    const [upper, lower] = penumbra
    expect(upper[2]).toBeCloseTo(SUN_RADIUS, 6)
    expect(heightAt(upper, moon.position[0])).toBeCloseTo(-MOON_RADIUS, 6)
    expect(lower[2]).toBeCloseTo(-SUN_RADIUS, 6)
    expect(heightAt(lower, moon.position[0])).toBeCloseTo(MOON_RADIUS, 6)
    expect(upper[3]).toBeCloseTo(46, 6)
  })

  it('outlines both parts of the shadow on the ground, just above the surface', () => {
    const moon = moonAt(0, 4)
    const spot = shadowOnEarth(sun, moon, earth)!
    for (const part of ['umbra', 'penumbra'] as const) {
      const points = shadowOutlinePoints(spot, { sun, moon, earth }, part, 32)
      expect(points.length).toBe(33 * 3)
      for (let i = 0; i < points.length; i += 3) {
        const distance = Math.hypot(points[i] - EARTH_POSITION[0], points[i + 1] - EARTH_POSITION[1], points[i + 2] - EARTH_POSITION[2])
        expect(distance).toBeGreaterThan(EARTH_RADIUS)
        expect(distance).toBeLessThan(EARTH_RADIUS * 1.01)
      }
    }
  })

  it("the shadow close-up's sweep takes the Moon's shadow fully off Earth at both ends, so starting over never jumps on screen", () => {
    expect(shadowOnEarth(sun, moonAt(0), earth)).not.toBeNull()
    for (const end of [-SHADOW_SWEEP_DEGREES, SHADOW_SWEEP_DEGREES]) {
      expect(penumbraClearance(moonAt(0, end))).toBeGreaterThan(EARTH_RADIUS)
    }
  })
})
