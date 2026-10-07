import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { FlyCamera, NO_COMMAND, type FlightCommand } from '../src/camera/flyCamera'

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

  it('pitches through a full vertical loop without gimbal lock, ending back at its starting heading', () => {
    const camera = new FlyCamera({ yaw: Math.PI, pitch: 0 })
    for (let i = 0; i < 360; i++) {
      camera.turnPitch((2 * Math.PI) / 360)
      const forward = camera.getForward()
      expect(Math.hypot(forward[0], forward[1], forward[2])).toBeCloseTo(1, 5)
    }
    const forward = camera.getForward()
    expect(forward[0]).toBeCloseTo(0, 5)
    expect(forward[1]).toBeCloseTo(0, 5)
    expect(forward[2]).toBeCloseTo(-1, 5)
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

  it('setPose stays finite when looking straight along the reference up direction', () => {
    const camera = new FlyCamera()
    camera.setPose(vec3.fromValues(0, 0, 10), vec3.fromValues(0, 0, -1), vec3.fromValues(0, 0, 1))
    const forward = camera.getForward()
    expect(forward[2]).toBeCloseTo(-1, 5)
    for (const value of camera.getViewMatrix()) expect(Number.isFinite(value)).toBe(true)
  })
})

describe('FlyCamera flight', () => {
  const north = vec3.fromValues(0, 0, 1)
  const level = () => {
    const camera = new FlyCamera()
    camera.setPose(vec3.fromValues(0, -10, 0), vec3.fromValues(0, 1, 0), north)
    return camera
  }
  const fly = (camera: FlyCamera, command: FlightCommand, seconds: number, speed = 10) => {
    for (let t = 0; t < seconds; t += 1 / 60) camera.fly(command, 1 / 60, speed)
  }

  it('eases into full thrust and coasts to a stop when let go', () => {
    const camera = level()
    camera.fly({ ...NO_COMMAND, thrust: [0, 0, 1] }, 1 / 60, 10)
    expect(camera.speed).toBeGreaterThan(0)
    expect(camera.speed).toBeLessThan(2)
    fly(camera, { ...NO_COMMAND, thrust: [0, 0, 1] }, 2)
    expect(camera.speed).toBeCloseTo(10, 0)
    expect(camera.velocity[1]).toBeGreaterThan(9.5)
    fly(camera, NO_COMMAND, 2)
    expect(camera.speed).toBeLessThan(0.1)
  })

  it('strafes right, rises up, and boosts', () => {
    const camera = level()
    fly(camera, { ...NO_COMMAND, thrust: [1, 0, 0] }, 2)
    expect(camera.velocity[0]).toBeGreaterThan(9.5)
    fly(camera, { ...NO_COMMAND, thrust: [0, 1, 0], boost: true }, 2)
    expect(camera.velocity[2]).toBeGreaterThan(50)
  })

  it('turns right and looks up when asked to', () => {
    const camera = level()
    camera.look(0.3, 0)
    fly(camera, NO_COMMAND, 0.5)
    expect(camera.getForward()[0]).toBeGreaterThan(0.25)
    camera.look(0, 0.3)
    fly(camera, NO_COMMAND, 0.5)
    expect(camera.getForward()[2]).toBeGreaterThan(0.25)
  })

  it('rolls with Q/E and levels back to the ecliptic once let go', () => {
    const camera = level()
    fly(camera, { ...NO_COMMAND, roll: 1 }, 0.5)
    expect(Math.abs(camera.getRight()[2])).toBeGreaterThan(0.4)
    fly(camera, NO_COMMAND, 12)
    expect(Math.abs(camera.getRight()[2])).toBeLessThan(0.05)
    expect(camera.getUp()[2]).toBeGreaterThan(0.95)
  })
})
