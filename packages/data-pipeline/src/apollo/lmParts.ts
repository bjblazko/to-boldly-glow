import type { AssemblyKind } from '../../../app/src/spacecraft/modelFile'
import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { mergePrimitives } from './latheMesh'
import { APS, ASCENT_TANKS, DESCENT_TANKS, DPS, type LmTank, PERSON_PLACE } from './lmProfile'
import { LM_PALETTE_TEXTURE, LM_SWATCHES, type LmSwatch } from './lmTextures'
import { swatchUv } from './palette'
import { PERSON } from './saturnVProfile'
import { placedLathe, tankProfile } from './shapes'

// The assemblies Eagle is shown in. The outside is Project Apollo - NASSP's (lmNasspModel.ts): the
// descent stage's shell (cut open), each leg (they fold) and each leg's braces (they fold with it,
// about their own feet), the ascent stage's shell. Ours, from the dimensions
// (lmProfile.ts): what the cutaway shows inside the stages - tanks and engines - and a person for
// scale. The cockpit is a model of its own (NASSP's, lit by its lamps), rising with the ascent
// stage.
export const LM_ASSEMBLIES = ['descent', 'descentInside', 'leg0', 'leg1', 'leg2', 'leg3', 'link0', 'link1', 'link2', 'link3', 'ascent', 'ascentInside', 'person'] as const
export const COCKPIT_ASSEMBLIES = ['cockpit', 'panels', 'dsky', 'windows'] as const
export type LmAssembly = (typeof LM_ASSEMBLIES)[number] | (typeof COCKPIT_ASSEMBLIES)[number]

const INSIDE: readonly LmAssembly[] = ['descentInside', 'ascentInside', ...COCKPIT_ASSEMBLIES]
const ASCENT: readonly LmAssembly[] = ['ascent', 'ascentInside', ...COCKPIT_ASSEMBLIES]

export function lmAssemblyKind(assembly: LmAssembly): AssemblyKind {
  if (assembly === 'descent' || assembly === 'ascent') return 'shell'
  return INSIDE.includes(assembly) ? 'inside' : 'solid'
}

// Taken apart, the ascent stage (with what is in it) lifts off the descent stage.
export function lmExplodeOffset(assembly: LmAssembly): [number, number, number] {
  return [0, ASCENT.includes(assembly) ? 2.5 : 0, 0]
}

const colored = (name: LmSwatch, segments: number) => ({ texture: LM_PALETTE_TEXTURE, uv: () => swatchUv(LM_SWATCHES, name), segments })

// What we add to NASSP's outside: the stages' insides and the person.
export function lmInsides(): Map<LmAssembly, MeshPrimitive[]> {
  return new Map<LmAssembly, MeshPrimitive[]>([
    ['descentInside', [mergePrimitives([...DESCENT_TANKS.map(tank), placedLathe(DPS.profile.filter(([, h]) => h >= 0.6), [0, 0], DPS.exitHeight, colored('engine', 40))])]],
    ['ascentInside', [mergePrimitives([...ASCENT_TANKS.map(tank), placedLathe(APS.profile, [0, 0], APS.exitHeight, colored('engine', 32))])]],
    ['person', [placedLathe(PERSON.profile, PERSON_PLACE, 0, colored('person', 12))]],
  ])
}

// A tank: a cylinder (or a sphere) with round ends, in its place.
function tank({ at, radius, bottom, height, contents }: LmTank): MeshPrimitive {
  const profile = tankProfile({ radius, bottom: radius, top: radius + height, lowerDome: radius, upperDome: radius })
  return placedLathe(profile, at, bottom, colored(contents, 32))
}
