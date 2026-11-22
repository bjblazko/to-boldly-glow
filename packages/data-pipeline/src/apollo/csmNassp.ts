import type { OrbiterGroup } from '../spacecraft/orbiterMesh'
import { CSM_HEIGHTS } from './csmProfile'
import { type NasspGroup, toOurFrame } from './nasspParts'

// How Project Apollo - NASSP's command module cockpit (CM-VC.msh, and its couches) becomes
// Columbia's: its groups sorted into our assemblies, its frame turned into ours.
//
// NASSP's command module lies along its z (the forward hatch at +z), the side hatch toward +y, in
// Orbiter's left-handed frame. Ours stands on Y with the side hatch toward +Z: NASSP's z is our Y,
// its y our Z, its x our X - which turns the left-handed frame into our right-handed one without a
// mirror (the faces keep their winding once toOurFrame's mirror is undone).

export type CmCockpitPart = 'vcCabin' | 'vcPanels' | 'vcHatches' | 'vcCouches'

// NASSP's heat-shield shoulder (the widest ring, at z -0.80 in CM.msh) on ours: the heat shield's
// depth and its shoulder above the command module's base (csmProfile.ts, 0.35 + 0.12 m).
const NASSP_SHOULDER = -0.8
export const CM_LIFT = CSM_HEIGHTS.cmBase + 0.47 - NASSP_SHOULDER

export function toCmFrame(group: OrbiterGroup): NasspGroup {
  const mirrored = toOurFrame(group, [0, 0, 0])
  const turn = (values: Float32Array, lift: number) => {
    const turned = new Float32Array(values.length)
    for (let i = 0; i < values.length; i += 3) turned.set([-values[i], values[i + 2] + lift, values[i + 1]], i)
    return turned
  }
  // Undoing the mirror and swapping two axes are two reflections: the winding toOurFrame set holds.
  return { ...mirrored, positions: turn(mirrored.positions, CM_LIFT), normals: turn(mirrored.normals, 0) }
}

// The cockpit's groups: the switches, breakers, talkbacks, meters, displays and their panels; the
// two hatches; the rest (the walls, stowage, the optics' housing).
export function cmCockpitAssembly(label: string): CmCockpitPart {
  if (/^(SideHatch|FwdHatch)/.test(label)) return 'vcHatches'
  const panel = /^(Sw_|SwitchBody|SwitchCover|SwitchGuard|CB_|TW_|Talkbacks|Rot_|PB_|DSKY|FDAI|Meters|Needle|Timer|MissionTimer|EventTimer|CW_Lights|Caution|EMS|LV_ENG|LVEngine|AbortLight|Accelerometer|Altimeter|AttitudeSet|RSI_|SCS_|SPS_ENG|ORDEAL|LEB_Condition|MasterAlarm|Panel|Group_0_03)/
  return panel.test(label) ? 'vcPanels' : 'vcCabin'
}
