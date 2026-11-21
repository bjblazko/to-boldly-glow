import { describe, expect, it } from 'vitest'
import { OrbitCamera } from '../src/camera/orbitCamera'
import { eyeLookingAt } from '../src/learn/vehicle/vehicleCamera'

describe('a vehicle shot from an eye point', () => {
  it('puts the eye there, looking at the point', () => {
    const eye: [number, number, number] = [0, 8.68, 0.72]
    const at: [number, number, number] = [0, 9.2, 0.45]
    const { target, radius, azimuth, elevation } = eyeLookingAt(eye, at)
    const camera = new OrbitCamera({ target, radius, azimuth, elevation, upAxis: [0, 1, 0] })
    const placed = camera.getEyePosition()
    for (let i = 0; i < 3; i++) expect(placed[i]).toBeCloseTo(eye[i], 5)
  })
})
