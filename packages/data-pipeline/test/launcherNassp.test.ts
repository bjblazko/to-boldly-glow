import { describe, expect, it } from 'vitest'
import { applyHinge, hingeMatrix } from '../../app/src/spacecraft/modelHinge'
import { launcherAssembly, mirroredHinge } from '../src/apollo/launcherNassp'

describe("NASSP's mobile launcher, sorted into the lesson's parts", () => {
  it('sorts the groups by their number, as NASSP\'s animations name them', () => {
    expect(['0000_HoldDownArms', '0032_HoldDownArm2'].map(launcherAssembly)).toEqual(['holddown', 'holddown'])
    expect(['0011_Crew_Arm_1', '0012_Crew_Arm_2', '0051_Crew_Arm_Walkway_Transparent'].map(launcherAssembly)).toEqual(['crewArm', 'crewArm', 'crewArm'])
    expect(['0013_Arm_1', '0049_ServiceArm1_Transparent'].map(launcherAssembly)).toEqual(['intertankArm', 'intertankArm'])
    expect(['0014_Arm_2', '0020_Arm_8', '0052_ServiceArm2_Transparent', '0058_ServiceArm8_Transparent'].map(launcherAssembly)).toEqual(['serviceArms', 'serviceArms', 'serviceArms', 'serviceArms'])
    expect(['0003_Mast_3', '0005_Mast_2', '0006_Mast_1', '0030_DamperArm'].map(launcherAssembly)).toEqual(['mast1', 'mast2', 'mast3', 'damperArm'])
    expect(['0001_MLP', '0033_MLP_Railing1', '0046_Pipes1'].map(launcherAssembly)).toEqual(['launcher', 'launcher', 'launcher'])
    expect(['0009_TowerLevels120-380', '0021_ColbyCrane', '0045_TreppeLvl060-380'].map(launcherAssembly)).toEqual(['tower', 'tower', 'tower'])
  })
})

describe('mirroredHinge', () => {
  it('turns a point in our (mirrored, moved) frame as NASSP turns it in its own', () => {
    // NASSP: about the vertical line through (1, 0, 0) by +90 degrees.
    const nassp = { pivot: [1, 0, 0] as [number, number, number], axis: [0, 1, 0] as [number, number, number], degrees: 90 }
    const shift: [number, number, number] = [10, 0, 0]
    const ours = mirroredHinge(nassp, shift)
    // NASSP's own turn of (2, 0, 0): about +Y by +90 degrees the offset (1, 0, 0) goes to (0, 0, -1).
    const theirs: [number, number, number] = [1, 0, -1]
    // The same point and its turned place, both carried into our frame.
    const toOurs = ([x, y, z]: [number, number, number]): [number, number, number] => [-x + shift[0], y + shift[1], z + shift[2]]
    const turned = applyHinge(hingeMatrix(ours, 1), toOurs([2, 0, 0]))
    toOurs(theirs).forEach((value, axis) => expect(turned[axis]).toBeCloseTo(value, 6))
  })
})
