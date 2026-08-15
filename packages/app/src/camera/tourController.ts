import { mat4, vec3 } from 'gl-matrix'
import { AU_KM, type BodyDefinition } from '../solarSystem/bodies'
import { entityWorldPosition, type SolarSystemEntity } from '../solarSystem/entities'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'
import { scaledBodyRadiusUnits } from '../solarSystem/sceneScale'

// Roughly how long a transit between two planets should take, used only to derive this leg's
// cruise speed (distance / this) when a new target is picked - not a hard timer. Actual leg
// duration varies with how the steering plays out.
const TARGET_TRANSIT_SECONDS = 20

// How many body-radii away the close flyby loop circles the planet at - scaled per-planet so
// Mercury and Jupiter both get a sensible framing rather than one fixed world-space radius.
const LOOP_RADIUS_MULTIPLIER = 8

// How long one full loop around the planet takes once the camera arrives.
const LOOP_DURATION_SECONDS = 6
const LOOP_ANGULAR_SPEED = (2 * Math.PI) / LOOP_DURATION_SECONDS

// Hard ceiling on how long the 'approach' phase is allowed to keep pursuing before the tour just
// gives up on this target and moves on - a safety net against ever appearing to freeze. Pursuit
// steering toward a live (slowly moving) aim point should always close the distance well within
// this, but this guarantees the tour can never appear stuck indefinitely even in an edge case
// (e.g. a very fast accelerated clock nudging the aim point as fast as the camera closes on it).
const MAX_APPROACH_SECONDS = 45

// How quickly heading turns to face its current aim point and speed eases toward its current
// target value during the 'approach' phase, both expressed as the fraction-of-remaining-gap-per-
// second used by smoothingFactor() below - framerate-independent exponential smoothing, same
// technique as CameraFollowController's FOLLOW_SMOOTHING_RATE. Kept gentle so the turn into a new
// heading (e.g. coming out of a loop toward the next planet) reads as banking flight, not a snap.
const HEADING_SMOOTHING_RATE = 0.8
const SPEED_SMOOTHING_RATE = 0.5

// How many seconds ahead of the camera's own motion the "look where you're going" point sits
// during the approach phase - keeps the camera's gaze anchored to something that moves
// continuously with the camera itself, rather than to a planet that can be swapped out instantly
// the moment a new target is picked (see the lookAt comment on update() for why that was the
// actual cause of the reported "jump cuts" - position and heading were already continuous, but
// staring straight at the target position snapped instantly to the new planet).
const LOOK_AHEAD_SECONDS = 3

// The gaze blends from "look ahead" toward "stare at the planet" as the camera closes in, fully
// locked on by the time it's this many loop-radii away - and is smoothed on top of that so even
// the moment of picking a new (suddenly very distant) target can't snap the view.
const LOOKAT_BLEND_START_RADII = 6
const LOOKAT_SMOOTHING_RATE = 2.5

// Floor under a leg's cruise speed so a very short hop (or the very first leg, which can start
// close to its target) doesn't compute an imperceptibly slow crawl.
const MIN_CRUISE_SPEED = 0.5


// The scene's real "up" is ECLIPTIC_NORTH (world Z), not world Y - see poleOrientation.ts and
// docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md, which migrated
// OrbitCamera off a hardcoded Y-up for the same reason. Using Y here (as this file originally did)
// put the tour's loop/lookAt basis 90 degrees off the rest of the scene's orientation, and let the
// camera's forward direction pass close enough to this "up" vector during normal flight (most
// orbital motion lies in the real X/Y ecliptic plane, which contains world Y) to make
// mat4.lookAt's internal cross product near-degenerate - producing the reported sudden view
// "jumps" on top of the 90-degree misorientation.
const WORLD_UP: vec3 = vec3.fromValues(...ECLIPTIC_NORTH)

