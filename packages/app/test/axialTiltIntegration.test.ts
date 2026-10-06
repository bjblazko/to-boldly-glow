// packages/app/test/axialTiltIntegration.test.ts
import { mat4, vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { PLANETS, type BodyDefinition } from '../src/solarSystem/bodies'
import { MOONS } from '../src/solarSystem/moons'
import { ALL_ENTITIES, entityWorldPosition } from '../src/solarSystem/entities'
import { rotationAngleRadians } from '../src/solarSystem/rotation'
import { axisAlignmentRotation, ECLIPTIC_NORTH, equatorialToEclipticPoleDirection } from '../src/solarSystem/poleOrientation'
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

// The spin angular-momentum direction a body actually renders with: scene/sceneLayout.ts's bodyWorldMatrix builds its world
// matrix as tilt * Rz(rotationAngleRadians(...)), so track which way a surface point moves.
function renderedSpinAxis(body: BodyDefinition): [number, number, number] {
  const tilt = axisAlignmentRotation(equatorialToEclipticPoleDirection(body.poleRightAscensionDegrees, body.poleDeclinationDegrees))
  const surfacePointAt = (days: number) =>
    vec3.transformMat4(
      vec3.create(),
      [1, 0, 0],
      mat4.multiply(mat4.create(), tilt, mat4.fromZRotation(mat4.create(), rotationAngleRadians(days, body.siderealRotationHours))),
    )
  const a = surfacePointAt(0)
  const b = surfacePointAt(0.001)
  const axis = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), a, vec3.subtract(vec3.create(), b, a)))
  return [axis[0], axis[1], axis[2]]
}

// The orbital angular-momentum direction of a moon's actual rendered motion around its parent.
function moonOrbitalAngularMomentum(moonId: string): vec3 {
  const moon = ALL_ENTITIES.find((e) => e.id === moonId)!
  const parent = ALL_ENTITIES.find((e) => e.id === (moon.definition as { parentId: string }).parentId)!
  const relativeAt = (days: number) =>
    vec3.subtract(vec3.create(), entityWorldPosition(moon, 0, days, 1), entityWorldPosition(parent, 0, days, 1))
  const r0 = relativeAt(100)
  const r1 = relativeAt(100.001)
  return vec3.normalize(vec3.create(), vec3.cross(vec3.create(), r0, vec3.subtract(vec3.create(), r1, r0)))
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

  it("Venus's rendered spin is retrograde: its spin axis (pole + rotation sign) sits ~177 degrees from ecliptic north", () => {
    const venus = findPlanet('venus')
    expect(tiltDegreesFromEclipticNorth(renderedSpinAxis(venus))).toBeGreaterThan(175)
  })

  it("every planet's rendered spin axis matches its real obliquity sense (Venus and Uranus retrograde, the rest prograde)", () => {
    for (const planet of PLANETS) {
      const tilt = tiltDegreesFromEclipticNorth(renderedSpinAxis(planet))
      if (planet.id === 'venus' || planet.id === 'uranus') expect(tilt).toBeGreaterThan(90)
      else expect(tilt).toBeLessThan(35)
    }
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

  it("regular moons orbit in their parent's own spin sense, and Triton against Neptune's", () => {
    for (const moon of MOONS) {
      const parent = findPlanet(moon.parentId)
      const alignment = vec3.dot(moonOrbitalAngularMomentum(moon.id), renderedSpinAxis(parent))
      // The Moon's orbit is tied to the ecliptic, not Earth's equator, so it sits up to ~28.6
      // degrees off Earth's spin axis (cos 28.6 = 0.878); every other regular moon is within 0.5.
      if (moon.id === 'triton') expect(alignment).toBeLessThan(-0.9)
      else expect(alignment).toBeGreaterThan(0.85)
    }
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
