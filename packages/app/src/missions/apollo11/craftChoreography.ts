import type { Vec3 } from '../../math/tuples'
import { DOCKED_LM_Y, LM_DESCENT_PARTS, pose, posesAt, type ActorPose } from '../../learn/apolloRoute/closeupChoreography'

// Which craft fly at a mission time and how they are put together, with the Apollo 11 lesson's
// models and close-up poses (learn/apolloRoute/closeupChoreography.ts) laid on the real timeline:
// the stack in Earth orbit, transposition and docking, the third stage falling behind, Eagle's legs
// unfolding and the undocking, Eagle on its own, the descent stage left on the site, the docking
// after the rendezvous, the ascent stage cast off, the command module alone at entry. Times from
// apollo11Events.ts; the in-between moves (how long the turnaround took, when the legs came out)
// APPROX.

const T = (hours: number, minutes: number, seconds = 0) => hours * 3600 + minutes * 60 + seconds

const SEPARATION = T(3, 15, 23)
const EXTRACTED = T(4, 17, 40)
// The third stage drops back after the extraction (its evasive manoeuvre at 4:40 took it further).
const SIVB_DRIFT_METRES_PER_SECOND = 0.4
const SIVB_GONE = T(5, 0)
const UNDOCKING = T(100, 12)
const CSM_SEPARATION = T(100, 39, 52.9)
const OWN_WAY = CSM_SEPARATION + 300
const LIFTOFF = T(124, 22, 0.79)
const STATIONKEEPING = T(127, 52, 5.3)
const DOCKED = T(128, 3)
const JETTISON = T(130, 9, 31.2)
const CM_SM_SEPARATION = T(194, 49, 12.7)

export interface EagleCast {
  pose: ActorPose
  // 'columbia': posed in Columbia's frame (close by it: undocking, the last approach) at Eagle's
  // own place; 'own': in its own attitude.
  frame: 'columbia' | 'own'
}

export interface CraftCast {
  // Drawn at Columbia's place, in Columbia's frame (+Y its nose).
  columbia: ActorPose[]
  eagle: EagleCast | null
  // The descent stage, left on Tranquility Base.
  site: ActorPose | null
}

// A close-up's own seconds at a mission time, piecewise linear between (GET, seconds) knots.
function along(knots: [number, number][], get: number): number {
  if (get <= knots[0][0]) return knots[0][1]
  const i = knots.findIndex(([time]) => time >= get)
  if (i < 0) return knots[knots.length - 1][1]
  const [[t0, s0], [t1, s1]] = [knots[i - 1], knots[i]]
  return s0 + ((s1 - s0) * (get - t0)) / (t1 - t0)
}

const smooth = (get: number, from: number, to: number) => {
  const u = Math.min(Math.max((get - from) / (to - from), 0), 1)
  return u * u * (3 - 2 * u)
}

const TRANSPOSITION: [number, number][] = [[SEPARATION, 0], [T(3, 17), 4], [T(3, 20), 7.5], [T(3, 24, 3.7), 11], [T(4, 17, 3), 11], [EXTRACTED, 15]]
const ENTRY: [number, number][] = [[CM_SM_SEPARATION, 0], [T(194, 49, 40), 5], [T(194, 50, 30), 6.5], [T(194, 51), 7], [T(194, 52), 11]]
// Eagle's legs come out before the undocking; it backs off and turns round once for Collins.
const UNDOCKING_PLAY: [number, number][] = [[T(99, 55), 0], [T(100, 5), 3.5], [UNDOCKING, 3.5], [T(100, 12, 40), 8], [T(100, 13), 8], [T(100, 20), 14]]

const ASCENT_ONLY = { ...Object.fromEntries(LM_DESCENT_PARTS.map((part) => [part, 0])), person: 0 }
const DOCKED_LM = pose('lm', { translation: [0, DOCKED_LM_Y, 0], rotation: { x: Math.PI, y: 0 }, visibility: ASCENT_ONLY })

function earthToMoon(get: number): CraftCast {
  const cast = posesAt('transposition', along(TRANSPOSITION, get))
  if (get < EXTRACTED) return { columbia: cast, eagle: null, site: null }
  const [sivb, lm, csm] = cast
  if (get >= SIVB_GONE) return { columbia: [lm, csm], eagle: null, site: null }
  const drift = SIVB_DRIFT_METRES_PER_SECOND * (get - EXTRACTED)
  const away: Vec3 = [sivb.translation[0], sivb.translation[1] - drift, sivb.translation[2]]
  return { columbia: [{ ...sivb, translation: away }, lm, csm], eagle: null, site: null }
}

// Docked in lunar orbit, legs coming out; then Eagle off on its own beside Columbia.
function undocking(get: number): CraftCast {
  const [csm, lm] = posesAt('undocking', along(UNDOCKING_PLAY, get))
  if (get < UNDOCKING) return { columbia: [{ ...lm, translation: [0, DOCKED_LM_Y, 0] }, csm], eagle: null, site: null }
  const fading = 1 - smooth(get, CSM_SEPARATION, OWN_WAY)
  const translation = lm.translation.map((value) => value * fading) as Vec3
  return { columbia: [csm], eagle: { pose: { ...lm, translation, fold: 0 }, frame: 'columbia' }, site: null }
}

function onItsOwn(get: number): CraftCast {
  const lifted = get >= LIFTOFF
  const site = lifted ? pose('lm', { visibility: { person: 0, ascent: 0, ascentInside: 0 } }) : null
  if (get < STATIONKEEPING) return { columbia: [pose('csm', {})], eagle: { pose: pose('lm', { visibility: lifted ? ASCENT_ONLY : { person: 0 } }), frame: 'own' }, site }
  // The last approach: Eagle's place comes onto Columbia's nose as the two paths meet.
  const closing = { ...DOCKED_LM, translation: [0, DOCKED_LM_Y * smooth(get, STATIONKEEPING, DOCKED), 0] as Vec3 }
  return { columbia: [pose('csm', {})], eagle: { pose: closing, frame: 'columbia' }, site }
}

function home(get: number): CraftCast {
  const site = pose('lm', { visibility: { person: 0, ascent: 0, ascentInside: 0 } })
  if (get < JETTISON) return { columbia: [pose('csm', {}), DOCKED_LM], eagle: null, site }
  if (get < CM_SM_SEPARATION) return { columbia: [pose('csm', {})], eagle: null, site }
  return { columbia: posesAt('entry', along(ENTRY, get)), eagle: null, site }
}

export function craftAt(get: number): CraftCast {
  if (get < T(99, 0)) return earthToMoon(get)
  if (get < OWN_WAY) return undocking(get)
  if (get < DOCKED) return onItsOwn(get)
  return home(get)
}
