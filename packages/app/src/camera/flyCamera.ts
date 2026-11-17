import { mat3, mat4, quat, vec3 } from 'gl-matrix'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'

export interface FlyCameraOptions {
  position?: [number, number, number]
  yaw?: number
  pitch?: number
}

// What the pilot asks for this frame (see flightInput.ts for where it comes from).
export interface FlightCommand {
  // Thrust along the nose, -1..1 (backward..forward). The ship has no side or vertical thrusters.
  thrust: number
  // How hard to turn the nose, each -1..1: yaw (positive to the right), pitch (positive up).
  turn: [number, number]
  // -1..1, positive rolling the view clockwise.
  roll: number
  boost: boolean
}

export const NO_COMMAND: FlightCommand = { thrust: 0, turn: [0, 0], roll: 0, boost: false }

// The ship has mass: under thrust it reaches its speed in about 1.5 s (three of these), and let go
// it comes to rest in about 2 s.
const THRUST_RESPONSE_SECONDS = 0.5
const COAST_RESPONSE_SECONDS = 0.7
// The nose turns at up to this rate, easing in and out of a turn over about this long, so a tap is
// a small correction and holding a key a steady turn.
const TURN_RADIANS_PER_SECOND = 1.2
const TURN_RESPONSE_SECONDS = 0.2
// Mouse and touch look is smoothed just enough to take the jitter out of a drag.
const LOOK_RESPONSE_SECONDS = 0.05
const ROLL_RADIANS_PER_SECOND = 1.4
const BOOST_FACTOR = 6
// Left alone, the view slowly rolls back level with the ecliptic, so the planets' plane stays
// a horizon however wildly the pilot has turned - except when looking almost straight along the
// ecliptic's pole, where "level" has no meaning.
const LEVELING_SECONDS = 2.5
const LEVELING_LIMIT = 0.97
// After a roll, the levelling waits this long, so the pilot's roll is not undone at once.
const LEVELING_PAUSE_SECONDS = 1.5

// First-person free-flight camera, flown like a spaceship: the nose steered (pitch, yaw, roll),
// thrust forward or back with inertia, mouse/touch look. `orientation` is a quaternion (no gimbal lock, so the ship
// can loop freely); looking turns it around the ship's own up and right axes.
export class FlyCamera {
  position: vec3
  orientation: quat
  velocity = vec3.create()
  private pendingLook: [number, number] = [0, 0]
  // The nose's turn under way (yaw, pitch; -1..1 of the full rate), easing toward the command.
  private turnRate: [number, number] = [0, 0]
  private sinceRoll = Number.POSITIVE_INFINITY

  constructor(options: FlyCameraOptions = {}) {
    this.position = vec3.fromValues(...(options.position ?? [0, 25, 60]))
    // Base forward is +Z; yaw option rotates around world Y to match the original Euler default
    // (yaw=PI faces -Z, matching the renderer-core plan's fixed camera looking from +Z toward origin).
    this.orientation = quat.setAxisAngle(quat.create(), [0, 1, 0], options.yaw ?? Math.PI)
    if (options.pitch) {
      const pitchQuat = quat.setAxisAngle(quat.create(), [1, 0, 0], options.pitch)
      quat.multiply(this.orientation, this.orientation, pitchQuat)
    }
  }

  get speed(): number {
    return vec3.length(this.velocity)
  }

  getForward(): vec3 {
    return vec3.transformQuat(vec3.create(), [0, 0, 1], this.orientation)
  }

  getUp(): vec3 {
    return vec3.transformQuat(vec3.create(), [0, 1, 0], this.orientation)
  }

  getRight(): vec3 {
    return vec3.transformQuat(vec3.create(), [-1, 0, 0], this.orientation)
  }

  getViewMatrix(): mat4 {
    const forward = this.getForward()
    const target = vec3.add(vec3.create(), this.position, forward)
    return mat4.lookAt(mat4.create(), this.position, target, this.getUp())
  }

  // Queues a turn of the view (radians): positive yaw turns right, positive pitch looks up.
  look(yaw: number, pitch: number): void {
    this.pendingLook[0] += yaw
    this.pendingLook[1] += pitch
  }

  // One frame of flight. cruiseSpeed (scene units per second) is how fast full thrust flies here.
  fly(command: FlightCommand, deltaSeconds: number, cruiseSpeed: number): void {
    this.applyLook(deltaSeconds)
    this.steer(command.turn, deltaSeconds)
    this.roll(command.roll, deltaSeconds)
    const wanted = vec3.scale(vec3.create(), this.getForward(), command.thrust * cruiseSpeed * (command.boost ? BOOST_FACTOR : 1))
    const response = command.thrust !== 0 ? THRUST_RESPONSE_SECONDS : COAST_RESPONSE_SECONDS
    vec3.lerp(this.velocity, this.velocity, wanted, 1 - Math.exp(-deltaSeconds / response))
    vec3.scaleAndAdd(this.position, this.position, this.velocity, deltaSeconds)
  }

