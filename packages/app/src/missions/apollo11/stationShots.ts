import type { Vec3 } from '../../math/tuples'
import type { Craft } from './apollo11Scene'
import type { ShotSpec } from './shots'

// Each station's shots, in order: a list played round, each for its seconds, cut hard from one to
// the next - and moments pinned to the mission time (the landing's last seconds from the ground).
// Points on the models (m, their own frames, +Y up their axis): Columbia's nose and engine bell,
// the third stage's engine below it in the stack, Eagle's top and its ladder side. APPROX.

const T = (hours: number, minutes: number, seconds = 0) => hours * 3600 + minutes * 60 + seconds

export interface PlannedShot {
  spec: ShotSpec
  seconds: number
  // Whose shot it is (the station's own craft where not given).
  subject?: Craft
}

export interface PinnedShot extends PlannedShot {
  // Mission time (GET) it covers.
  from: number
  to: number
}

export interface StationShots {
  focus: Craft
  shots: PlannedShot[]
  pinned?: PinnedShot[]
}

const CM_NOSE: Vec3 = [0, 10.4, 0]
const HEAT_SHIELD: Vec3 = [0, 7.2, 0]
const SPS_BELL: Vec3 = [0, 0.6, 0]
const SM_SIDE_EYE: Vec3 = [2.6, 1.2, 0.9]
const SIVB_ENGINE: Vec3 = [0, -22, 0]
const SIVB_SIDE_EYE: Vec3 = [3.6, -24, 1.2]
const LM_TOP: Vec3 = [0, 6.8, 0]
const LM_LADDER: Vec3 = [0, 1.4, 4.3]
const FOOTPAD_EYE: Vec3 = [4.6, 0.6, 4.6]
// From Columbia's left rendezvous window, ahead along its nose.
const COLUMBIA_WINDOW: Vec3 = [0.6, 10.2, 0.4]
const EAGLE_WINDOW: Vec3 = [0.4, 5.6, 1.2]

// orbit(lens, [distance m, azimuth°, elevation°, drift °/s])
const orbit = (lens: ShotSpec['lens'], [distance, azimuth, elevation, drift = 0]: number[]): ShotSpec => ({ kind: 'orbit', lens, distance, azimuth, elevation, drift })
const body = (lens: ShotSpec['lens'], which: 'earth' | 'moon' | 'sun', share: number, aside = 0.5): ShotSpec => ({ kind: 'body', lens, body: which, share, aside })
// detail(lens, point, [distance m, azimuth°, elevation°])
const detail = (lens: ShotSpec['lens'], point: Vec3, [distance, azimuth, elevation]: number[]): ShotSpec => ({ kind: 'detail', lens, point, distance, azimuth, elevation })
const hull = (lens: ShotSpec['lens'], eye: Vec3, look: Vec3): ShotSpec => ({ kind: 'hull', lens, eye, look })
const ground = (lens: ShotSpec['lens'], east: number, north: number, height: number): ShotSpec => ({ kind: 'ground', lens, east, north, height })
const shot = (spec: ShotSpec, seconds: number, subject?: Craft): PlannedShot => ({ spec, seconds, subject })

