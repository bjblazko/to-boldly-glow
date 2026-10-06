import { mat4, vec3 } from 'gl-matrix'
import { AU_KM, type BodyDefinition } from '../solarSystem/bodies'
import { entityWorldPosition, type SolarSystemEntity } from '../solarSystem/entities'
import { scaledBodyRadiusUnits } from '../solarSystem/sceneScale'
import type { Ephemeris } from '../time/ephemeris'
import { stepToward, turnRateAround, turnToward } from './tour/shipMotion'
import { ShipView, WORLD_UP } from './tour/shipView'
import { TourItinerary } from './tour/tourItinerary'

// A leg's cruise speed is its length over this many seconds (at least MIN_CRUISE_SPEED), and the
// engine reaches cruise speed - or brakes from it - in ACCELERATION_SECONDS.
const TRANSIT_SECONDS = 20
const MIN_CRUISE_SPEED = 0.5
export const ACCELERATION_SECONDS = 5
// The ship's lateral thrust, relative to its forward thrust, limits how fast it can turn at speed
// (a slow ship turns quickly, a fast one in wide arcs) - and never faster than MAX_TURN_RATE.
const LATERAL_THRUST_RATIO = 2
const MAX_TURN_RATE = 1.2 // radians per second

// The flyby loop circles the planet at this many body radii, one lap in about LOOP_SECONDS.
const LOOP_RADIUS_IN_BODY_RADII = 8
const LOOP_SECONDS = 8
const LOOP_ANGULAR_SPEED = (2 * Math.PI) / LOOP_SECONDS

// Gives up on a target that takes this long to reach, so the tour can never appear stuck.
const MAX_CRUISE_SECONDS = 45

// The gaze looks this far ahead along the flight path, and swings over to the planet as the ship
// closes in - fully locked on from this many loop radii away.
const LOOK_AHEAD_SECONDS = 3
const GAZE_LOCK_IN_LOOP_RADII = 6

interface Leg {
  target: SolarSystemEntity
  // The loop is entered at the planet's side (seen along the leg), so the ship arrives tangentially.
  side: vec3
  loopRadius: number
  cruiseSpeed: number
}

interface Loop {
  startOffset: vec3
  direction: number
  angle: number
  angularSpeed: number
}

export interface TourStart {
  position: readonly [number, number, number]
  forward?: readonly [number, number, number]
}

// An endless sightseeing flight, flown like a spaceship: it picks the nearest planet not yet seen,
// accelerates toward it, brakes on arrival, makes one lap around it and heads for the next one -
// with inertia, a limited turn rate, banking into turns and a gaze that leads the flight path.
export class TourController {
  private readonly position = vec3.create()
  private heading = vec3.fromValues(0, 0, 1)
  private speed = 0
  private yawRate = 0
  private readonly view = new ShipView()
  private readonly itinerary: TourItinerary
  private leg: Leg | null = null
  private loop: Loop | null = null
  private cruiseSeconds = 0

  constructor(planets: SolarSystemEntity[]) {
    this.itinerary = new TourItinerary(planets)
  }

  // Starts at rest where the camera is, looking where it looked.
  start(from: TourStart, ephemeris: Ephemeris, scaleBlend: number): void {
    vec3.set(this.position, ...from.position)
    this.speed = 0
    this.loop = null
    this.itinerary.restart()
    this.beginLeg(null, ephemeris, scaleBlend)
    const forward = from.forward ? vec3.fromValues(...from.forward) : null
    this.heading = forward && vec3.length(forward) > 1e-9 ? vec3.normalize(forward, forward) : this.directionTo(this.planetPosition(ephemeris, scaleBlend))
    this.view.reset(this.heading)
  }

  stop(): void {
    this.leg = null
    this.loop = null
  }

  getEyePosition(): [number, number, number] {
    return [this.position[0], this.position[1], this.position[2]]
  }

  getLookAt(): [number, number, number] {
    const lookAt = vec3.scaleAndAdd(vec3.create(), this.position, this.view.gaze, 10)
    return [lookAt[0], lookAt[1], lookAt[2]]
  }

