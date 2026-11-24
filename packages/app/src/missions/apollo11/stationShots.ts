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
// In the stack (Columbia's frame) the third stage hangs below: its J-2's bell from 24 m to 19 m down.
const SIVB_ENGINE: Vec3 = [0, -22, 0]
const SIVB_SIDE_EYE: Vec3 = [3.9, -17, 1.3]
const LM_TOP: Vec3 = [0, 6.8, 0]
const LM_LADDER: Vec3 = [0, 1.4, 4.3]
const FOOTPAD_EYE: Vec3 = [4.6, 0.6, 4.6]
// From Columbia's left rendezvous window, ahead along its nose.
const COLUMBIA_WINDOW: Vec3 = [0.6, 10.2, 0.4]

// orbit(lens, [distance m, azimuth°, elevation°, drift °/s])
const orbit = (lens: ShotSpec['lens'], [distance, azimuth, elevation, drift = 0]: number[]): ShotSpec => ({ kind: 'orbit', lens, distance, azimuth, elevation, drift })
const body = (lens: ShotSpec['lens'], which: 'earth' | 'moon' | 'sun', share: number, aside = 0.5): ShotSpec => ({ kind: 'body', lens, body: which, share, aside })
// detail(lens, point, [distance m, azimuth°, elevation°])
const detail = (lens: ShotSpec['lens'], point: Vec3, [distance, azimuth, elevation]: number[]): ShotSpec => ({ kind: 'detail', lens, point, distance, azimuth, elevation })
const hull = (lens: ShotSpec['lens'], eye: Vec3, look: Vec3): ShotSpec => ({ kind: 'hull', lens, eye, look })
const ground = (lens: ShotSpec['lens'], east: number, north: number, height: number): ShotSpec => ({ kind: 'ground', lens, east, north, height })
const shot = (spec: ShotSpec, seconds: number, subject?: Craft): PlannedShot => ({ spec, seconds, subject })

