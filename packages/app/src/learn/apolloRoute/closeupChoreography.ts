import { mat4, vec3 } from 'gl-matrix'
import type { Vec3 } from '../../math/tuples'

// The Apollo 11 lesson's close-ups: the moments the route can only name, played with the vehicle
// lessons' models - our Saturn V (for the third stage and its adapter), Columbia and Project Apollo -
// NASSP's Eagle. Each is staged in metres in a frame of its own (closeupFrames.ts sets it in the
// scene): +Y along the flight (or straight up from the ground on the Moon). Each model stands with
// its axis along its +Y: the Saturn V on its base, Columbia on its engine's nozzle, Eagle on its
// footpads.

export type CloseupId = 'transposition' | 'undocking' | 'landing' | 'liftoff' | 'rendezvous' | 'entry'
export type ActorModel = 'saturnV' | 'csm' | 'lm'

export interface ActorPose {
  model: ActorModel
  // Model to frame: turned about `pivot` (its own frame) - first about its axis (y), then across
  // it (x) - and moved by `translation` (metres).
  translation: Vec3
  rotation: { x: number; y: number }
  pivot: Vec3
  explode: number
  fold: number
  // Assemblies faded out (0) or partly (by id; 1 where not given).
  visibility: Record<string, number>
}

// Measured on the models (metres, their own frames).
export const CM_APEX: Vec3 = [0, 10.39, 0] // Columbia's nose: the docking probe
export const LM_TOP: Vec3 = [0, 7.07, 0] // Eagle's roof: the docking drogue
const CSM_MIDDLE: Vec3 = [0, 5.2, 0]
const CM_MIDDLE_Y = 8.78
const LM_DESCENT_BOTTOM = 0.58 // the descent stage's base (the legs folded up)
const IU_TOP = 85.71 // the Saturn V's instrument unit, under the adapter
// Taken apart, the command module and Eagle's ascent stage move up by this much per unit of explode.
const EXPLODE_STEP = 2.5
const EXPLODES: Partial<Record<ActorModel, Record<string, Vec3>>> = { csm: { cm: [0, EXPLODE_STEP, 0] }, lm: { ascent: [0, EXPLODE_STEP, 0], ascentInside: [0, EXPLODE_STEP, 0] } }

const SATURN_V_SHOWN = ['sivb', 'sivbEngine', 'iu', 'sla']
const SATURN_V_PARTS = ['les', 'cm', 'sm', 'sla', 'lm', 'iu', 'sivb', 'sivbInside', 'sivbEngine', 'sii', 'siiInside', 'siiEngines', 'sic', 'sicInside', 'sicEngines', 'person']
const LM_DESCENT_PARTS = ['descent', 'descentInside', 'leg0', 'leg1', 'leg2', 'leg3', 'deployed']
const SM_PARTS = ['sm', 'smInside', 'sps', 'rcs', 'antenna']
// Eagle docked to Columbia's nose, upside down to it (turned half round across its axis).
const DOCKED_LM_Y = CM_APEX[1] + LM_TOP[1]

// How far along a stretch of the play (seconds) - eased in and out, 0 before, 1 after.
function phase(seconds: number, from: number, to: number): number {
  const u = Math.min(Math.max((seconds - from) / (to - from), 0), 1)
  return u * u * (3 - 2 * u)
}

function pose(model: ActorModel, fields: Partial<Omit<ActorPose, 'model'>>): ActorPose {
  return { model, translation: [0, 0, 0], rotation: { x: 0, y: 0 }, pivot: [0, 0, 0], explode: 0, fold: 0, visibility: { person: 0 }, ...fields }
}

function only(parts: string[], shown: string[]): Record<string, number> {
  return Object.fromEntries(parts.map((part) => [part, shown.includes(part) ? 1 : 0]))
}

// Columbia leaves the third stage, turns round, docks to Eagle in the adapter and pulls it out.
function transposition(t: number): ActorPose[] {
  const extraction = 20 * phase(t, 11, 15)
  const csmY = 7 + 18 * phase(t, 0, 4) - 18.52 * phase(t, 7.5, 11) + extraction
  return [
    pose('saturnV', { translation: [0, -IU_TOP, 0], visibility: { ...only(SATURN_V_PARTS, SATURN_V_SHOWN), sla: 1 - phase(t, 0, 1.5) } }),
    pose('lm', { translation: [0, -LM_DESCENT_BOTTOM + extraction, 0], fold: 1, visibility: { person: 0, deployed: 0 } }),
    pose('csm', { translation: [0, csmY, 0], rotation: { x: Math.PI * phase(t, 4, 7.5), y: 0 }, pivot: CSM_MIDDLE }),
  ]
}

// In lunar orbit Eagle unfolds its legs (their struts and probes showing as they come out), lets go
// and turns round once in front of Columbia.
function undocking(t: number): ActorPose[] {
  return [
    pose('csm', {}),
    pose('lm', { translation: [0, DOCKED_LM_Y + 12 * phase(t, 3.5, 8), 0], rotation: { x: Math.PI, y: 2 * Math.PI * phase(t, 8, 14) }, fold: 1 - phase(t, 0, 3.5), visibility: { person: 0, deployed: phase(t, 0, 3.5) } }),
  ]
}

