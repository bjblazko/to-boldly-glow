import type { Vec3 } from '../../math/tuples'
import type { Apollo11Scene, Craft } from './apollo11Scene'
import type { Framing } from './chaseShot'
import { craftAt } from './craftChoreography'
import { craftTurns } from './craftTurns'
import { shotAt } from './director'
import { flipShot, frame, type ShotContext, type ShotSpec } from './shots'
import { STATION_SHOTS } from './stationShots'

// The tour's camera at a moment: the director's shot for the station, framed on its craft. The
// scene is centred on that craft first (its floating origin).

export interface TourCamera {
  framing: Framing
  // Changes at a cut.
  shotKey: string
  subject: Craft
}

// How big each craft is (m), for a shot's share of the picture: the stack in Earth orbit, Columbia
// with Eagle docked, Columbia, Eagle.
// And its middle (m, model frame: the stack hangs the third stage below Columbia, Eagle docked
// sits above its nose).
function sizeOf(scene: Apollo11Scene, subject: Craft): { size: number; centre: Vec3 } {
  if (subject === 'eagle') return { size: 8, centre: [0, 3.5, 0] }
  const cast = craftAt(scene.get).columbia.map((actor) => actor.model)
  if (cast.includes('saturnV')) return { size: 35, centre: [0, -12, 0] }
  return cast.includes('lm') ? { size: 20, centre: [0, 9, 0] } : { size: 11, centre: [0, 5, 0] }
}

// A shot keeps the directions it started with - along the craft's way and up - for as long as it
// runs: in sped-up time an orbit turns those round in seconds, and a camera tied to them would
// whirl the stars round the picture. Kept between frames by the tour.
export interface ShotMemory {
  key: string
  velocity: Vec3
  up: Vec3
  // Which side of the craft it stands on (shots.ts's flipShot), and whether it goes round with the
  // orbit.
  flipped: boolean
  follows: boolean
}

export function tourCamera(scene: Apollo11Scene, at: { stationId: string; stationSeconds: number; get: number; take?: number; inOrbit?: boolean }, memory: { shot: ShotMemory | null; groundAt?: ShotContext['groundAt'] }): TourCamera | null {
  const shot = shotAt(at.stationId, at.stationSeconds, at.get)
  // A jump in mission time between takes is a cut, as a new shot is.
  const running = { ...shot, key: `${shot.key}/${at.take ?? 0}` }
  const subject: Craft = running.shot.subject ?? STATION_SHOTS[at.stationId].focus
  scene.setMoment(at.get, subject)
  const found = shotContext(scene, subject, running.seconds)
  if (!found) return null
  const context = { ...found, groundAt: memory.groundAt }
  // In orbit the camera goes round with it, as the craft does (the ground stays put below); on the
  // way between Earth and the Moon, and nearly at rest (on the ground, touching down), it keeps the
  // directions the shot started with. Decided at the cut, with the side it stands on.
  if (memory.shot?.key !== running.key) memory.shot = rememberShot(running, context, at.inOrbit === true)
  const kept = { ...context, flipped: memory.shot.flipped }
  const steady = memory.shot.follows ? kept : { ...kept, velocity: memory.shot.velocity, up: memory.shot.up }
  return { framing: frame(running.shot.spec, steady), shotKey: running.key, subject }
}

// What a shot keeps from its start: the directions, its side, and whether it goes round with the
// orbit - in an orbit station, low over the body, and moving (not nearly at rest, touching down).
function rememberShot(running: { key: string; shot: { spec: ShotSpec } }, context: ShotContext, orbitStation: boolean): ShotMemory {
  const follows = orbitStation && Math.hypot(...context.velocity) > 0.05 && inOrbitAt(context)
  return { key: running.key, velocity: context.velocity, up: context.up, flipped: flipShot(running.shot.spec, context), follows }
}

const ORBIT_KM = 3000
// Whether the shot's craft is in orbit (low over its body).
function inOrbitAt(context: ShotContext): boolean {
  const earth = Math.hypot(...context.earthKm.map((v, k) => v - context.subjectKm[k])) - 6378
  const moon = Math.hypot(...context.moonKm.map((v, k) => v - context.subjectKm[k])) - 1737.4
  return Math.min(earth, moon) < ORBIT_KM
}

function shotContext(scene: Apollo11Scene, subject: Craft, seconds: number): ShotContext | null {
  const [subjectKm, motion] = [scene.craftKm(subject), scene.motion(subject)]
  if (!subjectKm || !motion) return null
  const other: Craft = subject === 'eagle' ? 'columbia' : 'eagle'
  const turns = craftTurns(scene, craftAt(scene.get))
  const siteKm = scene.siteKm()
  return {
    seconds,
    subjectKm,
    turn: turns[subject] ?? turns.columbia!,
    velocity: motion.velocity,
    up: motion.up,
    ...sizeOf(scene, subject),
    earthKm: scene.earthKm(),
    moonKm: scene.moonKm(),
    toSun: scene.toSun,
    otherKm: scene.craftKm(other),
    otherTurn: turns[other],
    // Before the landing the ground camera stands at the site itself (where Eagle will land).
    siteKm: siteKm ?? scene.siteNowKm(),
    siteUp: siteKm ? scene.moonUpAt(siteKm) : scene.moonUpAt(subjectKm),
  }
}