// 'approach': pursuit-steering toward a point on the planet's loop circle, from far away - this is
// only ever chasing a *distant* aim point, which is numerically stable (see the loop-entry angle
// comment on pickNextTarget for why a *close* pursuit target caused the old "wobble and stay").
// 'loop': a deterministic circular pass around the planet - position is computed directly from an
// ever-increasing angle, so unlike pursuit it can never stall or lock into an orbit by accident.
type TourPhase = 'approach' | 'loop'

function smoothingFactor(rate: number, deltaSeconds: number): number {
  return 1 - Math.exp(-rate * deltaSeconds)
}

// Drives an endless, uninterrupted camera flight through the solar system: it dynamically picks
// the nearest not-recently-visited planet (by live position, not a fixed schedule), flies toward
// it, makes one close deterministic loop around it, then immediately continues toward the next
// pick - forever, without ever coming to rest or pausing at a waypoint. Mirrors the other camera
// classes' shape (own state, update()/getViewMatrix()) so it slots into the render loop the same
// way OrbitCamera/FlyCamera do.
export class TourController {
  active = false

  private readonly position: vec3 = vec3.create()
  private heading: vec3 = vec3.fromValues(0, 0, 1)
  private speed = 0
  private lookAt: [number, number, number] = [0, 0, 0]
  private phase: TourPhase = 'approach'
  private phaseElapsedSeconds = 0
  private loopAngle = 0
  private currentTarget: SolarSystemEntity | null = null
  // Planets visited in the current pass, in visit order - used to guarantee full coverage: once
  // every planet has been visited, this resets and a new pass begins. A short "last N" exclusion
  // window (the original approach) doesn't do this - greedy nearest-next with a small window
  // settles into circling whichever 2-3 planets are mutually closest (e.g. Mercury/Venus/Earth)
  // and never reaches the outer planets, since they're never the *nearest* remaining candidate
  // once a inner-planet cluster is treated as "revisitable."
  private visitedThisPass: string[] = []

  // This leg's direction/side/up basis, loop radius, and cruise speed - fixed once per target
  // (computed in pickNextTarget from the camera's position at that moment) and reused by every
  // frame's steering/loop calculations until the next target is picked.
  private legDirection: vec3 = vec3.fromValues(0, 0, 1)
  private legSide: vec3 = vec3.fromValues(1, 0, 0)
  private legUp: vec3 = vec3.fromValues(0, 1, 0)
  private loopRadius = 0
  private cruiseSpeed = MIN_CRUISE_SPEED

  constructor(private readonly planetEntities: SolarSystemEntity[]) {}

  start(startPosition: [number, number, number], T: number, daysSinceEpoch: number, scaleBlend: number): void {
    this.active = true
    vec3.set(this.position, startPosition[0], startPosition[1], startPosition[2])
    this.speed = 0
    this.visitedThisPass = []
    this.pickNextTarget(T, daysSinceEpoch, scaleBlend)
    this.heading = vec3.clone(this.legDirection)
    const initialLookAt = vec3.scaleAndAdd(vec3.create(), this.position, this.heading, 10)
    this.lookAt = [initialLookAt[0], initialLookAt[1], initialLookAt[2]]
  }

  stop(): void {
    this.active = false
  }

  getEyePosition(): [number, number, number] {
    return [this.position[0], this.position[1], this.position[2]]
  }

  getLookAt(): [number, number, number] {
    return this.lookAt
  }

  getViewMatrix(): mat4 {
    return mat4.lookAt(mat4.create(), this.position, this.lookAt, WORLD_UP)
  }

