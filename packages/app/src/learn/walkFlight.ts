import { vec3, type ReadonlyVec3 } from 'gl-matrix'
import type { OrbitCamera } from '../camera/orbitCamera'
import { EasedTween } from '../math/easedTween'
import type { Vec3 } from '../math/tuples'

// A flight into a room along a path (Columbia: up to the side hatch, through it, then turning to
// lie as the crew lay): the eye moves through the given points at an even pace, eased at both
// ends, looking where it goes; the top of the view turns toward the last pose's only on the last
// stretch. Driven through the walking camera (OrbitCamera.lookFrom).

export interface Pose {
  eye: Vec3
  ahead: Vec3
  head: Vec3
}

// How fast the flight goes on average (metres per second), and how long it takes at least.
const METRES_PER_SECOND = 1.6
const MIN_SECONDS = 2.5

export function poseOf(orbit: OrbitCamera): Pose {
  const eye = orbit.getEyePosition()
  const ahead = orbit.forward()
  const head = orbit.screenAxes().up
  return { eye: [eye[0], eye[1], eye[2]], ahead: [ahead[0], ahead[1], ahead[2]], head: [head[0], head[1], head[2]] }
}

// Where a flight into a room starts, and the path it takes.
export interface Entry {
  from: Pose
  through: Vec3[]
}

// Coming in from outside (not yet walking), a room with a path in is entered along it (see
// LessonShot.walk); otherwise null.
export function entryFrom(orbit: OrbitCamera, through: Vec3[] | undefined): Entry | null {
  return through && !orbit.walk ? { from: poseOf(orbit), through } : null
}

export class WalkFlight {
  private readonly poses: Pose[]
  private readonly at: number[]
  private readonly progress: EasedTween

  // From `from` through the points (each looking on to the next) to `to`.
  constructor(from: Pose, through: readonly Vec3[], to: Pose) {
    const eyes = [from.eye, ...through, to.eye]
    this.poses = eyes.map((eye, index): Pose => {
      if (index === 0) return from
      if (index === eyes.length - 1) return to
      return { eye, ahead: direction(eye, eyes[index + 1]), head: from.head }
    })
    const lengths = eyes.slice(1).map((eye, index) => vec3.distance(eye, eyes[index]))
    const total = lengths.reduce((sum, length) => sum + length, 0) || 1
    let sum = 0
    this.at = [0, ...lengths.map((length) => (sum += length) / total)]
    this.progress = new EasedTween(0, Math.max(MIN_SECONDS, total / METRES_PER_SECOND))
    this.progress.retarget(1, 0)
  }

  // Moves the camera along; false once it has arrived.
  update(deltaSeconds: number, orbit: OrbitCamera): boolean {
    const t = this.progress.update(deltaSeconds)
    const leg = Math.max(0, this.at.findIndex((end) => end >= t) - 1)
    const [a, b] = [this.poses[leg], this.poses[leg + 1] ?? this.poses[leg]]
    const share = Math.min(1, Math.max(0, (t - this.at[leg]) / ((this.at[leg + 1] ?? 1) - this.at[leg] || 1)))
    const eye = vec3.lerp(vec3.create(), a.eye, b.eye, share)
    vec3.copy(orbit.target, eye)
    orbit.clearPan()
    orbit.lookFrom(eye, blend(a.ahead, b.ahead, share), blend(a.head, b.head, share))
    return this.progress.isAnimating
  }
}

function direction(from: ReadonlyVec3, to: ReadonlyVec3): Vec3 {
  const d = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), to, from))
  return [d[0], d[1], d[2]]
}

function blend(a: ReadonlyVec3, b: ReadonlyVec3, share: number): Vec3 {
  const mixed = vec3.lerp(vec3.create(), a, b, share)
  if (vec3.length(mixed) < 1e-6) return [b[0], b[1], b[2]]
  vec3.normalize(mixed, mixed)
  return [mixed[0], mixed[1], mixed[2]]
}
