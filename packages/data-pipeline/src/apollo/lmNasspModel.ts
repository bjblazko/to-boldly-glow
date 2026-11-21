import { basename } from 'node:path'
import sharp from 'sharp'
import type { Hinge } from '../../../app/src/spacecraft/modelHinge'
import { decodeDds } from '../spacecraft/ddsImage'
import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { readOrbiterMesh, type OrbiterMaterial } from '../spacecraft/orbiterMesh'
import { mergePrimitives } from './latheMesh'
import { NASSP_MESHES, nasspFile, nasspTexturePath } from './nassp'
import { ascentAssembly, cockpitAssembly, descentAssembly, foilMapped, FOILS, foldingHinge, type LmGroup, toLmFrame } from './lmNassp'
import { paletteTexture, type Rgb } from './palette'

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
const GLASS: Rgb = [18, 24, 32]

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
  descent.groups.forEach((group) => builder.add(descentAssembly(group.label), flatFoil(toLmFrame(group, DESCENT_AT + lift)), descent.materials))
  ascent.groups.forEach((group) => {
    const part = ascentAssembly(group.label)
    if (part) builder.add(part, flatFoil(toLmFrame(group, ASCENT_AT + lift)), ascent.materials)
  })
  const outside = builder.parts()
  const inside = new PartsBuilder(builder)
  cockpit.groups.forEach((group) => inside.add(cockpitAssembly(group.label), toLmFrame(group, ASCENT_AT + lift), cockpit.materials))
  return { outside, cockpit: inside.parts(), hinges: legHinges(builder), textures: inside.textures, palette: inside.palette }
}

// The outside's foil laid flat at its own scale (lmNassp.ts); the rest as NASSP maps it.
function flatFoil(group: LmGroup): LmGroup {
  return group.texture && FOILS.test(group.texture) ? foilMapped(group) : group
}

// Each leg's hinge, found on its primary strut.
function legHinges(builder: PartsBuilder): Record<string, Hinge> {
  return Object.fromEntries(Object.entries(LEG_AZIMUTH).map(([leg, azimuth]) => [leg, foldingHinge(builder.strutPoints(leg), azimuth)]))
}

// Collects the groups into assemblies, sharing one palette and one list of textures.
class PartsBuilder {
  readonly textures: Map<string, string>
  readonly palette: Rgb[]
  private readonly byPart = new Map<string, MeshPrimitive[]>()
  private readonly struts = new Map<string, [number, number, number][]>()

  constructor(shared?: PartsBuilder) {
    this.textures = shared?.textures ?? new Map<string, string>()
    this.palette = shared?.palette ?? []
  }

  add(part: string, group: LmGroup, materials: OrbiterMaterial[]): void {
    const material = group.material === null ? undefined : materials[group.material]
    const primitive = { ...this.look(group, material), positions: group.positions, normals: group.normals, indices: group.indices }
    this.byPart.set(part, [...(this.byPart.get(part) ?? []), primitive])
    if (group.label.startsWith('MainStrut')) this.struts.set(part, [...(this.struts.get(part) ?? []), ...points(group.positions)])
  }

  strutPoints(part: string): [number, number, number][] {
    return this.struts.get(part) ?? []
  }

  // One primitive per texture in each assembly.
  parts(): Map<string, MeshPrimitive[]> {
    return new Map([...this.byPart].map(([part, primitives]) => [part, byTexture(primitives)]))
  }

  // Textured groups keep their texture; glass and plain-coloured ones take a palette swatch.
  private look(group: LmGroup, material: OrbiterMaterial | undefined): { texture: string; uvs: Float32Array } {
    const glass = material && material.diffuse[3] < 0.5
    if (group.texture && group.uvs && !glass) {
      const file = `nassp/${basename(group.texture.replaceAll('\\', '/'), '.dds').toLowerCase()}.jpg`
      this.textures.set(file, nasspTexturePath(group.texture))
      return { texture: file, uvs: group.uvs }
    }
    const color: Rgb = glass ? GLASS : material ? (material.diffuse.slice(0, 3).map((value) => Math.round(value * 255)) as unknown as Rgb) : [200, 200, 200]
    const swatch = this.swatch(color)
    const uv = [(swatch + 0.5) / 64, 0.5]
    return { texture: NASSP_PALETTE_TEXTURE, uvs: Float32Array.from({ length: (group.positions.length / 3) * 2 }, (_, i) => uv[i % 2]) }
  }

  private swatch(color: Rgb): number {
    const found = this.palette.findIndex((other) => other.every((value, k) => value === color[k]))
    if (found >= 0) return found
    if (this.palette.length >= 64) throw new Error('More than 64 plain colours in the NASSP meshes')
    this.palette.push(color)
    return this.palette.length - 1
  }
}

function points(positions: Float32Array): [number, number, number][] {
  return Array.from({ length: positions.length / 3 }, (_, i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]])
}

function byTexture(primitives: MeshPrimitive[]): MeshPrimitive[] {
  const groups = new Map<string, MeshPrimitive[]>()
  for (const primitive of primitives) groups.set(primitive.texture, [...(groups.get(primitive.texture) ?? []), primitive])
  return [...groups.values()].map((list) => mergePrimitives(list))
}

// The palette image: 64 swatches across, the unused ones grey.
export function nasspPalette(colors: readonly Rgb[]): Promise<Buffer> {
  return paletteTexture(Array.from({ length: 64 }, (_, i) => colors[i] ?? [128, 128, 128]))
}

// The largest texture side we keep: the cockpit's panels sharp, the rest lighter.
const SHARP = /lmvc|lm_interior|circuitbreakers|fdai|lmasc|lmdcs/

// A DDS texture as a JPEG, at most 4096 (the panels and hulls) or 2048 pixels on its longer side.
export async function nasspTexture(file: string, path: string): Promise<Buffer> {
  const { width, height, rgba } = decodeDds(await nasspFile(path))
  const side = SHARP.test(file) ? 4096 : 2048
  return sharp(Buffer.from(rgba), { raw: { width, height, channels: 4 } }).flatten({ background: '#000000' }).resize({ width: Math.min(width, side), height: Math.min(height, side), fit: 'inside' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
}