  update(deltaSeconds: number, T: number, daysSinceEpoch: number, scaleBlend: number): void {
    if (!this.active || !this.currentTarget) return
    const targetPosition = entityWorldPosition(this.currentTarget, T, daysSinceEpoch, scaleBlend)
    const target = this.toVec3(targetPosition)

    this.phaseElapsedSeconds += deltaSeconds

    if (this.phase === 'approach') {
      this.updateApproach(deltaSeconds, target)
      if (vec3.distance(this.position, target) <= this.loopRadius * 1.02) {
        this.enterPhase('loop')
      } else if (this.phaseElapsedSeconds >= MAX_APPROACH_SECONDS) {
        // Safety net - see MAX_APPROACH_SECONDS. Give up on this target rather than risk ever
        // looking frozen; picking the next one keeps the tour moving no matter what.
        this.pickNextTarget(T, daysSinceEpoch, scaleBlend)
      }
    } else {
      this.updateLoop(deltaSeconds, target)
      if (this.loopAngle >= 2 * Math.PI) {
        this.pickNextTarget(T, daysSinceEpoch, scaleBlend)
      }
    }

    this.updateLookAt(deltaSeconds, target)
  }

  private enterPhase(phase: TourPhase): void {
    this.phase = phase
    this.phaseElapsedSeconds = 0
    if (phase === 'loop') this.loopAngle = 0
  }

  // Blends the gaze between "look where you're going" (a point out along the camera's own,
  // already-continuous heading) and "stare at the planet" (once close enough to be worth looking
  // at, and always during the loop), then smooths that blended point on top - so switching to a
  // brand-new, far-away target can never snap the camera's facing direction the way directly
  // assigning lookAt = targetPosition did.
  private updateLookAt(deltaSeconds: number, target: vec3): void {
    const aheadDistance = Math.max(this.speed, this.cruiseSpeed) * LOOK_AHEAD_SECONDS
    const aheadPoint = vec3.scaleAndAdd(vec3.create(), this.position, this.heading, aheadDistance)

    let blend = 1
    if (this.phase === 'approach') {
      const distance = vec3.distance(this.position, target)
      const blendStart = this.loopRadius * LOOKAT_BLEND_START_RADII
      const span = Math.max(blendStart - this.loopRadius, 1e-6)
      const raw = Math.min(Math.max((blendStart - distance) / span, 0), 1)
      blend = raw * raw * (3 - 2 * raw)
    }

    const desired = vec3.lerp(vec3.create(), aheadPoint, target, blend)
    const current = this.toVec3(this.lookAt)
    const smoothed = vec3.lerp(vec3.create(), current, desired, smoothingFactor(LOOKAT_SMOOTHING_RATE, deltaSeconds))
    this.lookAt = [smoothed[0], smoothed[1], smoothed[2]]
  }

  // Pursuit-steers toward the fixed point on the destination planet's loop circle (at loop angle
  // 0, along `legSide`) - always a *distant* aim point during this phase, which keeps the pursuit
  // numerically stable (see the TourPhase comment above).
  private updateApproach(deltaSeconds: number, target: vec3): void {
    const aimPoint = vec3.scaleAndAdd(vec3.create(), target, this.legSide, this.loopRadius)
    const desiredHeading = vec3.subtract(vec3.create(), aimPoint, this.position)
    if (vec3.length(desiredHeading) > 1e-6) {
      vec3.normalize(desiredHeading, desiredHeading)
      const blended = vec3.lerp(vec3.create(), this.heading, desiredHeading, smoothingFactor(HEADING_SMOOTHING_RATE, deltaSeconds))
      if (vec3.length(blended) > 1e-6) vec3.normalize(this.heading, blended)
    }
    this.speed += (this.cruiseSpeed - this.speed) * smoothingFactor(SPEED_SMOOTHING_RATE, deltaSeconds)
    vec3.scaleAndAdd(this.position, this.position, this.heading, this.speed * deltaSeconds)
  }

