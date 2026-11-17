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

  it('builds up to full speed over about 1.5 s, and comes to rest over about 2 s once let go', () => {
    const camera = level()
    fly(camera, { ...NO_COMMAND, thrust: 1 }, 0.5)
    expect(camera.speed).toBeLessThan(8)
    fly(camera, { ...NO_COMMAND, thrust: 1 }, 1)
    expect(camera.speed).toBeGreaterThan(9)
    expect(camera.velocity[1]).toBeGreaterThan(9)
    fly(camera, NO_COMMAND, 0.5)
    expect(camera.speed).toBeGreaterThan(3)
    fly(camera, NO_COMMAND, 2)
    expect(camera.speed).toBeLessThan(0.5)
  })

  it('flies backward with S, along the nose only, and boosts', () => {
    const camera = level()
    fly(camera, { ...NO_COMMAND, thrust: -1 }, 3)
    expect(camera.velocity[1]).toBeLessThan(-9.5)
    expect(Math.abs(camera.velocity[0]) + Math.abs(camera.velocity[2])).toBeLessThan(0.01)
    fly(camera, { ...NO_COMMAND, thrust: 1, boost: true }, 3)
    expect(camera.velocity[1]).toBeGreaterThan(50)
  })

  it('turns the nose right and up, easing into the turn', () => {
    const camera = level()
    fly(camera, { ...NO_COMMAND, turn: [1, 0] }, 1 / 60)
    const firstStep = camera.getForward()[0]
    expect(firstStep).toBeGreaterThan(0)
    expect(firstStep).toBeLessThan(0.01)
    fly(camera, { ...NO_COMMAND, turn: [1, 0] }, 1)
    expect(camera.getForward()[0]).toBeGreaterThan(0.5)
    const pitched = level()
    fly(pitched, { ...NO_COMMAND, turn: [0, 1] }, 1)
    expect(pitched.getForward()[2]).toBeGreaterThan(0.5)
  })

  it('still looks around with a drag', () => {
    const camera = level()
    camera.look(0.3, 0)
    fly(camera, NO_COMMAND, 0.5)
    expect(camera.getForward()[0]).toBeGreaterThan(0.25)
  })

  it('holds a roll a moment before levelling again', () => {
    const camera = level()
    fly(camera, { ...NO_COMMAND, roll: 1 }, 0.5)
    const rolled = Math.abs(camera.getRight()[2])
    fly(camera, NO_COMMAND, 0.5)
    expect(Math.abs(camera.getRight()[2])).toBeCloseTo(rolled, 3)
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
