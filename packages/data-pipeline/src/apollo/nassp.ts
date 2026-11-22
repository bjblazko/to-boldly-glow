import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Project Apollo - NASSP (https://github.com/orbiternassp/NASSP), the Apollo add-on for the Orbiter
// space flight simulator, GPL-2.0-or-later: its lunar module's and command module's meshes and textures, at one pinned
// commit so every build reads the same files. They are downloaded once into the pipeline's cache
// (not committed); the build turns them into Eagle's model files.

export const NASSP_COMMIT = 'ddba501d2e274367b8660d7050dee7b9f4153865'
export const NASSP_HOME = 'https://github.com/orbiternassp/NASSP'

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '../../cache/nassp', NASSP_COMMIT)

// A file of the repository (its path as in the repository), from the cache or downloaded into it.
export async function nasspFile(path: string): Promise<Buffer> {
  const local = join(CACHE, path)
  if (!existsSync(local)) {
    const response = await fetch(`https://raw.githubusercontent.com/orbiternassp/NASSP/${NASSP_COMMIT}/${path.split('/').map(encodeURIComponent).join('/')}`)
    if (!response.ok) throw new Error(`NASSP ${path}: HTTP ${response.status}`)
    mkdirSync(dirname(local), { recursive: true })
    writeFileSync(local, Buffer.from(await response.arrayBuffer()))
  }
  return readFileSync(local)
}

// A texture as a mesh names it ("ProjectApollo\VC\LMVC.dds"): its path in the repository.
export function nasspTexturePath(name: string): string {
  return `Textures/${name.replaceAll('\\', '/')}`
}

export const NASSP_MESHES = {
  descent: 'Meshes/ProjectApollo/LM_DescentStage.msh',
  ascent: 'Meshes/ProjectApollo/LM_AscentStage.msh',
  cockpit: 'Meshes/ProjectApollo/LM_VC.msh',
  cmCockpit: 'Meshes/ProjectApollo/CM-VC.msh',
  cmCouches: 'Meshes/ProjectApollo/CM-VC-SeatsUnfolded.msh',
}
