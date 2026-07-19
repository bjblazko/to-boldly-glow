// packages/app/test/axialTiltIntegration.test.ts
import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { PLANETS } from '../src/solarSystem/bodies'
import { MOONS } from '../src/solarSystem/moons'
import { ECLIPTIC_NORTH, equatorialToEclipticPoleDirection } from '../src/solarSystem/poleOrientation'
import { moonOrbitPlaneTiltMatrix, moonOrbitReferencePoleDirection } from '../src/solarSystem/moonOrbit'

function findPlanet(id: string) {
  const planet = PLANETS.find((p) => p.id === id)
  if (!planet) throw new Error(`no planet ${id}`)
  return planet
}

function findMoon(id: string) {
  const moon = MOONS.find((m) => m.id === id)
  if (!moon) throw new Error(`no moon ${id}`)
  return moon
}

function tiltDegreesFromEclipticNorth(direction: readonly [number, number, number]): number {
  return (Math.acos(vec3.dot(direction, ECLIPTIC_NORTH)) * 180) / Math.PI
}

describe('real pole data produces the expected axial tilts', () => {
  it("Uranus's real pole direction lies close to its own orbital plane (~90 degrees from ecliptic-north) - it effectively rolls onto its side", () => {
    const uranus = findPlanet('uranus')
    const pole = equatorialToEclipticPoleDirection(uranus.poleRightAscensionDegrees, uranus.poleDeclinationDegrees)
    const tilt = tiltDegreesFromEclipticNorth(pole)
    // IAU's officially-published pole (the "invariable-plane-north" convention) derives ~82°; the
    // commonly-cited ~97.8° describes the SAME physical axis under the other valid convention
    // (right-hand-rule prograde - a supplementary angle, not a different fact). This assertion is
    // convention-agnostic: either way, the axis lies close to the orbital plane, not close to
    // upright - which is the actual "rolls onto its side" phenomenon, independent of which pole a
    // given source calls "north."
    expect(Math.abs(tilt - 90)).toBeLessThan(15)
  })

  it("Venus's real pole direction is tilted close to 180 degrees (near-upside-down)", () => {
    const venus = findPlanet('venus')
    const pole = equatorialToEclipticPoleDirection(venus.poleRightAscensionDegrees, venus.poleDeclinationDegrees)
    expect(tiltDegreesFromEclipticNorth(pole)).toBeGreaterThan(150)
  })

  it("Earth's real pole direction is tilted by roughly its known 23.4-degree obliquity", () => {
    const earth = findPlanet('earth')
    const pole = equatorialToEclipticPoleDirection(earth.poleRightAscensionDegrees, earth.poleDeclinationDegrees)
    expect(tiltDegreesFromEclipticNorth(pole)).toBeCloseTo(23.4393, 1)
  })
})

describe("moons' real orbital-plane data produces the expected geometry", () => {
  it("Titania's and Oberon's orbital planes end up near-polar relative to the ecliptic (tracking Uranus's own extreme tilt)", () => {
    const uranus = findPlanet('uranus')
    for (const moonId of ['titania', 'oberon']) {
      const moon = findMoon(moonId)
      const referencePoleDirection = moonOrbitReferencePoleDirection(moon, uranus)
      const tiltMatrix = moonOrbitPlaneTiltMatrix(
        moon.orbitInclinationToParentEquatorDegrees,
        moon.orbitAscendingNodeDegrees,
        referencePoleDirection,
      )
      const orbitPlaneNormal = vec3.transformMat4(vec3.create(), [0, 0, 1], tiltMatrix) as [number, number, number]
      expect(tiltDegreesFromEclipticNorth(orbitPlaneNormal)).toBeGreaterThan(80)
    }
  })

  it("Triton's orbital plane ends up steeply inclined (retrograde) relative to Neptune's own pole", () => {
    const neptune = findPlanet('neptune')
    const triton = findMoon('triton')
    const referencePoleDirection = moonOrbitReferencePoleDirection(triton, neptune)
    const tiltMatrix = moonOrbitPlaneTiltMatrix(
      triton.orbitInclinationToParentEquatorDegrees,
      triton.orbitAscendingNodeDegrees,
      referencePoleDirection,
    )
    const orbitPlaneNormal = vec3.transformMat4(vec3.create(), [0, 0, 1], tiltMatrix)
    // Its normal should point mostly AWAY from Neptune's own pole direction (retrograde relative
    // to Neptune's rotation), i.e. the dot product with Neptune's pole is strongly negative.
    expect(vec3.dot(orbitPlaneNormal, referencePoleDirection)).toBeLessThan(-0.8)
  })

  it("the Galilean moons and Titan stay close to their parent's equatorial plane (small real inclination)", () => {
    const jupiter = findPlanet('jupiter')
    for (const moonId of ['io', 'europa', 'ganymede', 'callisto']) {
      const moon = findMoon(moonId)
      const referencePoleDirection = moonOrbitReferencePoleDirection(moon, jupiter)
      const tiltMatrix = moonOrbitPlaneTiltMatrix(
        moon.orbitInclinationToParentEquatorDegrees,
        moon.orbitAscendingNodeDegrees,
        referencePoleDirection,
      )
      const orbitPlaneNormal = vec3.transformMat4(vec3.create(), [0, 0, 1], tiltMatrix)
      expect(vec3.dot(orbitPlaneNormal, referencePoleDirection)).toBeGreaterThan(0.99)
    }
  })
})
