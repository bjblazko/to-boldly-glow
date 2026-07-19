import { describe, expect, it } from 'vitest'
import { generateOrbitPathPositions } from '../src/solarSystem/orbitPath'
import { PLANETS } from '../src/solarSystem/bodies'
import { AU_TO_SCENE_UNITS } from '../src/solarSystem/sceneScale'

describe('generateOrbitPathPositions', () => {
  const earth = PLANETS.find((p) => p.id === 'earth')!

  it('produces a closed loop: first and last points are the same start-of-orbit position', () => {
    const points = generateOrbitPathPositions(earth, 0)
    const n = points.length
    // Precision note: VSOP87's longitude/latitude/distance series include secular and
    // cross-planet perturbation terms, so they are not *exactly* periodic over one mean
    // sidereal period the way a pure two-body Kepler ellipse would be — sampling T=0 and
    // T=period lands at positions that are extremely close but not bit-identical (observed
    // diff ~8e-4 scene units against a ~20-unit orbital radius, i.e. ~4e-5 relative). A
    // tolerance of 6 decimal places (as an idealized closed-ellipse assumption might suggest)
    // is unrealistically tight for this data; 2 decimal places still confirms the loop closes
    // to well within visual/rendering tolerance.
    expect(points[0]).toBeCloseTo(points[n - 3], 2)
    expect(points[1]).toBeCloseTo(points[n - 2], 2)
    expect(points[2]).toBeCloseTo(points[n - 1], 2)
  })

  it("every sampled point sits close to Earth's ~1 AU mean orbital radius at realistic scale", () => {
    const points = generateOrbitPathPositions(earth, 0)
    for (let i = 0; i < points.length; i += 3) {
      const distance = Math.sqrt(points[i] ** 2 + points[i + 1] ** 2 + points[i + 2] ** 2)
      expect(distance).toBeGreaterThan(0.9 * AU_TO_SCENE_UNITS)
      expect(distance).toBeLessThan(1.1 * AU_TO_SCENE_UNITS)
    }
  })

  it('throws for a body with no orbital data (guards against passing the Sun by mistake)', () => {
    const fakeBody = { ...earth, position: null, siderealPeriodDays: null }
    expect(() => generateOrbitPathPositions(fakeBody, 0)).toThrow()
  })
})
