import { mat4, vec3 } from 'gl-matrix'
import { smoothstep } from '../math/easing'
import type { SolarSystemEntity } from '../solarSystem/entities'
import { rescaledPosition } from '../solarSystem/sceneScale'
import type { Ephemeris } from '../time/ephemeris'
import { InertialDirection } from './tour/inertialDirection'
import { SPEED_LAG_SECONDS, SPEED_SETTLE_SECONDS, stepToward, Throttle, turnRateAround } from './tour/shipMotion'
import { MAX_GAZE_TURN_RATE, ShipView, WORLD_UP } from './tour/shipView'
import { ACCELERATION_SECONDS, engineAcceleration, loopRadiusAt, MIN_CRUISE_SPEED, planetPosition, planLeg, WARP, type Leg, type LegPace } from './tour/tourLeg'
import { arrivalSeconds, motionHandover } from './tour/warpFlight'
import { mayLeaveLoop } from './tour/loopExit'
import { NearestItinerary, type TourItinerary } from './tour/tourItinerary'

export { ACCELERATION_SECONDS } from './tour/tourLeg'

// The ship turns like a heavy body: its turn rate builds up and dies down within TURN_ACCELERATION.
// Its lateral thrust, relative to its forward thrust, limits how fast it can turn at speed (a slow
// ship turns quickly, a fast one in wide arcs) - and never faster than MAX_TURN_RATE.
const LATERAL_THRUST_RATIO = 2
export const MAX_TURN_RATE = 0.9 // radians per second
const TURN_ACCELERATION = 0.6 // radians per second squared

// Braking is planned with this share of the engine's thrust, leaving room for the thrust to build
// up, and starts early enough for the speed's lag behind the throttle. Leaving a stop the ship
// speeds up in proportion to its distance from it, and on the approach slows in proportion to the
// distance left, at the leg's log rate (see planLeg) - with the throttle led by the slowdown that
// profile is about to ask for, so the lagging speed follows it instead of overshooting the loop.
const BRAKING_SHARE = 0.6

// Gives up on a target that takes this long to reach (or this many times its planned transit), so
// the tour can never appear stuck.
const MAX_CRUISE_SECONDS = 60
const MAX_CRUISE_TRANSITS = 3

// The gaze looks this far ahead along the flight path, and swings over to the planet as the ship
// closes in - fully locked on from this many loop radii away.
const LOOK_AHEAD_SECONDS = 3
export const GAZE_LOCK_IN_LOOP_RADII = 6

// Leaving a planet, the ship circles on until it heads for the next one (see loopExit). The gaze
// lets go of the planet gradually: over DEPARTURE_SECONDS it eases from where it looked
// when the ship left (the planet) over to where it would look anyway, and the turn rates of ship and
// gaze build up from these shares of their full rates.
export const DEPARTURE_SECONDS = 10
const DEPARTURE_TURN_SHARE = 0.15
const DEPARTURE_GAZE_SHARE = 0.25

interface Loop {
  startOffset: vec3
  direction: number
  angle: number
  angularSpeed: number
  // The next stop, once the lap is done and the ship may leave: it leaves when it heads for it.
  next?: SolarSystemEntity
}

interface Departure {
  // Where the gaze looked as the ship left the loop.
  gaze: vec3
  seconds: number
}

interface Body {
  position: vec3
  velocity: vec3
  loopRadius: number
}

interface Moment {
  ephemeris: Ephemeris
  scaleBlend: number
}

export interface TourStart {
  position: readonly [number, number, number]
  forward?: readonly [number, number, number]
}

// What the narrated tour tells the ship: how long it should take at a body, and when it may leave.
export interface TourPacing {
  pace(target: SolarSystemEntity): LegPace
  // While false, the ship keeps circling the body (the narrator hasn't finished).
  mayDepart(target: SolarSystemEntity): boolean
}

export interface TourListener {
  onLegStart?(target: SolarSystemEntity): void
  // The ship is about its leg's transit time (see TourPacing) from the stop - at once on the first
  // leg, and at the latest on arrival. The narrator's words for the stop end as the ship gets there.
  onApproach?(target: SolarSystemEntity): void
  onLoopEnter?(target: SolarSystemEntity): void
  // The route is over: the ship stays circling its last stop.
  onFinished?(): void
}

// Where the tour goes: the endless nearest-planet loop by default, or a set route with its pace.
export interface TourRoute {
  itinerary: TourItinerary
  pacing?: TourPacing
  listener?: TourListener
}

