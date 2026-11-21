import type { Hinge } from '../../../app/src/spacecraft/modelHinge'
import type { OrbiterGroup } from '../spacecraft/orbiterMesh'

// How Project Apollo - NASSP's lunar module (nassp.ts) becomes Eagle's: its groups sorted into our
// assemblies, its frame turned into ours, the legs' hinges found on their struts.
//
// NASSP's meshes are in Orbiter's left-handed frame - x right, y up, z forward - so the Commander
// (on the left) stands at -x. Ours is right-handed with z forward and the Commander at +x: x is
// mirrored. NASSP's "Left" leg is therefore our +X leg (leg1, 90 degrees round from forward), its
// "Right" our -X leg (leg3).

export type LmPart = 'descent' | 'leg0' | 'leg1' | 'leg2' | 'leg3' | 'deployed' | 'ascent'
export type CockpitPart = 'cockpit' | 'panels' | 'dsky' | 'windows'

const LEG_SUFFIX: Record<string, LmPart> = { '': 'leg0', Left: 'leg1', Aft: 'leg2', Right: 'leg3' }

// The descent stage's groups: each leg's primary strut and footpad (the forward one with the ladder
// and the plaque), the secondary struts, downlocks and probes (there only with the legs out), the
// rest the stage.
export function descentAssembly(label: string): LmPart {
  if (/^(LowerStrut|Downlock|SupportStruts2|Probes\d)/.test(label)) return 'deployed'
  const leg = /^(MainStrut|Footpad)(Left|Aft|Right)?$/.exec(label)
  if (leg) return LEG_SUFFIX[leg[2] ?? '']
  return label === 'Ladder' || label === 'zPlaque' ? 'leg0' : 'descent'
}

// The ascent stage's groups: its outside; the rough cabin it carries for Orbiter's outside views is
// left out (the cockpit model replaces it).
export function ascentAssembly(label: string): LmPart | null {
  return /^(HullInterior|CDR\d*|LMP\d*|zCDR\d*|zLMP\d*|CabinStrut)$/.test(label) ? null : 'ascent'
}

// The cockpit's groups: the switches, breakers, talkbacks, meters and their panels; the windows;
// the rest (walls, controls, stowage).
export function cockpitAssembly(label: string): CockpitPart {
  if (/^Windows/.test(label)) return 'windows'
  if (/^(DSKY|Dsky|dsky)/.test(label)) return 'dsky'
  return /^(Sw_|CB_|TW_|SwitchHolder|Switch_Guard|SwitchGuard|Xpointer|FDAI|Panel|P\d|Rotary|Meter|TalkBack)/.test(label) ? 'panels' : 'cockpit'
}

export interface LmGroup {
  label: string
  material: number | null
  texture: string | null
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array | null
  indices: Uint32Array
}

// A group in our frame: x mirrored, lifted by `lift` (metres), its triangles' corners put back in
// front-face order (a mirror turns them round); normals made where the group has none.
export function toLmFrame(group: OrbiterGroup, lift: number): LmGroup {
  const positions = Float32Array.from(group.positions, (value, i) => (i % 3 === 0 ? 0 - value || 0 : i % 3 === 1 ? value + lift : value))
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

// Folded, a leg's strut swings up about its top until it leans 8 degrees in past upright, its
// footpad beside the ascent stage - inside the adapter it rode in.
const FOLDED_PAST_UPRIGHT = (8 * Math.PI) / 180

// The hinge of a leg pointing out at `azimuthDegrees` (from +Z toward +X), from its strut's points:
// at the top of the strut, about the horizontal line across the leg.
export function foldingHinge(strut: readonly [number, number, number][], azimuthDegrees: number): Hinge {
  const top = strut.reduce((best, point) => (point[1] > best[1] ? point : best))
  const foot = strut.reduce((best, point) => (point[1] < best[1] ? point : best))
  const angle = (azimuthDegrees * Math.PI) / 180
  const [x, z] = [Math.sin(angle), Math.cos(angle)]
  const out = (foot[0] - top[0]) * x + (foot[2] - top[2]) * z
  const below = Math.atan2(top[1] - foot[1], out)
  return { pivot: [top[0], top[1], top[2]], axis: [-z, 0, x], angle: below + Math.PI / 2 + FOLDED_PAST_UPRIGHT }
}

// The foils NASSP stretches one image over a whole band of the stage with, which smears their
// creases.
export const FOILS = /(redfoil|goldfoil|silverfo|silverfoKapton)\.dds$/i
const FOIL_METRES = 1.5

// A foil group with its texture laid flat over each triangle - projected along the axis its face
// turns to, one image every 1.5 m (the texture repeats) - every triangle with corners of its own,
// so the projections don't fight at shared corners.
export function foilMapped(group: LmGroup): LmGroup {
  const { positions: p, normals: n, indices } = group
  const count = indices.length
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  for (let t = 0; t < count; t += 3) {
    const corners = [indices[t], indices[t + 1], indices[t + 2]]
    const axis = dominantAxis(corners.map((i) => [n[i * 3], n[i * 3 + 1], n[i * 3 + 2]]))
    const [a, b] = axis === 0 ? [2, 1] : axis === 1 ? [0, 2] : [0, 1]
    corners.forEach((vertex, k) => {
      positions.set(p.subarray(vertex * 3, vertex * 3 + 3), (t + k) * 3)
      normals.set(n.subarray(vertex * 3, vertex * 3 + 3), (t + k) * 3)
      uvs.set([p[vertex * 3 + a] / FOIL_METRES, p[vertex * 3 + b] / FOIL_METRES], (t + k) * 2)
    })
  }
  return { ...group, positions, normals, uvs, indices: Uint32Array.from({ length: count }, (_, i) => i) }
}

// The axis (0 x, 1 y, 2 z) a triangle's corners' normals point along most.
function dominantAxis(normals: number[][]): number {
  const sum = [0, 1, 2].map((k) => Math.abs(normals.reduce((total, normal) => total + normal[k], 0)))
  return sum.indexOf(Math.max(...sum))
}
