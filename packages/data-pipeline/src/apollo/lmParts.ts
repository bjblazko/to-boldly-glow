import type { AssemblyKind } from '../../../app/src/spacecraft/modelFile'
import type { Hinge } from '../../../app/src/spacecraft/modelHinge'
import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { mergePrimitives } from './latheMesh'
import { ascentInside, ascentShell, type AscentLooks } from './lmAscent'
import { deployedParts, legParts, outriggerParts } from './lmLegs'
import { DESCENT_STAGE, DESCENT_TANKS, DPS, legHinge, LEGS, LM_HEIGHTS, type LmTank, PERSON_PLACE } from './lmProfile'
import { facesMesh, plate, polygon, prism, type Look, type Point3, type Swatch } from './lmShapes'
import { LM_FOIL_TEXTURES, LM_PALETTE_TEXTURE, LM_SWATCHES, type LmSwatch } from './lmTextures'
import { swatchUv } from './palette'
import { PERSON } from './saturnVProfile'
import { placedLathe, tankProfile } from './shapes'

// The assemblies Eagle is shown in: the descent stage's shell (cut open) and what is inside it,
// each leg (they fold), what is there only with them out (the secondary struts, the probes), the ascent stage's
// shell and what is inside it, the cockpit (lmCockpit.ts) and a person for scale.
export const LM_ASSEMBLIES = ['descent', 'descentInside', 'leg0', 'leg1', 'leg2', 'leg3', 'deployed', 'ascent', 'ascentInside', 'cockpit', 'person'] as const
export type LmAssembly = (typeof LM_ASSEMBLIES)[number]

export function lmAssemblyKind(assembly: LmAssembly): AssemblyKind {
  if (assembly === 'descent' || assembly === 'ascent') return 'shell'
  return assembly === 'descentInside' || assembly === 'ascentInside' || assembly === 'cockpit' ? 'inside' : 'solid'
}

// Taken apart, the ascent stage (with what is in it) lifts off the descent stage.
export function lmExplodeOffset(assembly: LmAssembly): [number, number, number] {
  return [0, assembly === 'ascent' || assembly === 'ascentInside' || assembly === 'cockpit' ? 2.5 : 0, 0]
}

// The legs fold about their hinges; nothing else does.
export function lmHinge(assembly: LmAssembly): Hinge | undefined {
  const index = ['leg0', 'leg1', 'leg2', 'leg3'].indexOf(assembly)
  return index < 0 ? undefined : legHinge(LEGS[index])
}

export const LM_PLAQUE_TEXTURE = 'lm-plaque.jpg'
export const LM_DECAL_TEXTURE = 'lm-flag.jpg'

export const swatch = (name: LmSwatch): Swatch => ({ texture: LM_PALETTE_TEXTURE, uv: swatchUv(LM_SWATCHES, name) })
const foil = (tint: keyof typeof LM_FOIL_TEXTURES, shift = 0): Look => ({ texture: LM_FOIL_TEXTURES[tint], foil: true, shift })

const ASCENT_LOOKS: AscentLooks = {
  panel: swatch('ascent'),
  dark: swatch('ascentDark'),
  black: swatch('black'),
  glass: swatch('glass'),
  dish: swatch('dish'),
  engine: swatch('engine'),
  fuel: swatch('fuel'),
  oxidizer: swatch('oxidizer'),
}

// Every assembly's triangles but the cockpit's.
export function lmParts(): Map<LmAssembly, MeshPrimitive[]> {
  const legLooks = { strut: swatch('strut'), steel: swatch('steel'), plaque: { texture: LM_PLAQUE_TEXTURE, decal: true } as Look }
  return new Map<LmAssembly, MeshPrimitive[]>([
    ['descent', [...descentShell(), ...outriggerParts(swatch('strut'), swatch('steel'))]],
    ['descentInside', [mergePrimitives([...DESCENT_TANKS.map(tank), placedLathe(DPS.profile.filter(([, h]) => h >= 0.6), [0, 0], DPS.exitHeight, { texture: LM_PALETTE_TEXTURE, uv: () => swatchUv(LM_SWATCHES, 'engine'), segments: 40 })])]],
    ...LEGS.map((leg, index) => [`leg${index}` as LmAssembly, legParts(leg, legLooks)] as [LmAssembly, MeshPrimitive[]]),
    ['deployed', [deployedParts(swatch('strut'), swatch('steel'))]],
    ['ascent', ascentShell(ASCENT_LOOKS)],
    ['ascentInside', ascentInside(ASCENT_LOOKS)],
    ['person', [placedLathe(PERSON.profile, PERSON_PLACE, 0, { texture: LM_PALETTE_TEXTURE, uv: () => swatchUv(LM_SWATCHES, 'person'), segments: 12 })]],
  ])
}