// Down onto the ground, slowing to a stop: it comes in from -X, as it flew.
function landing(t: number): ActorPose[] {
  const left = (1 - Math.min(t / 12, 1)) ** 2
  return [pose('lm', { translation: [-60 * left, 45 * left, 0] })]
}

// The ascent stage lifts off the descent stage, faster and faster (50 m up in 12 s).
const LIFTOFF_SECONDS = 12
function liftoffRise(t: number): number {
  return 20 * Math.min(t / LIFTOFF_SECONDS, 1) ** 2
}
function liftoff(t: number): ActorPose[] {
  return [pose('lm', { explode: liftoffRise(t) })]
}

// The ascent stage alone comes up to Columbia's nose and docks; later it is cast off.
function rendezvous(t: number): ActorPose[] {
  const away = 15 * phase(t, 10, 14)
  const visibility = { ...only(LM_DESCENT_PARTS, []), person: 0, ascent: 1 - phase(t, 12.5, 14) }
  return [pose('csm', {}), pose('lm', { translation: [0, DOCKED_LM_Y + 25 * (1 - phase(t, 0, 9)) + away, 0], rotation: { x: Math.PI, y: 0 }, visibility })]
}

// The service module drops back and fades; the command module turns its heat shield forward.
function entry(t: number): ActorPose[] {
  const explode = 8 * phase(t, 0, 5)
  const fade = 1 - phase(t, 5, 6.5)
  const visibility = { person: 0, ...Object.fromEntries(SM_PARTS.map((part) => [part, fade])) }
  return [pose('csm', { explode, translation: [0, -EXPLODE_STEP * explode, 0], rotation: { x: Math.PI * phase(t, 7, 11), y: 0 }, pivot: [0, CM_MIDDLE_Y + EXPLODE_STEP * explode, 0], visibility })]
}

export interface Closeup {
  // How long it plays (then it holds).
  seconds: number
  // What the camera looks at (metres, in the close-up's frame) and how much must fit around it.
  center: Vec3
  reach: number
  // Labels: a name (closeup labels' key) on a point of a model's assembly.
  labels: readonly { name: 'columbia' | 'eagle' | 'thirdStage'; model: ActorModel; point: readonly number[]; assembly: string }[]
  play: (seconds: number) => ActorPose[]
  // What the camera keeps its pivot on as it plays (metres, the close-up's frame), if it follows.
  follow?: (seconds: number) => Vec3
}

const COLUMBIA_LABEL = { name: 'columbia', model: 'csm', point: [0, CM_MIDDLE_Y, 0], assembly: 'cm' } as const
const EAGLE_LABEL = { name: 'eagle', model: 'lm', point: [0, 5.14, 0], assembly: 'ascent' } as const

export const CLOSEUPS: Record<CloseupId, Closeup> = {
  transposition: { seconds: 15, center: [0, 8, 0], reach: 26, play: transposition, labels: [COLUMBIA_LABEL, EAGLE_LABEL, { name: 'thirdStage', model: 'saturnV', point: [0, 75.86, 0], assembly: 'sivb' }] },
  undocking: { seconds: 14, center: [0, 16, 0], reach: 20, play: undocking, labels: [COLUMBIA_LABEL, EAGLE_LABEL] },
  landing: { seconds: 12, center: [-10, 8, 0], reach: 24, play: landing, labels: [EAGLE_LABEL] },
  liftoff: { seconds: LIFTOFF_SECONDS, center: [0, 6, 0], reach: 16, play: liftoff, labels: [EAGLE_LABEL], follow: (t) => [0, Math.max(6, 5.14 + EXPLODE_STEP * liftoffRise(t)), 0] },
  rendezvous: { seconds: 14, center: [0, 18, 0], reach: 22, play: rendezvous, labels: [COLUMBIA_LABEL, EAGLE_LABEL] },
  entry: { seconds: 11, center: [0, 2, 0], reach: 16, play: entry, labels: [COLUMBIA_LABEL] },
}

export function posesAt(id: CloseupId, seconds: number): ActorPose[] {
  return CLOSEUPS[id].play(Math.min(seconds, CLOSEUPS[id].seconds))
}

// The actor's model-to-frame matrix (metres; explode is applied before it, per assembly).
export function actorMatrix(actor: ActorPose): mat4 {
  const m = mat4.fromTranslation(mat4.create(), vec3.add(vec3.create(), actor.translation, actor.pivot))
  mat4.rotateX(m, m, actor.rotation.x)
  mat4.rotateY(m, m, actor.rotation.y)
  return mat4.translate(m, m, vec3.negate(vec3.create(), actor.pivot))
}

// A point of an assembly (model frame, metres), moved as the actor is taken apart and placed.
export function actorPoint(actor: ActorPose, point: ArrayLike<number>, assembly: string): Vec3 {
  const offset = EXPLODES[actor.model]?.[assembly] ?? [0, 0, 0]
  const moved = vec3.fromValues(point[0] + offset[0] * actor.explode, point[1] + offset[1] * actor.explode, point[2] + offset[2] * actor.explode)
  const result = vec3.transformMat4(vec3.create(), moved, actorMatrix(actor))
  return [result[0], result[1], result[2]]
}
