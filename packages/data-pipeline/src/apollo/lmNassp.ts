import { applyHinge, type Hinge, hingeMatrix } from '../../../app/src/spacecraft/modelHinge'
import type { OrbiterGroup } from '../spacecraft/orbiterMesh'
import { type NasspGroup, toOurFrame } from './nasspParts'

// How Project Apollo - NASSP's lunar module (nassp.ts) becomes Eagle's: its groups sorted into our
// assemblies, its frame turned into ours, the legs' hinges found on their struts.
//
// NASSP's meshes are in Orbiter's left-handed frame - x right, y up, z forward - so the Commander
// (on the left) stands at -x. Ours is right-handed with z forward and the Commander at +x: x is
// mirrored. NASSP's "Left" leg is therefore our +X leg (leg1, 90 degrees round from forward), its
// "Right" our -X leg (leg3).

export type LmPart = 'descent' | 'leg0' | 'leg1' | 'leg2' | 'leg3' | 'link0' | 'link1' | 'link2' | 'link3' | 'probes' | 'ascent'
export type CockpitPart = 'cockpit' | 'panels' | 'dsky' | 'windows'

const LEG_SUFFIX: Record<string, LmPart> = { '': 'leg0', Left: 'leg1', Aft: 'leg2', Right: 'leg3' }

// The descent stage's groups: each leg's primary strut, lower strut and footpad (the forward one with
// the ladder and the plaque) turn with the leg; the probes are a part of their own; its braces and downlock - the linkage from
// the stage to the primary strut - have a hinge of their own (linkHinge); the rest is the stage.
const LINK_SUFFIX: Record<string, LmPart> = { '': 'link0', Left: 'link1', Aft: 'link2', Right: 'link3' }
export function descentAssembly(label: string): LmPart {
  const link = /^(Downlock|SupportStruts2)(Left|Aft|Right)?$/.exec(label)
  if (link) return LINK_SUFFIX[link[2] ?? '']
  // The probes were stowed for launch and swung down with the legs: shown only with the legs out.
  if (/^Probes\d/.test(label)) return 'probes'
  const leg = /^(MainStrut|Footpad|LowerStrut)(Left|Aft|Right)?$/.exec(label)
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

export type LmGroup = NasspGroup

// NASSP's plain grey plate on the descent stage's top deck ("BodyTop2", at 0.88 m) lies inside the
// height of the foil over it ("BodyTop", 0.85-0.90 m): the two fought for the picture. It goes a
// little lower, under the foil.
export const DECK_UNDERLAY_DROP = 0.06

// A group in our frame, lifted by `lift` (metres): see nasspParts.ts.
export function toLmFrame(group: OrbiterGroup, lift: number): LmGroup {
  return toOurFrame(group, [0, lift - (group.label === 'BodyTop2' ? DECK_UNDERLAY_DROP : 0), 0])
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

// A brace's hinge: about its foot on the stage (the mean of its points nearest the axis), along the
// leg's own axis, by the angle that keeps its outer end (the points farthest out) pointing at where
// that end goes on the folded leg. Its length doesn't change, so the end only points there: the
// brace stands for the real linkage, which folds at a knee.
export function linkHinge(points: readonly [number, number, number][], leg: Hinge): Hinge {
  const radius = (p: readonly number[]) => Math.hypot(p[0], p[2])
  const radii = points.map(radius)
  const [low, high] = [Math.min(...radii), Math.max(...radii)]
  const mean = (near: number) => {
    const chosen = points.filter((p) => Math.abs(radius(p) - near) < 0.1)
    return [0, 1, 2].map((k) => chosen.reduce((sum, p) => sum + p[k], 0) / chosen.length) as [number, number, number]
  }
  const [foot, end] = [mean(low), mean(high)]
  const folded = applyHinge(hingeMatrix(leg, 1), end)
  const across = (p: readonly number[]) => {
    const d = [p[0] - foot[0], p[1] - foot[1], p[2] - foot[2]]
    const along = d[0] * leg.axis[0] + d[1] * leg.axis[1] + d[2] * leg.axis[2]
    return d.map((v, k) => v - along * leg.axis[k])
  }
  const [a, b] = [across(end), across(folded)]
  const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const sine = cross[0] * leg.axis[0] + cross[1] * leg.axis[1] + cross[2] * leg.axis[2]
  const cosine = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return { pivot: foot, axis: leg.axis, angle: Math.atan2(sine, cosine) }
}
