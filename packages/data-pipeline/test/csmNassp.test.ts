import { describe, expect, it } from 'vitest'
import { CM_LIFT, cmCockpitAssembly, toCmFrame } from '../src/apollo/csmNassp'
import { CSM_HEIGHTS } from '../src/apollo/csmProfile'
import type { OrbiterGroup } from '../src/spacecraft/orbiterMesh'

const group: OrbiterGroup = {
  label: 'g',
  material: null,
  texture: null,
  // A triangle facing out along (1, 1, 1) in Orbiter's frame, its normals saying so.
  positions: Float32Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1),
  normals: Float32Array.of(0.577, 0.577, 0.577, 0.577, 0.577, 0.577, 0.577, 0.577, 0.577),
  uvs: null,
  indices: Uint32Array.of(0, 1, 2),
}

describe("NASSP's command module cockpit, in Columbia's frame", () => {
  it('stands on its axis (NASSP z is our Y), the side hatch (NASSP +y) toward our +Z, raised onto our heat shield', () => {
    const cm = toCmFrame(group)
    expect(Array.from(cm.positions).map((v) => +v.toFixed(4))).toEqual([1, CM_LIFT, 0, 0, CM_LIFT, 1, 0, CM_LIFT + 1, 0].map((v) => +v.toFixed(4)))
    // NASSP's heat-shield shoulder (z -0.8) lies on ours.
    expect(CM_LIFT - 0.8).toBeCloseTo(CSM_HEIGHTS.cmBase + 0.47, 1)
  })

  it('keeps every face turned the way its normals say', () => {
    const { positions: p, normals: n, indices: [a, b, c] } = toCmFrame(group)
    const u = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k])
    const v = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k])
    const face = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    expect(face[0] * n[0] + face[1] * n[1] + face[2] * n[2]).toBeGreaterThan(0)
  })

  it('sorts the cockpit into its panels, its hatches and the rest', () => {
    for (const label of ['Sw_P1_01', 'CB_LEB_Right1_03', 'FDAIBall1_L', 'DSKY_Frame', 'Meters_P2_P', 'Talkbacks_P', 'Rot_Panel']) expect(cmCockpitAssembly(label)).toBe('vcPanels')
    for (const label of ['SideHatch_3', 'FwdHatch_01', 'SideHatch_Frame']) expect(cmCockpitAssembly(label)).toBe('vcHatches')
    for (const label of ['Group_73_Left', 'WasteDisposalDoor', 'Screws']) expect(cmCockpitAssembly(label)).toBe('vcCabin')
  })
})
