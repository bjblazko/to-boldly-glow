import type { Hinge } from '../../../app/src/spacecraft/modelHinge'
import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { readOrbiterMesh, type OrbiterMesh } from '../spacecraft/orbiterMesh'
import { mergePrimitives } from './latheMesh'
import { LAUNCHER_TURNS, launcherAssembly, type LauncherPart, mirroredHinge } from './launcherNassp'
import { nasspFile } from './nassp'
import { PartsBuilder, toOurFrame } from './nasspParts'
import { swatchUv } from './palette'
import { HEIGHTS, PERSON } from './saturnVProfile'
import { PALETTE_TEXTURE, saturnVParts, SWATCHES } from './saturnVParts'
import { placedLathe } from './shapes'

// The launcher lesson's models: NASSP's mobile launcher with our Saturn V on its hold-down arms and
// a person for scale; NASSP's crawler-transporter, under the launcher's middle.
//
// Our frame: the rocket's axis on the origin (the hold-down arms' middle), the launcher's bottom on
// the floor, +Y up.

const ML = 'Meshes/ProjectApollo/Saturn5ML.msh'
const CRAWLER_BODY = 'Meshes/ProjectApollo/Crawler_Mainbody.msh'
const CRAWLER_TRUCK = 'Meshes/ProjectApollo/Crawler_drivetrucks.msh'
// Where NASSP's crawler places its body and its four drive trucks (src_launch/Crawler.cpp), in
// Orbiter's frame round the crawler's origin, which carries the launcher's origin.
const CRAWLER_BODY_AT: [number, number, number] = [0.767, 3.387, 2.534]
const CRAWLER_TRUCKS_AT: [number, number, number][] = [[14.539, 1.765, 15.512], [-12.957, 1.765, 15.512], [14.539, 1.765, -10.359], [-12.957, 1.765, -10.359]]
const PERSON_AT: [number, number] = [24, -12]

export interface LauncherModels {
  launcher: Map<string, MeshPrimitive[]>
  crawler: Map<string, MeshPrimitive[]>
  hinges: Partial<Record<LauncherPart, Hinge>>
  // How high the crawler carries the launcher's bottom, and the launcher's deck above the floor.
  crawlerTop: number
  deck: number
  textures: Map<string, string>
  palette: PartsBuilder['palette']
}

async function mesh(path: string): Promise<OrbiterMesh> {
  return readOrbiterMesh((await nasspFile(path)).toString('latin1'))
}

function bounds(meshes: OrbiterMesh['groups'], axis: number): [number, number] {
  const values = meshes.flatMap((group) => Array.from(group.positions).filter((_, i) => i % 3 === axis))
  return [Math.min(...values), Math.max(...values)]
}

// The shift that puts the hold-down arms' middle on the axis and the launcher's bottom on the floor
// (applied after x is mirrored).
function launcherShift(ml: OrbiterMesh): [number, number, number] {
  const holddown = ml.groups.filter((group) => launcherAssembly(group.label) === 'holddown')
  const base = ml.groups.filter((group) => launcherAssembly(group.label) === 'launcher')
  const [[x0, x1], [z0, z1]] = [bounds(holddown, 0), bounds(holddown, 2)]
  return [(x0 + x1) / 2, -bounds(base, 1)[0], -(z0 + z1) / 2]
}

export async function launcherModels(): Promise<LauncherModels> {
  const [ml, body, truck] = await Promise.all([mesh(ML), mesh(CRAWLER_BODY), mesh(CRAWLER_TRUCK)])
  const shift = launcherShift(ml)
  const builder = new PartsBuilder('nassp')
  ml.groups.forEach((group) => builder.add(launcherAssembly(group.label), toOurFrame(group, shift), ml.materials))
  const rocketBase = bounds(ml.groups.filter((group) => group.label.startsWith('0000_')), 1)[1] + shift[1]
  const launcher = new Map([...builder.parts(), ['rocket', rocket(rocketBase - HEIGHTS.sicBase)], ['person', [person()]]])
  const hinges = Object.fromEntries(Object.entries(LAUNCHER_TURNS).map(([part, turn]) => [part, mirroredHinge(turn, shift)]))
  // The crawler's origin carries the launcher's origin: in our frame, where that lands.
  const crawlerBuilder = new PartsBuilder('nassp', builder)
  const at = (offset: [number, number, number]): [number, number, number] => [shift[0] - offset[0], offset[1], shift[2] + offset[2]]
  body.groups.forEach((group) => crawlerBuilder.add('crawler', toOurFrame(group, at(CRAWLER_BODY_AT)), body.materials))
  for (const offset of CRAWLER_TRUCKS_AT) truck.groups.forEach((group) => crawlerBuilder.add('crawler', toOurFrame(group, at(offset)), truck.materials))
  const crawlerTop = bounds(body.groups, 1)[1] + CRAWLER_BODY_AT[1]
  const deck = bounds(ml.groups.filter((group) => group.label.startsWith('0001_')), 1)[1] + shift[1]
  return { launcher, crawler: crawlerBuilder.parts(), hinges, crawlerTop, deck, textures: crawlerBuilder.textures, palette: crawlerBuilder.palette }
}

// Our Saturn V (saturnVParts.ts) as one part, its stages' base on the hold-down arms: one primitive
// per texture (its paint, its palette).
function rocket(base: number): MeshPrimitive[] {
  const parts = [...saturnVParts()].filter(([assembly]) => assembly !== 'person').flatMap(([, primitives]) => primitives)
  const textures = [...new Set(parts.map((part) => part.texture))]
  return textures.map((texture) => {
    const merged = mergePrimitives(parts.filter((part) => part.texture === texture))
    return { ...merged, positions: Float32Array.from(merged.positions, (value, i) => (i % 3 === 1 ? value + base : value)) }
  })
}

// The person for scale, on the floor beside the launcher, in the Saturn V's palette.
function person(): MeshPrimitive {
  return placedLathe(PERSON.profile, PERSON_AT, 0, { texture: PALETTE_TEXTURE, uv: () => swatchUv(SWATCHES, 'person'), segments: 12 })
}
