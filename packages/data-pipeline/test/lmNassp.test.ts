import { describe, expect, it } from 'vitest'
import { applyHinge, hingeMatrix } from '../../app/src/spacecraft/modelHinge'
import { ascentAssembly, cockpitAssembly, DECK_UNDERLAY_DROP, descentAssembly, foldingHinge, foilMapped, linkHinge, toLmFrame } from '../src/apollo/lmNassp'
import type { OrbiterGroup } from '../src/spacecraft/orbiterMesh'

describe("NASSP's lunar module, sorted into Eagle's parts", () => {
  it('gives each leg its strut, lower strut, footpad (the ladder and plaque on the forward one), its braces a linkage of their own, the probes theirs', () => {
    expect(['MainStrut', 'Footpad', 'Ladder', 'zPlaque'].map(descentAssembly)).toEqual(['leg0', 'leg0', 'leg0', 'leg0'])
    // NASSP's "Left" lies on Orbiter's -X, our +X: the Commander's side (leg1, 90 degrees round).
    expect(['MainStrutLeft', 'FootpadAft', 'MainStrutRight'].map(descentAssembly)).toEqual(['leg1', 'leg2', 'leg3'])
    expect(['LowerStrutAft', 'LowerStrut'].map(descentAssembly)).toEqual(['leg2', 'leg0'])
    expect(['Probes1Right', 'Probes2Aft'].map(descentAssembly)).toEqual(['probes', 'probes'])
    expect(['Downlock', 'SupportStruts2Left', 'DownlockAft', 'SupportStruts2Right'].map(descentAssembly)).toEqual(['link0', 'link1', 'link2', 'link3'])
    expect(['BodyMain', 'SidePanels3', 'DPSbell', 'FrontPorch', 'zzLR_Antenna'].map(descentAssembly)).toEqual(['descent', 'descent', 'descent', 'descent', 'descent'])
  })

  it('keeps the ascent stage\'s outside and leaves its rough interior to the cockpit model', () => {
    expect(['HullMain', 'Windows', 'Drogue', 'RCSnozzles', 'VHF3'].map(ascentAssembly)).toEqual(['ascent', 'ascent', 'ascent', 'ascent', 'ascent'])
    expect(['HullInterior', 'CDR1', 'LMP91', 'zCDR11', 'CabinStrut'].map(ascentAssembly)).toEqual([null, null, null, null, null])
  })

  it('sorts the cockpit into its panels, the guidance computer, the windows and the rest', () => {
    expect(['Sw_P1_01', 'CB_P11R1_01', 'SwitchHolder_P3', 'TW_P8_01', 'XpointerX_cdr'].map(cockpitAssembly)).toEqual(['panels', 'panels', 'panels', 'panels', 'panels'])
    expect(['Windows', 'WindowsInner', 'WindowsRim'].map(cockpitAssembly)).toEqual(['windows', 'windows', 'windows'])
    expect(['ArmRest_CDR', 'Bags_Shelf', 'UpperHatch'].map(cockpitAssembly)).toEqual(['cockpit', 'cockpit', 'cockpit'])
  })
})

describe('toLmFrame', () => {
  const group: OrbiterGroup = {
    label: 'g',
    material: null,
    texture: null,
    positions: Float32Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1),
    normals: Float32Array.of(1, 0, 0, 1, 0, 0, 1, 0, 0),
    uvs: null,
    indices: Uint32Array.of(0, 1, 2),
  }

  it('mirrors Orbiter\'s left-handed frame (x to -x), lifts it, and keeps the faces turned outward', () => {
    const lm = toLmFrame(group, 2)
    expect(Array.from(lm.positions)).toEqual([-1, 2, 0, 0, 3, 0, 0, 2, 1])
    expect(Array.from(lm.normals.subarray(0, 3))).toEqual([-1, 0, 0])
    expect(Array.from(lm.indices)).toEqual([0, 2, 1])
  })
})

