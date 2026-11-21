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

describe("Eagle's shots", async () => {
  const { EAGLE } = await import('../src/learn/apollo/eagleVehicle')
  // The crew compartment (NASSP's cockpit in our frame): its floor 3.66 m up, its front wall at z 1.65.
  const inCabin = ([x, y, z]: number[]) => Math.abs(x) < 1.1 && y > 3.66 && y < 5.8 && z > -0.6 && z < 1.65

  it('walks in standing up, through the front hatch, ending inside the cabin', () => {
    const { walk } = EAGLE.shot('inside')
    expect(walk?.head).toEqual([0, 1, 0])
    const through = walk?.through ?? []
    expect(through.length).toBeGreaterThanOrEqual(2)
    expect(through[0][2]).toBeGreaterThan(1.7)
    expect(inCabin(through[through.length - 1])).toBe(true)
  })

  it('looks forward at the panels from where the Commander stood', () => {
    const { target, radius, azimuth, elevation } = EAGLE.shot('panels').preset
    // With +Y up the camera stands along (cos e cos a, sin e, -cos e sin a) from its target.
    const eye = [target[0] + radius * Math.cos(elevation) * Math.cos(azimuth), target[1] + radius * Math.sin(elevation), target[2] - radius * Math.cos(elevation) * Math.sin(azimuth)]
    expect(target[2]).toBeGreaterThan(1.5)
    expect(inCabin(eye)).toBe(true)
    expect(eye[2]).toBeLessThan(target[2])
    expect(eye[0]).toBeGreaterThan(0.3)
  })
})