// A sightseeing flight, flown like a spaceship: it picks the next body of its route, accelerates
// toward it, brakes on arrival, makes a lap around it and heads for the next one - with inertia,
// elastic thrust, a limited turn rate, banking into turns and a gaze that leads the flight path.
// It navigates relative to its target, matching the target's own orbital motion, so it reaches even
// a fast inner planet at Realistic scale.
export class TourController {
  private readonly position = vec3.create()
  private readonly steering = new InertialDirection(vec3.fromValues(0, 0, 1), { maxRate: MAX_TURN_RATE, acceleration: TURN_ACCELERATION }, WORLD_UP)
  private readonly throttle = new Throttle()
  // The target planet's velocity, as far as the ship has matched it yet.
  private readonly frameVelocity = vec3.create()
  private readonly view = new ShipView()
  private readonly defaultRoute: TourRoute
  private route: TourRoute
  private leg: Leg | null = null
  private loop: Loop | null = null
  private departure: Departure | null = null
  private finished = false
  // Whether onApproach was sent for this leg.
  private announced = false
  private cruiseSeconds = 0
  private previous: Moment | null = null

  constructor(planets: SolarSystemEntity[]) {
    this.defaultRoute = { itinerary: new NearestItinerary(planets) }
    this.route = this.defaultRoute
  }

  private get heading(): vec3 {
    return this.steering.direction
  }

  private get speed(): number {
    return this.throttle.speed
  }

  // Starts at rest where the camera is, looking where it looked.
  start(from: TourStart, ephemeris: Ephemeris, scaleBlend: number, route: TourRoute = this.defaultRoute): void {
    vec3.set(this.position, ...from.position)
    this.throttle.stop()
    vec3.zero(this.frameVelocity)
    this.previous = { ephemeris, scaleBlend }
    this.route = route
    this.finished = false
    route.itinerary.restart()
    this.beginLeg(null, this.nextStop(null, this.previous), this.previous)
    if (!this.leg) return
    const forward = from.forward ? vec3.fromValues(...from.forward) : null
    const planet = planetPosition(this.leg.target, ephemeris, scaleBlend)
    this.steering.reset(forward && vec3.length(forward) > 1e-9 ? vec3.normalize(forward, forward) : this.directionTo(planet))
    this.view.reset(this.heading)
  }

  stop(): void {
    this.leg = null
    this.loop = null
    this.departure = null
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
    const moment = { ephemeris, scaleBlend }
    if (this.previous && this.previous.scaleBlend !== scaleBlend) this.followScaleChange(this.leg, this.previous, scaleBlend)
    const planet = planetPosition(this.leg.target, ephemeris, scaleBlend)
    const planetVelocity = this.planetVelocity(this.leg.target, moment, deltaSeconds)
    const headingBefore = vec3.clone(this.heading)
    this.advanceDeparture(deltaSeconds)
    if (this.loop) this.flyLoop(this.loop, deltaSeconds, { planet, planetVelocity })
    else this.cruise(this.leg, deltaSeconds, { planet, planetVelocity, left: this.leftBehind(this.leg, moment, deltaSeconds) })
    const yawRate = turnRateAround(headingBefore, this.heading, WORLD_UP, deltaSeconds)
    const gazeRate = MAX_GAZE_TURN_RATE * this.departureRamp(DEPARTURE_GAZE_SHARE)
    this.view.update(deltaSeconds, this.desiredGaze(this.leg, planet), { heading: this.heading, yawRate }, gazeRate)
    this.previous = moment
    this.continueItinerary(this.leg, planet, moment)
  }

  private continueItinerary(leg: Leg, planet: vec3, moment: Moment): void {
    if (this.loop) {
      if (this.readyToLeave(this.loop, leg)) this.leaveLoopTowardNext(this.loop, leg, moment)
    } else if (vec3.distance(this.position, planet) <= leg.loopRadius * 1.02) {
      this.loop = this.enterLoop(leg, planet)
      this.announce(leg)
      this.route.listener?.onLoopEnter?.(leg.target)
    } else if (this.cruiseSeconds >= this.patienceSeconds(leg)) {
      this.beginLeg(leg.target, this.nextStop(leg.target, moment), moment)
    }
  }

  private announce(leg: Leg): void {
    if (!this.announced) this.route.listener?.onApproach?.(leg.target)
    this.announced = true
  }

