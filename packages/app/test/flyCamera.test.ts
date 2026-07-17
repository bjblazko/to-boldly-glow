import { describe, expect, it } from 'vitest'
import { FlyCamera } from '../src/camera/flyCamera'

describe('FlyCamera', () => {
  it('faces -Z at yaw PI, pitch 0', () => {
    const camera = new FlyCamera({ yaw: Math.PI, pitch: 0 })
    const forward = camera.getForward()
    expect(forward[0]).toBeCloseTo(0, 5)
    expect(forward[1]).toBeCloseTo(0, 5)
    expect(forward[2]).toBeCloseTo(-1, 5)
  })

  it('faces +X at yaw PI/2, pitch 0', () => {
    const camera = new FlyCamera({ yaw: Math.PI / 2, pitch: 0 })
    const forward = camera.getForward()
    expect(forward[0]).toBeCloseTo(1, 5)
    expect(forward[2]).toBeCloseTo(0, 5)
  })

  it('computes a right vector perpendicular to forward, pointing +X when facing -Z', () => {
    const camera = new FlyCamera({ yaw: Math.PI, pitch: 0 })
    const right = camera.getRight()
    expect(right[0]).toBeCloseTo(1, 5)
    expect(right[1]).toBeCloseTo(0, 5)
    expect(right[2]).toBeCloseTo(0, 5)
  })

  it('clamps pitch to avoid flipping past straight up/down', () => {
    const camera = new FlyCamera({ pitch: 0 })
    camera.applyLook(0, -1000000, 1)
    expect(camera.pitch).toBeLessThanOrEqual(Math.PI / 2)
  })

  it('moves position forward along the forward vector', () => {
    const camera = new FlyCamera({ position: [0, 0, 0], yaw: Math.PI, pitch: 0 })
    camera.moveForward(5)
    expect(camera.position[2]).toBeCloseTo(-5, 5)
  })

  it('moves position sideways along the right vector', () => {
    const camera = new FlyCamera({ position: [0, 0, 0], yaw: Math.PI, pitch: 0 })
    camera.moveRight(5)
    expect(camera.position[0]).toBeCloseTo(5, 5)
  })
})