// The octagon (its flat faces 81 in out) wrapped in gold foil, the diagonal quadrants in amber, the
// bottom in black; the descent engine's nozzle showing below; the flag and "UNITED STATES" on the
// front left of the ladder, the equipment stowage (MESA) on the quadrant to its left.
function descentShell(): MeshPrimitive[] {
  const radius = DESCENT_STAGE.beamEnd / Math.cos(Math.PI / 8)
  const outline = polygon(8, radius, [0, 0], 22.5)
  const { descentBottom: bottom, descentDeck: top } = LM_HEIGHTS
  const body = prism(outline, bottom, top, foil('gold'))
  // Wall i runs from corner i to the next and faces 45° × (i + 1) round from +Z: 0, 2, 4, 6 are the
  // diagonal quadrants, 7 is the front.
  const diagonals = [0, 2, 4, 6].map((index) => proudFace(outline, index, { bottom, top }, foil('amber', index * 0.21)))
  const underside = facesMesh([{ corners: outline.map(([x, z]) => [x, bottom - 0.01, z] as Point3), normal: [0, -1, 0] }], foil('black'))
  const nozzle = placedLathe(DPS.profile.filter(([, h]) => h <= 0.62), [0, 0], DPS.exitHeight, { texture: LM_PALETTE_TEXTURE, uv: () => swatchUv(LM_SWATCHES, 'nozzle'), segments: 40 })
  const front = DESCENT_STAGE.beamEnd + 0.012
  const decal = plate([[-0.75, 1.75, front], [-0.25, 1.75, front], [-0.25, 2.85, front], [-0.75, 2.85, front]], { texture: LM_DECAL_TEXTURE, decal: true })
  const mesa = proudFace(outline, 6, { bottom: bottom + 0.35, top: top - 0.35, proud: 0.06 }, foil('silver'))
  return [body, ...diagonals, underside, nozzle, decal, mesa]
}

// A wall of the octagon (from corner `index` to the next) a little proud of it, between two heights;
// further out (a box on it) it is narrower than the wall.
function proudFace(outline: [number, number][], index: number, { bottom, top, proud = 0.01 }: { bottom: number; top: number; proud?: number }, look: Look): MeshPrimitive {
  const [[x0, z0], [x1, z1]] = [outline[index], outline[(index + 1) % outline.length]]
  const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2]
  const length = Math.hypot(mx, mz)
  const [ox, oz] = [(mx / length) * proud, (mz / length) * proud]
  const shrink = (x: number, z: number): [number, number] => (proud > 0.03 ? [mx + (x - mx) * 0.8, mz + (z - mz) * 0.8] : [x, z])
  const [[ax, az], [bx, bz]] = [shrink(x0, z0), shrink(x1, z1)]
  return plate([[ax + ox, bottom, az + oz], [bx + ox, bottom, bz + oz], [bx + ox, top, bz + oz], [ax + ox, top, az + oz]], look)
}

// A descent tank: a cylinder with round ends, in its compartment.
function tank({ at, radius, bottom, height, contents }: LmTank): MeshPrimitive {
  const profile = tankProfile({ radius, bottom: radius, top: radius + height, lowerDome: radius, upperDome: radius })
  return placedLathe(profile, at, bottom, { texture: LM_PALETTE_TEXTURE, uv: () => swatchUv(LM_SWATCHES, contents), segments: 32 })
}