  // How many times the log rate the ship pulls away at: rising to WARP once clear of the stop.
  private warp(): number {
    return 1 + (WARP - 1) * smoothstep(this.cruiseSeconds / DEPARTURE_SECONDS)
  }

  private patienceSeconds(leg: Leg): number {
    return Math.max(MAX_CRUISE_SECONDS, MAX_CRUISE_TRANSITS * this.paceOf(leg.target).transitSeconds)
  }

  // Picks the next stop once, then circles on until it may leave for it (see mayLeaveLoop). Without
  // one the route is over, and the ship stays circling.
  private leaveLoopTowardNext(loop: Loop, leg: Leg, moment: Moment): void {
    loop.next ??= this.nextStop(leg.target, moment) ?? undefined
    if (!loop.next) return this.finish()
    const next = planetPosition(loop.next, moment.ephemeris, moment.scaleBlend)
    const center = planetPosition(leg.target, moment.ephemeris, moment.scaleBlend)
    if (mayLeaveLoop(loop, { heading: this.heading, position: this.position, center, next })) this.beginLeg(leg.target, loop.next, moment)
  }

  // A lap done, the route not over, and the narrator done with this stop.
  private readyToLeave(loop: Loop, leg: Leg): boolean {
    return loop.angle >= 2 * Math.PI && !this.finished && (this.route.pacing?.mayDepart(leg.target) ?? true)
  }

  private paceOf(target: SolarSystemEntity): LegPace {
    return this.route.pacing?.pace(target) ?? { transitSeconds: 0, lapSeconds: 0 }
  }

  // The planet's own orbital motion, at the current scale (so a scale change in progress doesn't
  // count as motion).
  private planetVelocity(body: SolarSystemEntity, now: Moment, deltaSeconds: number): vec3 {
    if (!this.previous || deltaSeconds <= 0) return vec3.create()
    const before = planetPosition(body, this.previous.ephemeris, now.scaleBlend)
    const after = planetPosition(body, now.ephemeris, now.scaleBlend)
    return vec3.scale(after, vec3.subtract(after, after, before), 1 / deltaSeconds)
  }

  // Where the stop the ship is leaving is now, and how it moves.
  private leftBehind(leg: Leg, now: Moment, deltaSeconds: number): Body | null {
    if (!leg.from) return null
    return { position: planetPosition(leg.from, now.ephemeris, now.scaleBlend), velocity: this.planetVelocity(leg.from, now, deltaSeconds), loopRadius: loopRadiusAt(leg.from, now.scaleBlend) }
  }

  // Seek-and-arrive toward the loop's entry point, relative to the planet: match its motion, turn
  // at the rate the ship's thrust allows, ease off while pointing away from the target, and brake
  // in time to arrive at loop speed.
  private cruise(leg: Leg, deltaSeconds: number, { planet, planetVelocity, left }: { planet: vec3; planetVelocity: vec3; left: Body | null }): void {
    this.cruiseSeconds += deltaSeconds
    const toEntry = vec3.subtract(vec3.create(), vec3.scaleAndAdd(vec3.create(), planet, leg.side, leg.loopRadius), this.position)
    const distance = vec3.length(toEntry)
    const fromLeft = left ? vec3.distance(this.position, left.position) : Infinity
    this.matchPlanetMotion(leg, left ? this.handedOverVelocity(left, fromLeft, { leg, distance, planetVelocity }) : planetVelocity, deltaSeconds)
    if (distance > 1e-9) this.steerToward(leg, vec3.scale(toEntry, toEntry, 1 / distance), { distance, fromLeft, deltaSeconds })
    if (arrivalSeconds(leg, { distance, fromLeft, warp: (this.warp() + WARP) / 2 }) <= this.paceOf(leg.target).transitSeconds) this.announce(leg)
    vec3.scaleAndAdd(this.position, this.position, this.heading, this.speed * deltaSeconds)
    vec3.scaleAndAdd(this.position, this.position, this.frameVelocity, deltaSeconds)
  }

  // Pulling away, the ship moves on with the stop it left, and takes up the next one's motion on the
  // way (see motionHandover) - so a fast inner planet, at Realistic scale, doesn't rush off on its
  // orbit the moment the ship lets go of it.
  private handedOverVelocity(left: Body, fromLeft: number, { leg, distance, planetVelocity }: { leg: Leg; distance: number; planetVelocity: vec3 }): vec3 {
    const share = motionHandover(leg, { fromLeft, leftLoopRadius: left.loopRadius, distance })
    return vec3.lerp(vec3.create(), left.velocity, planetVelocity, share)
  }

