import type { Hinge } from '../../../app/src/spacecraft/modelHinge'

// How Project Apollo - NASSP's mobile launcher (Meshes/ProjectApollo/Saturn5ML.msh) becomes the
// lesson's: its groups sorted into our assemblies by the numbers NASSP's own animations name them
// with (src_launch/ML.cpp), and those animations' pivots, axes and angles carried into our frame.

export const LAUNCHER_PARTS = ['launcher', 'holddown', 'mast1', 'mast2', 'mast3', 'cover1', 'cover2', 'cover3', 'tower', 'damperArm', 'crewArm', 'serviceArms', 'intertankArm'] as const
export type LauncherPart = (typeof LAUNCHER_PARTS)[number]

// By group number (the label's first four digits), as ML.cpp's animations list them: the crew
// access arm (11, 12, 51); the S-IC intertank arm (13, 49); the other service arms, which all
// turn about one line (14-20, 52-58); the damper arm (30); the three tail service masts (3, 5, 6) and their covers (39, 38, 37);
// the hold-down arms; the launcher's base with its railings and pipes; the rest is the tower.
const GROUPS: Record<Exclude<LauncherPart, 'tower'>, readonly number[]> = {
  holddown: [0, 32],
  mast1: [3],
  mast2: [5],
  mast3: [6],
  cover1: [39],
  cover2: [38],
  cover3: [37],
  crewArm: [11, 12, 51],
  intertankArm: [13, 49],
  serviceArms: [14, 15, 16, 17, 18, 19, 20, 52, 53, 54, 55, 56, 57, 58],
  damperArm: [30],
  launcher: [1, 2, 4, 28, 33, 34, 35, 36, 46],
}

export function launcherAssembly(label: string): LauncherPart {
  const number = Number.parseInt(label.slice(0, 4), 10)
  const found = (Object.entries(GROUPS) as [LauncherPart, readonly number[]][]).find(([, numbers]) => numbers.includes(number))
  return found ? found[0] : 'tower'
}

// A turn as NASSP's animations give it, in Orbiter's frame: about the line through `pivot` along
// `axis` by `degrees`.
export interface NasspTurn {
  pivot: [number, number, number]
  axis: [number, number, number]
  degrees: number
}

// ML.cpp's animations, retracted: the service arms swing 71 degrees, the crew access arm 195, the
// damper arm 90, the tail service masts fold 72 degrees about their tilted axes and their covers
// open 75 degrees the other way.
export const LAUNCHER_TURNS: Partial<Record<LauncherPart, NasspTurn>> = {
  crewArm: { pivot: [8.7432, 39.8173, 8.9631], axis: [0, 1, 0], degrees: -195 },
  serviceArms: { pivot: [5.5716, -16.5039, 6.1556], axis: [0, 1, 0], degrees: 71 },
  intertankArm: { pivot: [5.5646, -39.9844, 5.2651], axis: [0, 1, 0], degrees: 71 },
  damperArm: { pivot: [0.2221, 42.102, 6.8092], axis: [1, 0, 0], degrees: 90 },
  mast1: { pivot: [8.664, -54.1755, -6.2681], axis: [0.2543, 0, -0.9671], degrees: 72 },
  mast2: { pivot: [-8.7285, -54.1755, -7.1316], axis: [0.2819, 0, 0.9594], degrees: 72 },
  mast3: { pivot: [-8.3939, -54.1755, -12.3403], axis: [-0.2664, 0, 0.9639], degrees: 72 },
  cover1: { pivot: [8.5142, -50.4372, -6.1115], axis: [0.2509, 0, -0.968], degrees: -75 },
  cover2: { pivot: [-8.6822, -50.4372, -7.3419], axis: [0.2864, 0, 0.9581], degrees: -75 },
  cover3: { pivot: [-8.2421, -50.4372, -12.4947], axis: [-0.263, 0, 0.9648], degrees: -75 },
}

// The turn in our frame (x mirrored, then moved by `shift`, as nasspParts.ts's toOurFrame moves the
// points): a mirror turns the other way round its mirrored axis.
export function mirroredHinge({ pivot, axis, degrees }: NasspTurn, shift: readonly [number, number, number]): Hinge {
  return {
    pivot: [-pivot[0] + shift[0], pivot[1] + shift[1], pivot[2] + shift[2]],
    axis: [-axis[0], axis[1], axis[2]],
    angle: (-degrees * Math.PI) / 180,
  }
}
