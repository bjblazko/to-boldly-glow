import { mat4, vec3 } from 'gl-matrix'
import { ECLIPTIC_NORTH } from '../../solarSystem/poleOrientation'
import { InertialDirection } from './inertialDirection'
import { smoothingFactor } from './shipMotion'

// The scene's real "up" (world Z), as for every other camera: a world-Y up put the tour 90 degrees
// off the rest of the app.
export const WORLD_UP: vec3 = vec3.fromValues(...ECLIPTIC_NORTH)

// The gaze turns like a heavy ship: at most this fast, gathering and losing speed only gradually, so
// it never starts, stops or swings to a new target with a jolt.
export const MAX_GAZE_TURN_RATE = 0.7 // radians per second
export const MAX_GAZE_TURN_ACCELERATION = 0.8 // radians per second squared
const GAZE_SETTLE_RATE = 2.5

// Banking into turns: the roll follows the ship's yaw rate, limited and eased.
export const MAX_BANK_RADIANS = (18 * Math.PI) / 180
const BANK_SECONDS_PER_RADIAN_OF_TURN = 0.9
const BANK_SMOOTHING_RATE = 1.5

// The view from the ship's cockpit: where the pilot looks, and how far the ship rolls in a turn.
export class ShipView {
  up = vec3.clone(WORLD_UP)
  private bank = 0
  private readonly look = new InertialDirection(
    vec3.fromValues(0, 0, 1),
    { maxRate: MAX_GAZE_TURN_RATE, acceleration: MAX_GAZE_TURN_ACCELERATION, settleRate: GAZE_SETTLE_RATE },
    WORLD_UP,
  )

  get gaze(): vec3 {
    return this.look.direction
  }

  reset(forward: vec3): void {
    this.look.reset(forward)
    this.bank = 0
    this.up = levelUp(this.gaze, WORLD_UP)
  }

  // yawRate is how fast the ship's heading turns around world up (positive = left, seen from above).
  // The roll shows most while looking along the flight direction, little while looking sideways.
  update(deltaSeconds: number, desiredGaze: vec3, flight: { heading: vec3; yawRate: number }): void {
    this.look.turnToward(desiredGaze, deltaSeconds)
    const lookingAhead = Math.max(0, vec3.dot(this.gaze, flight.heading))
    const bankTarget = clampBank(flight.yawRate * BANK_SECONDS_PER_RADIAN_OF_TURN) * lookingAhead
    this.bank += (bankTarget - this.bank) * smoothingFactor(BANK_SMOOTHING_RATE, deltaSeconds)
    this.up = bankedUp(this.gaze, levelUp(this.gaze, this.up), this.bank)
  }

  viewMatrix(position: vec3): mat4 {
    return mat4.lookAt(mat4.create(), position, vec3.add(vec3.create(), position, this.gaze), this.up)
  }
}

function clampBank(bank: number): number {
  return Math.min(Math.max(bank, -MAX_BANK_RADIANS), MAX_BANK_RADIANS)
}

// World up made perpendicular to the gaze: a level horizon. Looking straight up or down, where that
// is undefined, the previous up carries over instead of flipping the view around.
function levelUp(gaze: vec3, previousUp: vec3): vec3 {
  for (const reference of [WORLD_UP, previousUp]) {
    const up = vec3.scaleAndAdd(vec3.create(), reference, gaze, -vec3.dot(reference, gaze))
    if (vec3.length(up) > 1e-3) return vec3.normalize(up, up)
  }
  return vec3.clone(previousUp)
}

// Rolls the level up vector around the gaze: positive bank tips it toward the left (a left turn).
function bankedUp(gaze: vec3, level: vec3, bank: number): vec3 {
  const rotation = mat4.fromRotation(mat4.create(), -bank, gaze)
  return vec3.normalize(vec3.create(), vec3.transformMat4(vec3.create(), level, rotation))
}
