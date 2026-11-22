import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { readOrbiterMesh } from '../spacecraft/orbiterMesh'
import { cmCockpitAssembly, toCmFrame } from './csmNassp'
import { NASSP_MESHES, nasspFile } from './nassp'
import { PartsBuilder } from './nasspParts'
import type { Rgb } from './palette'

// Columbia's cockpit from Project Apollo - NASSP's meshes (csmNassp.ts): each assembly's triangles,
// one primitive per texture, the plain-coloured groups through a palette; the couches unfolded, as
// the crew lay on them.

export interface CmCockpit {
  parts: Map<string, MeshPrimitive[]>
  // The DDS files it draws with, by the name we write them under.
  textures: Map<string, string>
  palette: Rgb[]
}

async function mesh(path: string): Promise<ReturnType<typeof readOrbiterMesh>> {
  return readOrbiterMesh((await nasspFile(path)).toString('latin1'))
}

export async function cmCockpit(): Promise<CmCockpit> {
  const [cockpit, couches] = await Promise.all([mesh(NASSP_MESHES.cmCockpit), mesh(NASSP_MESHES.cmCouches)])
  const builder = new PartsBuilder('nassp')
  cockpit.groups.forEach((group) => builder.add(cmCockpitAssembly(group.label), toCmFrame(group), cockpit.materials))
  couches.groups.forEach((group) => builder.add('vcCouches', toCmFrame(group), couches.materials))
  return { parts: builder.parts(), textures: builder.textures, palette: builder.palette }
}
