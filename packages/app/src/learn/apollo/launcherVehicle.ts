import { msg } from '../../i18n/i18n'
import type { VehicleConfig } from '../vehicle/vehicleConfig'
import { VEHICLE_ROOM_FACING, vehicleShot, type VehicleFrame } from '../vehicle/vehicleCamera'

// The assemblies of the launcher lesson's two models (see the data pipeline's
// apollo/launcherNassp.ts and buildLauncher.ts): Project Apollo - NASSP's mobile launcher with our
// Saturn V on it, and its crawler-transporter.
export type LauncherPart =
  | 'launcher' | 'holddown' | 'mast1' | 'mast2' | 'mast3' | 'cover1' | 'cover2' | 'cover3' | 'tower' | 'damperArm' | 'crewArm' | 'serviceArms' | 'intertankArm' | 'rocket' | 'person'
  | 'crawler' | 'slidewire'

// The rocket's axis on the origin, the launcher's bottom on the floor, its deck 8.4 m up; the tower
// stands behind the rocket (+Z, 17 to 33 m out); its steel reaches 123 m, its crane 141 m. The arms
// (measured on the built model): the S-IC intertank arm about 25 m up, the other service arms up to
// 100 m, the crew access arm and the damper arm at 105-107 m. On the crawler everything rises 6.2 m.
const FRAMES: Record<string, VehicleFrame> = {
  whole: { height: 70, radius: 260, reach: 78, halfWidth: 48 },
  tower: { target: [0, 75, 20], radius: 165, reach: 72, halfWidth: 26, height: 0 },
  arms: { target: [-3, 72, 8], radius: 105, reach: 46, halfWidth: 20, height: 0, elevation: 0.2 },
  crewArm: { target: [-5, 104, 6], radius: 38, reach: 8, halfWidth: 10, height: 0, elevation: 0.15 },
  base: { target: [0, 12, 2], radius: 62, reach: 13, halfWidth: 24, height: 0, elevation: 0.3 },
  crawler: { target: [0, 12, 9.5], radius: 95, reach: 20, halfWidth: 34, height: 0, elevation: 0.18 },
  liftoff: { height: 68, radius: 230, reach: 74, halfWidth: 46 },
}

export const LAUNCHER: VehicleConfig = {
  models: [
    { url: 'models/launcher', name: 'launcher', materials: { tower: { shininess: 20, shine: 0.2 }, rocket: { shininess: 30, shine: 0.3 } } },
    { url: 'models/launcher', name: 'crawler', materials: { crawler: { shininess: 16, shine: 0.15 } } },
  ],
  // One turn every three minutes: the tower comes round behind the rocket and back.
  turntable: { secondsPerTurn: 180, startAngle: 0.6, stageSeconds: 2.8 },
  room: { facing: VEHICLE_ROOM_FACING, size: { halfWidth: 50, height: 150, minor: 5, major: 10 } },
  occlusionReach: 2,
  shot: (id) => vehicleShot(`launcher-${id}`, FRAMES[id] ?? FRAMES.whole),
  partName: (part) => msg.lessons.launcher.parts[part as LauncherPart],
  mark: (name) => msg.lessons.launcher.marks[name] ?? { label: name },
}