// Mostly cameras near by in good light - from the side, a little from behind, as at the landing's
// long-lens view - now and then a close-up or one against the hull, and a far shot at most once a
// station: a figure used rarely. Over the Moon the far shot is a long lens from a kilometre or two,
// just below the craft's height: the craft small against black sky over the Moon's horizon (a body
// shot there would show only grey ground).
export const STATION_SHOTS: Record<string, StationShots> = {
  earthOrbit: {
    focus: 'columbia',
    shots: [shot(orbit('tele', [350, 60, 8]), 7), shot(hull('wide', SIVB_SIDE_EYE, CM_NOSE), 6), shot(orbit('normal', [80, 150, 20]), 7), shot(body('ultraWide', 'earth', 0.04, 0.6), 7), shot(orbit('wide', [40, 40, -15]), 6), shot(detail('normal', SIVB_ENGINE, [30, 30, -20]), 6)],
  },
  tli: {
    focus: 'columbia',
    shots: [shot(orbit('tele', [300, 30, 5]), 7), shot(detail('normal', SIVB_ENGINE, [35, 20, -15]), 7), shot(orbit('normal', [70, 140, 15]), 7), shot(body('ultraWide', 'earth', 0.03, 0.6), 7), shot(orbit('wide', [40, 300, 10]), 6), shot(hull('ultraWide', SIVB_SIDE_EYE, CM_NOSE), 6)],
    pinned: [{ from: T(2, 44, 6), to: T(2, 44, 30), spec: detail('normal', SIVB_ENGINE, [40, 25, -10]), seconds: 24 }],
  },
  docking: {
    focus: 'columbia',
    shots: [shot(orbit('normal', [60, 70, 15]), 7), shot(detail('tele', CM_NOSE, [60, 80, 5]), 6), shot(orbit('tele', [250, 200, 15]), 7), shot(orbit('wide', [30, 100, -20]), 6), shot(body('tele', 'earth', 0.06, 0.6), 6)],
  },
  coast: {
    focus: 'columbia',
    shots: [shot(orbit('tele', [300, 40, 10]), 7), shot(body('longTele', 'moon', 0.03, 0.3), 8), shot(orbit('normal', [70, 120, 15]), 7), shot(hull('ultraWide', SM_SIDE_EYE, CM_NOSE), 6)],
  },
  loi: {
    focus: 'columbia',
    shots: [shot(orbit('tele', [350, 120, 5]), 7), shot(detail('normal', SPS_BELL, [30, 170, -5]), 6), shot(orbit('normal', [70, 60, 10]), 7), shot(orbit('longTele', [1500, 100, -4]), 7), shot(orbit('wide', [40, 200, -10]), 6)],
  },
  undocking: {
    focus: 'eagle',
    shots: [shot(orbit('normal', [60, 60, 20]), 7), shot({ kind: 'watch', lens: 'wide', from: COLUMBIA_WINDOW }, 7), shot(orbit('tele', [300, 200, 10]), 7), shot(detail('normal', FOOTPAD_EYE, [20, 40, 10]), 6), shot(orbit('longTele', [1500, 250, -3]), 7)],
  },
  landing: {
    focus: 'eagle',
    shots: [shot(orbit('tele', [400, 90, -5]), 7), shot(orbit('normal', [70, 150, 15]), 7), shot(detail('tele', FOOTPAD_EYE, [60, 40, 0]), 6), shot(orbit('longTele', [1200, 80, -3]), 7), shot(orbit('wide', [40, 200, 30]), 6)],
    pinned: [
      { from: T(102, 44, 30), to: T(102, 45, 10), spec: ground('wide', -180, 60, 1.7), seconds: 40 },
      { from: T(102, 45, 10), to: T(102, 46, 10), spec: ground('normal', 70, -40, 1.7), seconds: 60 },
    ],
  },
  firstStep: {
    focus: 'eagle',
    shots: [shot(ground('wide', 40, 25, 1.6), 8), shot(detail('normal', LM_LADDER, [12, 180, 5]), 7), shot(ground('ultraWide', 12, -8, 1.2), 7), shot(ground('tele', -260, 140, 12), 7)],
  },
  columbiaAlone: {
    focus: 'columbia',
    shots: [shot(orbit('tele', [350, 60, 10]), 9), shot(orbit('longTele', [2000, 240, -3]), 9), shot(orbit('normal', [60, 150, 15]), 8), shot(detail('tele', CM_NOSE, [50, 100, 10]), 6)],
  },
  liftoff: {
    focus: 'eagle',
    shots: [shot(orbit('normal', [60, 120, 10]), 7), shot(orbit('tele', [400, 200, -5]), 7), shot(detail('normal', LM_TOP, [20, 60, 30]), 6), shot(orbit('longTele', [1500, 300, -3]), 7)],
    pinned: [{ from: T(124, 21, 50), to: T(124, 22, 30), spec: ground('wide', 60, 45, 1.7), seconds: 40 }],
  },
  rendezvous: {
    focus: 'eagle',
    shots: [shot(orbit('tele', [300, 40, 10]), 7), shot({ kind: 'watch', lens: 'normal', from: COLUMBIA_WINDOW }, 7), shot(orbit('wide', [40, 200, 20]), 7), shot(orbit('longTele', [1800, 120, -3]), 7), shot(orbit('normal', [70, 30, 15]), 6)],
    pinned: [{ from: T(128, 2, 30), to: T(128, 3, 20), spec: orbit('normal', [45, 90, 12]), seconds: 50, subject: 'columbia' }],
  },
  tei: {
    focus: 'columbia',
    shots: [shot(orbit('tele', [300, 160, 5]), 7), shot(detail('normal', SPS_BELL, [30, 160, -8]), 6), shot(orbit('wide', [45, 60, 10]), 7), shot(body('ultraWide', 'moon', 0.03, 0.6), 7), shot(hull('ultraWide', SM_SIDE_EYE, CM_NOSE), 6)],
  },
  entry: {
    focus: 'columbia',
    shots: [shot(orbit('normal', [60, 120, 10]), 7), shot(body('ultraWide', 'earth', 0.05, 0.6), 7), shot(orbit('tele', [300, 30, 5]), 6), shot(detail('normal', HEAT_SHIELD, [20, 20, 10]), 6), shot(orbit('wide', [35, 200, 15]), 6)],
  },
}