export const STATION_SHOTS: Record<string, StationShots> = {
  earthOrbit: {
    focus: 'columbia',
    shots: [shot(body('ultraWide', 'earth', 0.03, 0.6), 7), shot(hull('wide', SIVB_SIDE_EYE, CM_NOSE), 6), shot(orbit('normal', [70, 150, 20]), 6), shot(body('longTele', 'earth', 0.08, 0.3), 6), shot(orbit('tele', [400, 60, -10, 1.5]), 7)],
  },
  tli: {
    focus: 'columbia',
    shots: [shot(detail('tele', SIVB_ENGINE, [45, 20, -15]), 8), shot(orbit('wide', [60, 10, 12]), 6), shot(body('ultraWide', 'earth', 0.02, 0.6), 8), shot(orbit('longTele', [3000, 160, 5]), 6), shot(hull('wide', SIVB_SIDE_EYE, CM_NOSE), 6)],
    pinned: [{ from: T(2, 44, 6), to: T(2, 44, 30), spec: detail('tele', SIVB_ENGINE, [40, 25, -10]), seconds: 24 }],
  },
  docking: {
    focus: 'columbia',
    shots: [shot(orbit('wide', [45, 70, 15]), 7), shot(detail('tele', CM_NOSE, [30, 80, 5]), 6), shot(orbit('normal', [120, 200, 25]), 6), shot(body('tele', 'earth', 0.06, 0.6), 6), shot(orbit('ultraWide', [22, 100, -20]), 6)],
  },
  coast: {
    focus: 'columbia',
    shots: [shot(body('ultraWide', 'earth', 0.03, 0.6), 7), shot(body('longTele', 'moon', 0.03, 0.3), 7), shot(orbit('normal', [60, 120, 15, 3]), 7), shot(body('tele', 'sun', 0.05, 0.6), 6), shot(hull('ultraWide', SM_SIDE_EYE, CM_NOSE), 6)],
  },
  loi: {
    focus: 'columbia',
    shots: [shot(body('ultraWide', 'moon', 0.03, 0.6), 7), shot(detail('tele', SPS_BELL, [35, 170, -5]), 6), shot(body('longTele', 'moon', 0.04, 0.3), 7), shot(hull('wide', SM_SIDE_EYE, SPS_BELL), 6)],
  },
  undocking: {
    focus: 'eagle',
    shots: [shot(orbit('wide', [40, 60, 20]), 7), shot({ kind: 'watch', lens: 'normal', from: COLUMBIA_WINDOW }, 7), shot(body('ultraWide', 'moon', 0.03, 0.6), 7), shot(orbit('tele', [300, 200, 10]), 6), shot(detail('tele', FOOTPAD_EYE, [25, 40, 10]), 5)],
  },
  landing: {
    focus: 'eagle',
    shots: [shot(orbit('normal', [70, 150, 15]), 7), shot(body('ultraWide', 'moon', 0.04, 0.3), 7), shot(orbit('tele', [400, 90, -5]), 6), shot(detail('tele', FOOTPAD_EYE, [30, 40, 0]), 6), shot(orbit('wide', [40, 200, 30, 2]), 7)],
    pinned: [
      { from: T(102, 44, 30), to: T(102, 45, 10), spec: ground('wide', -180, 60, 1.7), seconds: 40 },
      { from: T(102, 45, 10), to: T(102, 46, 10), spec: ground('normal', 70, -40, 1.7), seconds: 60 },
    ],
  },
  firstStep: {
    focus: 'eagle',
    shots: [shot(ground('wide', 40, 25, 1.6), 8), shot(detail('tele', LM_LADDER, [20, 180, 5]), 7), shot(ground('ultraWide', 12, -8, 1.2), 7), shot(ground('tele', -260, 140, 1.7), 7)],
  },
  columbiaAlone: {
    focus: 'columbia',
    shots: [shot(body('longTele', 'moon', 0.015, 0.3), 9), shot(orbit('ultraWide', [30, 120, -25]), 7), shot(detail('tele', CM_NOSE, [25, 100, 10]), 6), shot(body('ultraWide', 'earth', 0.02, 0.6), 8)],
  },
  liftoff: {
    focus: 'eagle',
    shots: [shot(orbit('normal', [60, 120, 10]), 7), shot(body('ultraWide', 'moon', 0.04, 0.3), 7), shot(detail('tele', LM_TOP, [30, 60, 30]), 6), shot(orbit('tele', [500, 200, -5]), 6)],
    pinned: [{ from: T(124, 21, 50), to: T(124, 22, 30), spec: ground('wide', 60, 45, 1.7), seconds: 40 }],
  },
  rendezvous: {
    focus: 'eagle',
    shots: [shot(body('longTele', 'moon', 0.02, 0.3), 7), shot({ kind: 'watch', lens: 'tele', from: COLUMBIA_WINDOW }, 7), shot(orbit('wide', [60, 30, 15]), 6), shot(orbit('normal', [200, 200, 20, 2]), 7)],
    pinned: [{ from: T(128, 2, 30), to: T(128, 3, 20), spec: { kind: 'watch', lens: 'normal', from: EAGLE_WINDOW }, seconds: 50, subject: 'columbia' }],
  },
  tei: {
    focus: 'columbia',
    shots: [shot(detail('tele', SPS_BELL, [35, 160, -8]), 7), shot(body('ultraWide', 'moon', 0.03, 0.6), 7), shot(body('longTele', 'earth', 0.05, 0.3), 7), shot(hull('ultraWide', SM_SIDE_EYE, CM_NOSE), 6)],
  },
  entry: {
    focus: 'columbia',
    shots: [shot(body('ultraWide', 'earth', 0.05, 0.6), 7), shot(orbit('normal', [50, 120, 10]), 6), shot(body('tele', 'earth', 0.08, 0.3), 6), shot(orbit('wide', [30, 30, 15]), 6), shot(detail('tele', HEAT_SHIELD, [18, 20, 10]), 6)],
  },
}