  getUp(): [number, number, number] {
    return [this.view.up[0], this.view.up[1], this.view.up[2]]
  }

  getViewMatrix(): mat4 {
    return this.view.viewMatrix(this.position)
  }

  update(deltaSeconds: number, ephemeris: Ephemeris, scaleBlend: number): void {
    if (!this.leg) return
    const planet = this.planetPosition(ephemeris, scaleBlend)
    const headingBefore = vec3.clone(this.heading)
    if (this.loop) this.flyLoop(this.loop, deltaSeconds, { planet, acceleration: this.leg.cruiseSpeed / ACCELERATION_SECONDS })
    else this.cruise(this.leg, deltaSeconds, planet)
    this.yawRate = turnRateAround(headingBefore, this.heading, WORLD_UP, deltaSeconds)
    this.view.update(deltaSeconds, this.desiredGaze(this.leg, planet), { heading: this.heading, yawRate: this.yawRate })
    this.continueItinerary(this.leg, planet, { ephemeris, scaleBlend })
  }

  private continueItinerary(leg: Leg, planet: vec3, moment: { ephemeris: Ephemeris; scaleBlend: number }): void {
    if (this.loop && this.loop.angle >= 2 * Math.PI) {
      this.beginLeg(leg.target, moment.ephemeris, moment.scaleBlend)
    } else if (!this.loop && vec3.distance(this.position, planet) <= leg.loopRadius * 1.02) {
      this.loop = this.enterLoop(leg, planet)
    } else if (!this.loop && this.cruiseSeconds >= MAX_CRUISE_SECONDS) {
      this.beginLeg(leg.target, moment.ephemeris, moment.scaleBlend)
    }
  }

  // Seek-and-arrive toward the loop's entry point: turn at the rate the ship's thrust allows, ease
  // off while pointing away from the target, and brake in time to arrive at loop speed.
  private cruise(leg: Leg, deltaSeconds: number, planet: vec3): void {
    this.cruiseSeconds += deltaSeconds
    const entryPoint = vec3.scaleAndAdd(vec3.create(), planet, leg.side, leg.loopRadius)
    const toEntry = vec3.subtract(vec3.create(), entryPoint, this.position)
    const distance = vec3.length(toEntry)
    if (distance < 1e-9) return
    const acceleration = leg.cruiseSpeed / ACCELERATION_SECONDS
    const turnRate = Math.min(MAX_TURN_RATE, (LATERAL_THRUST_RATIO * acceleration) / Math.max(this.speed, 1e-9))
    const desiredDirection = vec3.scale(toEntry, toEntry, 1 / distance)
    this.heading = turnToward(this.heading, desiredDirection, turnRate * deltaSeconds, WORLD_UP)
    const alignment = (1 + vec3.dot(this.heading, desiredDirection)) / 2
    const loopSpeed = leg.loopRadius * LOOP_ANGULAR_SPEED
    const arrivalSpeed = Math.sqrt(loopSpeed * loopSpeed + 2 * acceleration * distance)
    this.speed = stepToward(this.speed, Math.min(leg.cruiseSpeed, arrivalSpeed) * alignment, acceleration * deltaSeconds)
    vec3.scaleAndAdd(this.position, this.position, this.heading, this.speed * deltaSeconds)
  }

  // Circles world up through the (moving) planet from wherever the ship arrived, in the direction
  // that continues its heading, keeping its speed and then settling to the loop's own pace.
  private enterLoop(leg: Leg, planet: vec3): Loop {
    const startOffset = vec3.subtract(vec3.create(), this.position, planet)
    // Arriving almost straight above or below the planet, a loop around the vertical would only spin
    // in place: swing out to the entry point instead.
    if (Math.hypot(startOffset[0], startOffset[1]) < leg.loopRadius * 0.25) vec3.scale(startOffset, leg.side, leg.loopRadius)
    const counterclockwise = vec3.cross(vec3.create(), WORLD_UP, startOffset)
    const direction = vec3.dot(counterclockwise, this.heading) < 0 ? -1 : 1
    const circleRadius = Math.max(Math.hypot(startOffset[0], startOffset[1]), 1e-9)
    return { startOffset, direction, angle: 0, angularSpeed: this.speed / circleRadius }
  }

