import type { Hinge } from '../../../app/src/spacecraft/modelHinge'
import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { readOrbiterMesh } from '../spacecraft/orbiterMesh'
import { NASSP_MESHES, nasspFile } from './nassp'
import { PartsBuilder, points } from './nasspParts'
import { ascentAssembly, cockpitAssembly, descentAssembly, foilMapped, FOILS, foldingHinge, linkHinge, type LmGroup, toLmFrame } from './lmNassp'
import type { Rgb } from './palette'

// Eagle's outside and cockpit from Project Apollo - NASSP's meshes (lmNassp.ts): each assembly's
// triangles, one primitive per texture; the plain-coloured groups through a palette of their
// colours; the legs' hinges; the textures NASSP's DDS files turn into.

// Where NASSP's LM places its meshes (src_lm/lemmesh.cpp): the ascent stage (and the cockpit, in
// the same frame) 0.99 m up, the descent stage 1.25 m down. Ours stands on its footpads' soles.
const ASCENT_AT = 0.99
const DESCENT_AT = -1.25
const LEG_AZIMUTH: Record<string, number> = { leg0: 0, leg1: 90, leg2: 180, leg3: 270 }

// NASSP's textures (and the palette of its plain colours) go into a folder of their own.
export const NASSP_PALETTE_TEXTURE = 'nassp/palette.png'

export interface NasspModels {
  outside: Map<string, MeshPrimitive[]>
  cockpit: Map<string, MeshPrimitive[]>
  hinges: Record<string, Hinge>
  // The DDS files the models draw with, by the name we write them under.
  textures: Map<string, string>
  palette: Rgb[]
}

async function mesh(path: string): Promise<ReturnType<typeof readOrbiterMesh>> {
  return readOrbiterMesh((await nasspFile(path)).toString('latin1'))
}

export async function nasspModels(): Promise<NasspModels> {
  const [descent, ascent, cockpit] = await Promise.all([mesh(NASSP_MESHES.descent), mesh(NASSP_MESHES.ascent), mesh(NASSP_MESHES.cockpit)])
  const soles = Math.min(...descent.groups.filter((group) => group.label.startsWith('Footpad')).flatMap((group) => Array.from(group.positions).filter((_, i) => i % 3 === 1)))
  const lift = -(DESCENT_AT + soles)
  const builder = new PartsBuilder()
  const struts = new Map<string, [number, number, number][]>()
  descent.groups.forEach((group) => {
    const part = descentAssembly(group.label)
    const placed = toLmFrame(group, DESCENT_AT + lift)
    if (group.label.startsWith('MainStrut') || part.startsWith('link')) struts.set(part, [...(struts.get(part) ?? []), ...points(placed.positions)])
    builder.add(part, flatFoil(placed), descent.materials)
  })
  ascent.groups.forEach((group) => {
    const part = ascentAssembly(group.label)
    if (part) builder.add(part, flatFoil(toLmFrame(group, ASCENT_AT + lift)), ascent.materials)
  })
  const outside = builder.parts()
  const inside = new PartsBuilder('nassp', builder)
  cockpit.groups.forEach((group) => inside.add(cockpitAssembly(group.label), toLmFrame(group, ASCENT_AT + lift), cockpit.materials))
  return { outside, cockpit: inside.parts(), hinges: legHinges(struts), textures: inside.textures, palette: inside.palette }
}

// The outside's foil laid flat at its own scale (lmNassp.ts); the rest as NASSP maps it.
function flatFoil(group: LmGroup): LmGroup {
  return group.texture && FOILS.test(group.texture) ? foilMapped(group) : group
}

// Each leg's hinge, found on its primary strut; each leg's braces', from theirs (linkHinge).
function legHinges(struts: Map<string, [number, number, number][]>): Record<string, Hinge> {
  const legs = Object.fromEntries(Object.entries(LEG_AZIMUTH).map(([leg, azimuth]) => [leg, foldingHinge(struts.get(leg) ?? [], azimuth)]))
  const links = Object.keys(LEG_AZIMUTH).map((leg) => [leg.replace('leg', 'link'), linkHinge(struts.get(leg.replace('leg', 'link')) ?? [], legs[leg])])
  return { ...legs, ...Object.fromEntries(links) }
}

