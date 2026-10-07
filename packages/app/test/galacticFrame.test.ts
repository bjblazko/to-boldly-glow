import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { sceneToGalactic } from '../src/sky/galacticFrame'
import { equatorialToEclipticPoleDirection } from '../src/solarSystem/poleOrientation'

function galacticDirection(raDegrees: number, decDegrees: number): vec3 {
  const scene = equatorialToEclipticPoleDirection(raDegrees, decDegrees)
  return vec3.transformMat3(vec3.create(), scene, sceneToGalactic())
}

describe('sceneToGalactic', () => {
  it('turns the direction of the galactic center (Sagittarius A*) into the galactic x axis', () => {
    const center = galacticDirection(266.4168, -29.0078)
    expect(center[0]).toBeCloseTo(1, 3)
  })

  it('turns the north galactic pole into the galactic z axis', () => {
    const pole = galacticDirection(192.8595, 27.1283)
    expect(pole[2]).toBeCloseTo(1, 5)
  })

  it('puts the ecliptic north pole at galactic latitude +29.8°, in Draco', () => {
    const eclipticNorth = vec3.transformMat3(vec3.create(), [0, 0, 1], sceneToGalactic())
    expect((Math.asin(eclipticNorth[2]) * 180) / Math.PI).toBeCloseTo(29.81, 1)
  })
})