  // Deterministic single loop around the planet in the legSide/legUp plane, centered on its live
  // (moving) position. Because position is a direct function of a monotonically increasing angle
  // rather than a velocity integrated toward a moving aim point, this phase can never stall,
  // wobble, or lock into an accidental orbit - it always completes after LOOP_DURATION_SECONDS.
  // Also keeps `heading`/`speed` following the loop's own tangent, so the moment it hands back to
  // 'approach' for the next target, that phase's pursuit-steering picks up a heading that already
  // matches the camera's actual motion - no snap.
  private updateLoop(deltaSeconds: number, target: vec3): void {
    this.loopAngle = Math.min(this.loopAngle + LOOP_ANGULAR_SPEED * deltaSeconds, 2 * Math.PI)
    const cos = Math.cos(this.loopAngle)
    const sin = Math.sin(this.loopAngle)
    const radial = vec3.create()
    vec3.scaleAndAdd(radial, radial, this.legSide, cos)
    vec3.scaleAndAdd(radial, radial, this.legUp, sin)
    vec3.scaleAndAdd(this.position, target, radial, this.loopRadius)

    const tangent = vec3.create()
    vec3.scaleAndAdd(tangent, tangent, this.legSide, -sin)
    vec3.scaleAndAdd(tangent, tangent, this.legUp, cos)
    vec3.normalize(this.heading, tangent)
    this.speed = this.loopRadius * LOOP_ANGULAR_SPEED
  }

  private pickNextTarget(T: number, daysSinceEpoch: number, scaleBlend: number): void {
    // Once every planet has been visited, start a new pass - but keep the planet just finished
    // excluded for this one pick, since the camera is still right next to it and would otherwise
    // immediately be picked again as "nearest."
    if (this.visitedThisPass.length >= this.planetEntities.length) {
      this.visitedThisPass = this.currentTarget ? [this.currentTarget.id] : []
    }
    const candidates = this.planetEntities.filter((planet) => !this.visitedThisPass.includes(planet.id))
    let nearest: SolarSystemEntity | null = null
    let nearestPosition: [number, number, number] = [0, 0, 0]
    let nearestDistance = Infinity
    for (const candidate of candidates) {
      const candidatePosition = entityWorldPosition(candidate, T, daysSinceEpoch, scaleBlend)
      const distance = vec3.distance(this.position, this.toVec3(candidatePosition))
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = candidate
        nearestPosition = candidatePosition
      }
    }
    this.currentTarget = nearest ?? this.planetEntities[0]
    this.visitedThisPass.push(this.currentTarget.id)
    this.enterPhase('approach')
    this.computeLegBasis(nearestPosition, nearestDistance, scaleBlend)
  }

  // Locks in this leg's direction/side/up basis, loop radius, and cruise speed from wherever the
  // camera is right now toward the newly picked target's position right now - see the field
  // comments above for why this must happen once per target rather than every frame.
  private computeLegBasis(targetPosition: [number, number, number], distanceToTarget: number, scaleBlend: number): void {
    const target = this.toVec3(targetPosition)
    let direction = vec3.subtract(vec3.create(), target, this.position)
    if (vec3.length(direction) < 1e-6) direction = vec3.fromValues(0, 0, 1)
    vec3.normalize(direction, direction)

    let side = vec3.cross(vec3.create(), direction, WORLD_UP)
    if (vec3.length(side) < 1e-6) side = vec3.cross(vec3.create(), direction, [1, 0, 0])
    vec3.normalize(side, side)
    const up = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), side, direction))

    this.legDirection = direction
    this.legSide = side
    this.legUp = up

    const definition = this.currentTarget!.definition as BodyDefinition
    const bodyRadius = scaledBodyRadiusUnits(definition.radiusKm, definition.compactVisualRadius, scaleBlend, AU_KM)
    this.loopRadius = bodyRadius * LOOP_RADIUS_MULTIPLIER
    this.cruiseSpeed = Math.max(distanceToTarget / TARGET_TRANSIT_SECONDS, MIN_CRUISE_SPEED)
  }

  private toVec3(p: readonly [number, number, number]): vec3 {
    return vec3.fromValues(p[0], p[1], p[2])
  }
}