  // Matches the planet's velocity within the engine's limits - which also shrugs off the one-frame
  // leap of a jump in the simulated time.
  private matchPlanetMotion(leg: Leg, planetVelocity: vec3, deltaSeconds: number): void {
    const change = vec3.subtract(vec3.create(), planetVelocity, this.frameVelocity)
    const maxChange = engineAcceleration(leg) * deltaSeconds
    if (vec3.length(change) > maxChange) vec3.scale(change, change, maxChange / vec3.length(change))
    vec3.add(this.frameVelocity, this.frameVelocity, change)
  }

  private steerToward(leg: Leg, direction: vec3, { distance, fromLeft, deltaSeconds }: { distance: number; fromLeft: number; deltaSeconds: number }): void {
    const acceleration = engineAcceleration(leg)
    const thrustLimitedRate = (LATERAL_THRUST_RATIO * leg.turnAcceleration) / Math.max(this.speed, 1e-9)
    this.steering.turnToward(direction, deltaSeconds, Math.min(MAX_TURN_RATE, thrustLimitedRate) * this.departureRamp(DEPARTURE_TURN_SHARE))
    const alignment = (1 + vec3.dot(this.heading, direction)) / 2
    const loopSpeed = leg.loopRadius * leg.loopAngularSpeed
    const brakingDistance = Math.max(distance - this.speed * SPEED_LAG_SECONDS, 0)
    const brakingSpeed = Math.sqrt(loopSpeed * loopSpeed + 2 * BRAKING_SHARE * acceleration * brakingDistance)
    const approachSpeed = loopSpeed + leg.logRate * (distance - SPEED_SETTLE_SECONDS * this.speed)
    const departingSpeed = leg.startSpeed + this.warp() * leg.logRate * fromLeft
    this.throttle.update(Math.min(leg.cruiseSpeed, brakingSpeed, approachSpeed, departingSpeed) * alignment, { acceleration }, deltaSeconds)
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

  // The loop's pace changes within the same engine limits as the cruise; the ship moves with the
  // planet all the while (and with it through a jump in time). It keeps circling past one lap
  // while the route holds it there, and for good at the route's end.
  private flyLoop(loop: Loop, deltaSeconds: number, { planet, planetVelocity }: { planet: vec3; planetVelocity: vec3 }): void {
    const leg = this.leg!
    this.matchPlanetMotion(leg, planetVelocity, deltaSeconds)
    const circleRadius = Math.max(Math.hypot(loop.startOffset[0], loop.startOffset[1]), 1e-9)
    const acceleration = engineAcceleration(leg)
    loop.angularSpeed = stepToward(loop.angularSpeed, leg.loopAngularSpeed, (acceleration / circleRadius) * deltaSeconds)
    loop.angle += loop.angularSpeed * deltaSeconds
    const rotation = mat4.fromRotation(mat4.create(), loop.direction * loop.angle, WORLD_UP)
    const offset = vec3.transformMat4(vec3.create(), loop.startOffset, rotation)
    vec3.add(this.position, planet, offset)
    const tangent = vec3.scale(vec3.create(), vec3.cross(vec3.create(), WORLD_UP, offset), loop.direction)
    this.steering.follow(vec3.normalize(tangent, tangent), deltaSeconds)
    this.throttle.coast(circleRadius * loop.angularSpeed)
  }

  private advanceDeparture(deltaSeconds: number): void {
    if (!this.departure) return
    this.departure.seconds += deltaSeconds
    if (this.departure.seconds >= DEPARTURE_SECONDS) this.departure = null
  }

  // 1 outside a departure; during one, rising smoothly from `share` to 1.
  private departureRamp(share: number): number {
    return this.departure ? share + (1 - share) * smoothstep(this.departure.seconds / DEPARTURE_SECONDS) : 1
  }

  // The scale switch eases the whole scene from one scale to the other, and the ship moves with
  // it. Near its target - circling it, or close enough to have its eyes on it - it keeps its place
  // relative to the planet in planet radii, so the view of the planet stays the same. Farther out
  // it keeps its place in the solar system: the same direction and AU distance from the Sun. Either
  // way the leg's speeds follow the new distance to the target.
  private followScaleChange(leg: Leg, before: Moment, scaleBlend: number): void {
    const loopRadius = loopRadiusAt(leg.target, scaleBlend)
    const planetBefore = planetPosition(leg.target, before.ephemeris, before.scaleBlend)
    const planetAfter = planetPosition(leg.target, before.ephemeris, scaleBlend)
    const distanceBefore = vec3.distance(this.position, planetBefore)
    if (this.loop) {
      vec3.scale(this.loop.startOffset, this.loop.startOffset, loopRadius / leg.loopRadius)
    } else if (distanceBefore < leg.loopRadius * GAZE_LOCK_IN_LOOP_RADII) {
      const offset = vec3.scale(vec3.create(), vec3.subtract(vec3.create(), this.position, planetBefore), loopRadius / leg.loopRadius)
      vec3.add(this.position, planetAfter, offset)
    } else {
      vec3.set(this.position, ...rescaledPosition([this.position[0], this.position[1], this.position[2]], before.scaleBlend, scaleBlend))
    }
    if (!this.loop) this.rescaleLegSpeeds(leg, distanceBefore, vec3.distance(this.position, planetAfter))
    leg.loopRadius = loopRadius
  }

  private rescaleLegSpeeds(leg: Leg, distanceBefore: number, distanceAfter: number): void {
    const ratio = distanceBefore > 1e-12 ? distanceAfter / distanceBefore : 1
    leg.cruiseSpeed = Math.max(leg.cruiseSpeed * ratio, MIN_CRUISE_SPEED)
    leg.acceleration = Math.max(leg.acceleration * ratio, MIN_CRUISE_SPEED / ACCELERATION_SECONDS)
    this.throttle.coast(this.speed * ratio)
  }

  // Ahead along the flight path while far away, swinging over to the planet on the way in, and
  // fixed on it while circling. Leaving a planet, the gaze lingers on it and lets go gradually.
  private desiredGaze(leg: Leg, planet: vec3): vec3 {
    const aheadDistance = Math.max(this.speed, leg.cruiseSpeed) * LOOK_AHEAD_SECONDS
    const ahead = vec3.scaleAndAdd(vec3.create(), this.position, this.heading, aheadDistance)
    const lockStart = leg.loopRadius * GAZE_LOCK_IN_LOOP_RADII
    const closeness = (lockStart - vec3.distance(this.position, planet)) / Math.max(lockStart - leg.loopRadius, 1e-9)
    const planetWeight = this.loop ? 1 : smoothstep(closeness)
    const gaze = this.directionTo(vec3.lerp(vec3.create(), ahead, planet, planetWeight))
    if (!this.departure) return gaze
    // Not the departed planet's live position: it falls behind as the ship pulls away, which would
    // swing the gaze backward first and all the farther forward after.
    return vec3.normalize(gaze, vec3.slerp(gaze, this.departure.gaze, gaze, smoothstep(this.departure.seconds / DEPARTURE_SECONDS)))
  }

  private nextStop(justVisited: SolarSystemEntity | null, moment: Moment): SolarSystemEntity | null {
    const positionOf = (planet: SolarSystemEntity) => planetPosition(planet, moment.ephemeris, moment.scaleBlend)
    return this.route.itinerary.next(this.position, positionOf, justVisited)
  }

  // On to the next stop - or, at the route's end, on circling the last one.
  private beginLeg(justVisited: SolarSystemEntity | null, target: SolarSystemEntity | null, moment: Moment): void {
    if (!target) return this.finish()
    // Only a planet the ship circled is one to pull away from (not one it gave up on reaching).
    const from = justVisited && this.loop ? justVisited : null
    this.departure = from ? { gaze: vec3.clone(this.view.gaze), seconds: 0 } : null
    this.leg = planLeg(target, this.position, moment, { pace: this.paceOf(target), startSpeed: this.speed, from })
    this.loop = null
    this.cruiseSeconds = 0
    this.announced = false
    this.route.listener?.onLegStart?.(target)
    if (!from) this.announce(this.leg)
  }

  private finish(): void {
    this.finished = true
    this.route.listener?.onFinished?.()
  }

  private directionTo(point: vec3): vec3 {
    const direction = vec3.subtract(vec3.create(), point, this.position)
    return vec3.length(direction) > 1e-9 ? vec3.normalize(direction, direction) : vec3.clone(this.heading)
  }
}