  // The loop's pace changes within the same engine limits as the cruise.
  private flyLoop(loop: Loop, deltaSeconds: number, { planet, acceleration }: { planet: vec3; acceleration: number }): void {
    const circleRadius = Math.max(Math.hypot(loop.startOffset[0], loop.startOffset[1]), 1e-9)
    loop.angularSpeed = stepToward(loop.angularSpeed, LOOP_ANGULAR_SPEED, (acceleration / circleRadius) * deltaSeconds)
    loop.angle = Math.min(loop.angle + loop.angularSpeed * deltaSeconds, 2 * Math.PI)
    const rotation = mat4.fromRotation(mat4.create(), loop.direction * loop.angle, WORLD_UP)
    const offset = vec3.transformMat4(vec3.create(), loop.startOffset, rotation)
    vec3.add(this.position, planet, offset)
    const tangent = vec3.scale(vec3.create(), vec3.cross(vec3.create(), WORLD_UP, offset), loop.direction)
    vec3.scale(this.heading, tangent, 1 / circleRadius)
    this.speed = circleRadius * loop.angularSpeed
  }

  // Ahead along the flight path while far away, swinging over to the planet on the way in, and
  // fixed on it while circling.
  private desiredGaze(leg: Leg, planet: vec3): vec3 {
    const aheadDistance = Math.max(this.speed, leg.cruiseSpeed) * LOOK_AHEAD_SECONDS
    const ahead = vec3.scaleAndAdd(vec3.create(), this.position, this.heading, aheadDistance)
    const lockStart = leg.loopRadius * GAZE_LOCK_IN_LOOP_RADII
    const closeness = Math.min(Math.max((lockStart - vec3.distance(this.position, planet)) / Math.max(lockStart - leg.loopRadius, 1e-9), 0), 1)
    const planetWeight = this.loop ? 1 : closeness * closeness * (3 - 2 * closeness)
    const gazePoint = vec3.lerp(vec3.create(), ahead, planet, planetWeight)
    return this.directionTo(gazePoint)
  }

  private beginLeg(justVisited: SolarSystemEntity | null, ephemeris: Ephemeris, scaleBlend: number): void {
    const positionOf = (planet: SolarSystemEntity) => vec3.fromValues(...entityWorldPosition(planet, ephemeris.julianMillennia, ephemeris.daysSinceEpoch, scaleBlend))
    const target = this.itinerary.next(this.position, positionOf, justVisited)
    const toTarget = vec3.subtract(vec3.create(), positionOf(target), this.position)
    const direction = vec3.length(toTarget) > 1e-6 ? vec3.normalize(vec3.create(), toTarget) : vec3.fromValues(0, 0, 1)
    let side = vec3.cross(vec3.create(), direction, WORLD_UP)
    if (vec3.length(side) < 1e-6) side = vec3.cross(vec3.create(), direction, [1, 0, 0])
    const { radiusKm, compactVisualRadius } = target.definition as BodyDefinition
    this.leg = {
      target,
      side: vec3.normalize(side, side),
      loopRadius: scaledBodyRadiusUnits(radiusKm, compactVisualRadius, scaleBlend, AU_KM) * LOOP_RADIUS_IN_BODY_RADII,
      cruiseSpeed: Math.max(vec3.length(toTarget) / TRANSIT_SECONDS, MIN_CRUISE_SPEED),
    }
    this.loop = null
    this.cruiseSeconds = 0
  }

  private planetPosition(ephemeris: Ephemeris, scaleBlend: number): vec3 {
    return vec3.fromValues(...entityWorldPosition(this.leg!.target, ephemeris.julianMillennia, ephemeris.daysSinceEpoch, scaleBlend))
  }

  private directionTo(point: vec3): vec3 {
    const direction = vec3.subtract(vec3.create(), point, this.position)
    return vec3.length(direction) > 1e-9 ? vec3.normalize(direction, direction) : vec3.clone(this.heading)
  }
}
