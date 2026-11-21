import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { mergePrimitives, type ProfilePoint } from './latheMesh'
import { DESCENT_STAGE, FOOTPAD, LADDER, type Leg, LEGS, LM_HEIGHTS, outward, PROBE_LENGTH } from './lmProfile'
import { box, plate, type Look, type Point3, type Swatch } from './lmShapes'
import { placedLathe, strutMesh } from './shapes'

// The landing gear (lmProfile.ts): each leg's primary strut and footpad and - on the forward leg -
// the ladder and the plaque, folding together about the leg's hinge; the outriggers they hang from,
// which stay with the descent stage; and the secondary struts and probes, there only with the legs out.

export interface LegLooks {
  strut: Swatch
  steel: Swatch
  plaque: Look
}

const FOOTPAD_PROFILE: ProfilePoint[] = [[0, 0], [FOOTPAD.radius - 0.06, 0], [FOOTPAD.radius, 0.07], [FOOTPAD.radius, 0.13], [0.16, FOOTPAD.height], [0, FOOTPAD.height]]

// Where the primary strut meets the footpad.
function footTop(leg: Leg): Point3 {
  return [leg.footpad[0], FOOTPAD.height - 0.03, leg.footpad[2]]
}

// The point on the primary strut at a height.
function onStrut(leg: Leg, y: number): Point3 {
  const [top, foot] = [leg.hinge, footTop(leg)]
  const t = (top[1] - y) / (top[1] - foot[1])
  return [top[0] + (foot[0] - top[0]) * t, y, top[2] + (foot[2] - top[2]) * t]
}

// A point on the descent stage's lower rim, `degrees` round from the leg's own direction.
function rim(leg: Leg, degrees: number, height: number, reach = DESCENT_STAGE.beamEnd): Point3 {
  const [x, z] = outward(leg.azimuthDegrees + degrees)
  return [x * reach, height, z * reach]
}

export function legParts(leg: Leg, looks: LegLooks): MeshPrimitive[] {
  const gold = looks.strut
  const rod = (from: Point3, to: Point3, radius: number) => strutMesh(from, to, { radius, ...gold, sides: 10 })
  const parts = [rod(leg.hinge, footTop(leg), 0.085), placedLathe(FOOTPAD_PROFILE, [leg.footpad[0], leg.footpad[2]], 0, { texture: gold.texture, uv: () => gold.uv, segments: 28 })]
  return leg.azimuthDegrees === 0 ? [...parts, ladder(leg, looks.steel), plaque(leg, looks.plaque)] : parts
}

// Rails 20 in apart in front of the strut, nine rungs 9 in apart from 30 in above the footpad up.
function ladder(leg: Leg, steel: Swatch): MeshPrimitive {
  const [x, z] = outward(leg.azimuthDegrees)
  const side: Point3 = [z, 0, -x]
  const bottom = FOOTPAD.height + LADDER.aboveFootpad
  const top = bottom + (LADDER.rungs - 1) * LADDER.rungSpacing + 0.15
  const at = (y: number, across: number): Point3 => {
    const p = onStrut(leg, y)
    return [p[0] + x * 0.14 + side[0] * across, y, p[2] + z * 0.14 + side[2] * across]
  }
  const half = LADDER.railsApart / 2
  const rod = (from: Point3, to: Point3, radius: number) => strutMesh(from, to, { radius, ...steel, sides: 6 })
  const rails = [-half, half].map((across) => rod(at(bottom - 0.1, across), at(top, across), 0.015))
  const rungs = Array.from({ length: LADDER.rungs }, (_, k) => rod(at(bottom + k * LADDER.rungSpacing, -half), at(bottom + k * LADDER.rungSpacing, half), 0.011))
  return mergePrimitives([...rails, ...rungs])
}

// The plaque, 9 in by 7.6 in, on the strut behind the ladder, facing out.
function plaque(leg: Leg, look: Look): MeshPrimitive {
  const [x, z] = outward(leg.azimuthDegrees)
  const side: Point3 = [z, 0, -x]
  const [w, h] = [0.23, 0.19]
  const centre = onStrut(leg, 2.35)
  const corner = (across: number, up: number): Point3 => [centre[0] + x * 0.09 + side[0] * across, centre[1] + up, centre[2] + z * 0.09 + side[2] * across]
  return plate([corner(-w / 2, -h / 2), corner(w / 2, -h / 2), corner(w / 2, h / 2), corner(-w / 2, h / 2)], look)
}

// What is there only with the legs out: the secondary struts bracing each primary strut to the
// stage (folded, they fold with it - not drawn) and the probes, hanging 5 ft below the footpads of
// all legs but the forward one (stowed against the struts for the ride).
export function deployedParts(gold: Swatch, steel: Swatch): MeshPrimitive {
  const rod = (from: Point3, to: Point3, radius: number, look: Swatch) => strutMesh(from, to, { radius, ...look, sides: 8 })
  const braces = LEGS.flatMap((leg) => {
    const brace = onStrut(leg, 1.3)
    return [rod(brace, rim(leg, -24, LM_HEIGHTS.descentBottom + 0.1), 0.035, gold), rod(brace, rim(leg, 24, LM_HEIGHTS.descentBottom + 0.1), 0.035, gold), rod(onStrut(leg, 2.3), rim(leg, 0, LM_HEIGHTS.descentBottom + 0.5), 0.03, gold)]
  })
  const probes = LEGS.filter((leg) => leg.probe).map((leg) => rod([leg.footpad[0], 0.02, leg.footpad[2]], [leg.footpad[0], -PROBE_LENGTH, leg.footpad[2]], 0.013, steel))
  return mergePrimitives([...braces, ...probes])
}

// The outriggers: each a four-legged truss from the stage's corners out to the leg's hinge; and the
// platform in front of the hatch, on the forward one.
export function outriggerParts(gold: Swatch, steel: Swatch): MeshPrimitive[] {
  const trusses = LEGS.flatMap((leg) =>
    [-14, 14].flatMap((degrees) => [LM_HEIGHTS.descentDeck - 0.05, LM_HEIGHTS.descentBottom + 0.25].map((height) => strutMesh(rim(leg, degrees, height, 2.0), leg.hinge, { radius: 0.04, ...gold, sides: 8 }))),
  )
  const porch = box([-0.45, LM_HEIGHTS.descentDeck + 0.02, 1.55], [0.45, LM_HEIGHTS.descentDeck + 0.06, 2.4], steel)
  return [mergePrimitives(trusses), porch]
}
