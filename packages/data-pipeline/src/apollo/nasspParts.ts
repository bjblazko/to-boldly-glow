import { basename } from 'node:path'
import sharp from 'sharp'
import { decodeDds } from '../spacecraft/ddsImage'
import type { MeshPrimitive } from '../spacecraft/glbMesh'
import type { OrbiterGroup, OrbiterMaterial } from '../spacecraft/orbiterMesh'
import { mergePrimitives } from './latheMesh'
import { nasspFile, nasspTexturePath } from './nassp'
import { paletteTexture, type Rgb } from './palette'

// What every model made from Project Apollo - NASSP's meshes shares: a group in our frame, the groups
// collected into assemblies (one primitive per texture, plain colours through a palette), the DDS
// textures as JPEG.

const GLASS: Rgb = [18, 24, 32]

// A group of NASSP's in our frame, its normals made where it has none.
export interface NasspGroup {
  label: string
  material: number | null
  texture: string | null
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array | null
  indices: Uint32Array
}

// Orbiter's frame is left-handed (x right, y up, z forward); ours is right-handed with z forward:
// x is mirrored, then the group is moved by `shift` (metres, in our frame). A mirror turns the
// triangles round: their corners are put back in front-face order.
export function toOurFrame(group: OrbiterGroup, shift: readonly [number, number, number]): NasspGroup {
  const positions = Float32Array.from(group.positions, (value, i) => (i % 3 === 0 ? 0 - value + shift[0] || 0 : value + shift[i % 3]))
  const indices = new Uint32Array(group.indices.length)
  for (let t = 0; t < indices.length; t += 3) indices.set([group.indices[t], group.indices[t + 2], group.indices[t + 1]], t)
  const normals = group.normals ? Float32Array.from(group.normals, (value, i) => (i % 3 === 0 ? -value : value)) : faceNormals(positions, indices)
  return { label: group.label, material: group.material, texture: group.texture, positions, normals, uvs: group.uvs, indices }
}

// Per-vertex normals from the triangles around each vertex.
function faceNormals(p: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(p.length)
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3]
    const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]]
    const v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    for (const corner of [a, b, c]) for (let k = 0; k < 3; k++) normals[corner + k] += n[k]
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1
    for (let k = 0; k < 3; k++) normals[i + k] /= length
  }
  return normals
}

// Collects the groups into assemblies, sharing one palette and one list of textures.
export class PartsBuilder {
  readonly textures: Map<string, string>
  readonly palette: Rgb[]
  private readonly byPart = new Map<string, MeshPrimitive[]>()

  // `folder`: where the textures go beside the model (and the palette in it).
  constructor(
    private readonly folder = 'nassp',
    shared?: PartsBuilder,
  ) {
    this.textures = shared?.textures ?? new Map<string, string>()
    this.palette = shared?.palette ?? []
  }

  get paletteFile(): string {
    return `${this.folder}/palette.png`
  }

  add(part: string, group: NasspGroup, materials: OrbiterMaterial[]): void {
    const material = group.material === null ? undefined : materials[group.material]
    const primitive = { ...this.look(group, material), positions: group.positions, normals: group.normals, indices: group.indices }
    this.byPart.set(part, [...(this.byPart.get(part) ?? []), primitive])
  }

  // One primitive per texture in each assembly.
  parts(): Map<string, MeshPrimitive[]> {
    return new Map([...this.byPart].map(([part, primitives]) => [part, byTexture(primitives)]))
  }

  // Textured groups keep their texture; glass and plain-coloured ones take a palette swatch.
  private look(group: NasspGroup, material: OrbiterMaterial | undefined): { texture: string; uvs: Float32Array } {
    const glass = material && material.diffuse[3] < 0.5
    if (group.texture && group.uvs && !glass) {
      const file = `${this.folder}/${basename(group.texture.replaceAll('\\', '/'), '.dds').toLowerCase()}.jpg`
      this.textures.set(file, nasspTexturePath(group.texture))
      return { texture: file, uvs: group.uvs }
    }
    const color: Rgb = glass ? GLASS : material ? (material.diffuse.slice(0, 3).map((value) => Math.round(value * 255)) as unknown as Rgb) : [200, 200, 200]
    const swatch = this.swatch(color)
    const uv = [(swatch + 0.5) / 64, 0.5]
    return { texture: this.paletteFile, uvs: Float32Array.from({ length: (group.positions.length / 3) * 2 }, (_, i) => uv[i % 2]) }
  }

  private swatch(color: Rgb): number {
    const found = this.palette.findIndex((other) => other.every((value, k) => value === color[k]))
    if (found >= 0) return found
    if (this.palette.length >= 64) throw new Error('More than 64 plain colours in the NASSP meshes')
    this.palette.push(color)
    return this.palette.length - 1
  }
}

export function points(positions: Float32Array): [number, number, number][] {
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
