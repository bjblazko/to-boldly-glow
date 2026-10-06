import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { pickTarget } from '../src/camera/entityPicking'
import { clampSpeedLevel, cruiseSpeed, keepOutside, speedFactor } from '../src/camera/input/flightSpeed'
import { OrbitMotion } from '../src/camera/input/orbitMotion'
import { OrbitCamera } from '../src/camera/orbitCamera'
import { createViewpoint } from '../src/camera/viewpoint'
import { perspectiveProjection } from '../src/camera/viewpoint'

describe('cruiseSpeed', () => {
  const planet = { position: [100, 0, 0] as [number, number, number], radius: 2 }

  it('slows down near a surface and speeds up in open space', () => {
    const near = cruiseSpeed(vec3.fromValues(100, 3, 0), [planet], 0)
    const far = cruiseSpeed(vec3.fromValues(100, 60, 0), [planet], 0)
    expect(far).toBeGreaterThan(near * 20)
  })

  it('scales with the pilot speed setting, a factor of two every two steps', () => {
    const position = vec3.fromValues(100, 30, 0)
    expect(cruiseSpeed(position, [planet], 2) / cruiseSpeed(position, [planet], 0)).toBeCloseTo(2, 6)
    expect(speedFactor(-2)).toBeCloseTo(0.5, 6)
    expect(clampSpeedLevel(99)).toBe(10)
  })
})

describe('keepOutside', () => {
  it('stops the ship at a surface instead of letting it fly through, keeping its sideways motion', () => {
    const position = vec3.fromValues(100.5, 0, 0)
    const velocity = vec3.fromValues(-5, 3, 0)
    keepOutside(position, velocity, [{ position: [100, 0, 0], radius: 2 }])
    expect(vec3.distance(position, [100, 0, 0])).toBeGreaterThanOrEqual(2)
    expect(velocity[0]).toBeCloseTo(0, 6)
    expect(velocity[1]).toBe(3)
  })
})

describe('OrbitMotion', () => {
  it('keeps turning after a released drag, slowing to a stop', () => {
    const camera = new OrbitCamera({ azimuth: 0 })
    const motion = new OrbitMotion(camera)
    for (let i = 0; i < 5; i++) {
      motion.drag(-20, 0)
      motion.update(1 / 60)
    }
    motion.release()
    const released = camera.azimuth
    motion.update(1 / 60)
    expect(camera.azimuth).toBeGreaterThan(released)
    for (let i = 0; i < 300; i++) motion.update(1 / 60)
    const settled = camera.azimuth
    motion.update(1 / 60)
    expect(camera.azimuth).toBe(settled)
  })

  it('glides into a zoom step', () => {
    const camera = new OrbitCamera({ radius: 50 })
    const motion = new OrbitMotion(camera)
    motion.zoom(Math.log(2))
    motion.update(1 / 60)
    expect(camera.radius).toBeGreaterThan(50)
    expect(camera.radius).toBeLessThan(100)
    for (let i = 0; i < 120; i++) motion.update(1 / 60)
    expect(camera.radius).toBeCloseTo(100, 1)
  })
})

describe('pickTarget', () => {
  const canvas = { clientWidth: 800, clientHeight: 600, width: 800, height: 600 } as HTMLCanvasElement
  const camera = new OrbitCamera({ radius: 50, elevation: 0 })
  const viewpoint = createViewpoint(camera.getViewMatrix(), perspectiveProjection(800 / 600, 5), canvas)

  it('picks the body under the point, and the nearer one where two overlap', () => {
    const targets = [
      { id: 'far', position: [0, 0, 0] as [number, number, number], radius: 1 },
      { id: 'near', position: Array.from(camera.getEyePosition(), (v) => v * 0.5) as [number, number, number], radius: 0.2 },
    ]
    expect(pickTarget({ x: 400, y: 300 }, targets, viewpoint)).toBe('near')
    expect(pickTarget({ x: 400, y: 300 }, targets.slice(0, 1), viewpoint)).toBe('far')
    expect(pickTarget({ x: 50, y: 50 }, targets, viewpoint)).toBeNull()
  })
})