describe('foldingHinge', () => {
  it('folds a leg from its strut\'s top so that its foot comes up beside the stage, inside the adapter', () => {
    // A leg on +Z: the strut's top 2.9 m out and 3 m up, the footpad 4.3 m out on the ground.
    const strut: [number, number, number][] = [[0, 3, 2.9], [0, 0.2, 4.3]]
    const hinge = foldingHinge(strut, 0)
    const foot = applyHinge(hingeMatrix(hinge, 1), [0, 0.2, 4.3])
    expect(foot[1]).toBeGreaterThan(3)
    expect(Math.hypot(foot[0], foot[2])).toBeLessThan(2.85)
  })
})

describe('foilMapped', () => {
  // A square 3 m across standing upright, facing +Z (two triangles sharing two corners), its
  // texture stretched once across it.
  const square = {
    label: 'BodyBottom', material: null, texture: 'ProjectApollo\\redfoil.dds',
    positions: Float32Array.of(0, 0, 0, 3, 0, 0, 3, 3, 0, 0, 3, 0),
    normals: Float32Array.of(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1),
    uvs: Float32Array.of(0, 0, 1, 0, 1, 1, 0, 1),
    indices: Uint32Array.of(0, 1, 2, 0, 2, 3),
  }

  it('lays the foil flat over each face at one image per 1.5 m, every triangle its own corners', () => {
    const mapped = foilMapped(square)
    expect(mapped.indices.length).toBe(6)
    expect(mapped.positions.length).toBe(18)
    // The corner at x 3, y 3 lies two images across and two up.
    const corner = [...Array(6).keys()].find((i) => mapped.positions[i * 3] === 3 && mapped.positions[i * 3 + 1] === 3) ?? -1
    expect([mapped.uvs?.[corner * 2], mapped.uvs?.[corner * 2 + 1]].map((value) => Math.abs(value ?? 0))).toEqual([2, 2])
  })
})

describe('linkHinge', () => {
  it('turns a brace about its foot on the stage so that its other end follows the folding leg', () => {
    // A leg turning a quarter turn about a line along X through (0, 2, 1); a brace from the stage at
    // (0, 1, 0.5) out to the leg at (0, 1, 1.5).
    const leg = { pivot: [0, 2, 1] as [number, number, number], axis: [1, 0, 0] as [number, number, number], angle: Math.PI / 2 }
    const brace: [number, number, number][] = [[0, 1, 0.5], [0, 1, 0.52], [0, 1, 1.48], [0, 1, 1.5]]
    const hinge = linkHinge(brace, leg)
    expect(hinge.pivot).toEqual([0, 1, 0.51])
    const outer = applyHinge(hingeMatrix(leg, 1), [0, 1, 1.49])
    const moved = applyHinge(hingeMatrix(hinge, 1), [0, 1, 1.49])
    const direction = (p: number[]) => { const d = [p[0] - 0, p[1] - 1, p[2] - 0.51]; const l = Math.hypot(...d); return d.map((v) => v / l) }
    const [a, b] = [direction(outer), direction(moved)]
    expect(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]).toBeCloseTo(1, 6)
  })
})

describe('the descent stage’s top deck', () => {
  it('lies under its foil, not in it: NASSP’s plain grey deck plate sits inside the foil’s height and flickered through it', () => {
    const plate: OrbiterGroup = { label: 'BodyTop2', material: null, texture: null, positions: Float32Array.of(0, 0.88, 0, 1, 0.88, 0, 0, 0.88, 1), normals: null, uvs: null, indices: Uint32Array.of(0, 1, 2) }
    const placed = toLmFrame(plate, 0)
    expect(placed.positions[1]).toBeCloseTo(0.88 - DECK_UNDERLAY_DROP, 6)
    expect(0.88 - DECK_UNDERLAY_DROP).toBeLessThan(0.85)
  })
})