  stop(): void {
    vec3.zero(this.velocity)
    this.pendingLook = [0, 0]
    this.turnRate = [0, 0]
  }

  turnPitch(delta: number): void {
    this.turn([1, 0, 0], -delta)
  }

  turnYaw(delta: number): void {
    this.turn([0, 1, 0], -delta)
  }

  turnRoll(delta: number): void {
    this.turn([0, 0, 1], delta)
  }

  moveForward(distance: number): void {
    vec3.scaleAndAdd(this.position, this.position, this.getForward(), distance)
  }

  moveRight(distance: number): void {
    vec3.scaleAndAdd(this.position, this.position, this.getRight(), distance)
  }

  // Snaps this camera's position/orientation to match an arbitrary eye position and look
  // direction (e.g. the orbit camera's current view), so switching into free-fly doesn't jump the
  // view to wherever the ship was last left. The ship starts at rest.
  setPose(position: vec3, forward: vec3, referenceUp: vec3): void {
    vec3.copy(this.position, position)
    const f = vec3.normalize(vec3.create(), forward)
    const rawRight = vec3.cross(vec3.create(), f, referenceUp)
    // Looking straight along referenceUp leaves "right" undefined (a zero cross product, which
    // would normalize to NaN and blank the view) - any perpendicular will do there.
    if (vec3.length(rawRight) < 1e-6) vec3.cross(rawRight, f, Math.abs(f[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])
    const right = vec3.normalize(vec3.create(), rawRight)
    const up = vec3.cross(vec3.create(), right, f)
    // Columns map this class's base axes (right=[-1,0,0], up=[0,1,0], forward=[0,0,1]) onto the
    // given basis, matching getRight()/getUp()/getForward()'s conventions.
    const basis = mat3.fromValues(-right[0], -right[1], -right[2], up[0], up[1], up[2], f[0], f[1], f[2])
    quat.normalize(this.orientation, quat.fromMat3(quat.create(), basis))
    this.stop()
  }

  private steer(turn: [number, number], deltaSeconds: number): void {
    const ease = 1 - Math.exp(-deltaSeconds / TURN_RESPONSE_SECONDS)
    this.turnRate = [this.turnRate[0] + (turn[0] - this.turnRate[0]) * ease, this.turnRate[1] + (turn[1] - this.turnRate[1]) * ease]
    this.turnYaw(this.turnRate[0] * TURN_RADIANS_PER_SECOND * deltaSeconds)
    this.turnPitch(this.turnRate[1] * TURN_RADIANS_PER_SECOND * deltaSeconds)
  }

  // Rolls while asked to; otherwise, after a pause, levels back to the ecliptic.
  private roll(roll: number, deltaSeconds: number): void {
    if (roll !== 0) {
      this.sinceRoll = 0
      this.turnRoll(roll * ROLL_RADIANS_PER_SECOND * deltaSeconds)
      return
    }
    this.sinceRoll += deltaSeconds
    if (this.sinceRoll > LEVELING_PAUSE_SECONDS) this.level(deltaSeconds)
  }

  private applyLook(deltaSeconds: number): void {
    const share = 1 - Math.exp(-deltaSeconds / LOOK_RESPONSE_SECONDS)
    const [yaw, pitch] = [this.pendingLook[0] * share, this.pendingLook[1] * share]
    this.pendingLook = [this.pendingLook[0] - yaw, this.pendingLook[1] - pitch]
    this.turnYaw(yaw)
    this.turnPitch(pitch)
  }

  // Rolls part of the way toward having the ecliptic's north up.
  private level(deltaSeconds: number): void {
    const forward = this.getForward()
    const north = vec3.fromValues(...ECLIPTIC_NORTH)
    if (Math.abs(vec3.dot(forward, north)) > LEVELING_LIMIT) return
    const levelUp = vec3.normalize(vec3.create(), vec3.scaleAndAdd(vec3.create(), north, forward, -vec3.dot(north, forward)))
    const up = this.getUp()
    const angle = Math.atan2(vec3.dot(vec3.cross(vec3.create(), up, levelUp), forward), vec3.dot(up, levelUp))
    const correction = quat.setAxisAngle(quat.create(), forward, angle * (1 - Math.exp(-deltaSeconds / LEVELING_SECONDS)))
    quat.normalize(this.orientation, quat.multiply(this.orientation, correction, this.orientation))
  }

  // Renormalizes afterward: turns run every frame a key is held, and float32 rounding in repeated
  // quaternion products otherwise lets |orientation| drift away from 1, which transformQuat turns
  // into slowly growing/shrinking forward/up/right vectors.
  private turn(localAxis: [number, number, number], delta: number): void {
    if (delta === 0) return
    const rotation = quat.setAxisAngle(quat.create(), localAxis, delta)
    quat.normalize(this.orientation, quat.multiply(this.orientation, this.orientation, rotation))
  }
}
