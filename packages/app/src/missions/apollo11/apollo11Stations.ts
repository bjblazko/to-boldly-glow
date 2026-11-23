import type { TourStation } from './apollo11Clock'

// The Apollo 11 tour's stations (spec 2026-11-23-apollo11-tour-design.md): each one's stretch of
// the mission (GET), its length in the tour and the moments it shows in real time - an event's
// moment with some seconds before and after it. Times from apollo11Events.ts (Apollo by the
// Numbers); the path ends at entry interface, so the last station does too.

const T = (hours: number, minutes: number, seconds = 0) => hours * 3600 + minutes * 60 + seconds
// A real-time window around a moment: `before` and `after` seconds.
const around = (moment: number, before: number, after: number) => ({ from: moment - before, to: moment + after })

export const APOLLO11_STATIONS: TourStation[] = [
  { id: 'earthOrbit', from: T(0, 11, 49.33), to: T(2, 44), seconds: 50 },
  { id: 'tli', from: T(2, 44), to: T(3, 15), seconds: 90, realTime: [around(T(2, 44, 16.2), 10, 20)] },
  {
    id: 'docking',
    from: T(3, 15),
    to: T(4, 20),
    seconds: 120,
    realTime: [around(T(3, 15, 23), 8, 22), around(T(3, 24, 3.7), 25, 15), around(T(4, 17, 3), 10, 15)],
  },
  { id: 'coast', from: T(4, 40), to: T(75, 40), seconds: 60 },
  { id: 'loi', from: T(75, 45), to: T(80, 20), seconds: 70, realTime: [around(T(75, 49, 50.37), 5, 20)] },
  { id: 'undocking', from: T(100, 11, 30), to: T(101, 40), seconds: 70, realTime: [around(T(100, 12), 10, 20), around(T(101, 36, 14), 10, 10)] },
  { id: 'landing', from: T(102, 33), to: T(102, 46, 10), seconds: 180, realTime: [{ from: T(102, 44, 30), to: T(102, 46, 10) }] },
  { id: 'firstStep', from: T(109, 23), to: T(109, 25, 15), seconds: 90, realTime: [around(T(109, 24, 15), 25, 60)] },
  { id: 'columbiaAlone', from: T(109, 40), to: T(124, 10), seconds: 35 },
  { id: 'liftoff', from: T(124, 20), to: T(124, 40), seconds: 120, realTime: [around(T(124, 22, 0.79), 10, 50)] },
  { id: 'rendezvous', from: T(125, 15), to: T(128, 4), seconds: 120, realTime: [around(T(128, 3), 30, 20)] },
  { id: 'tei', from: T(135, 20), to: T(194, 40), seconds: 70, realTime: [around(T(135, 23, 42.28), 10, 20)] },
  { id: 'entry', from: T(194, 45), to: T(195, 3, 5.7), seconds: 120, realTime: [around(T(194, 49, 12.7), 10, 15), around(T(195, 3, 5.7), 15, 0)] },
]

// The original audio at its station: the Apollo 11 lesson's clips (learn/lessons/apollo11Audio.json).
export const APOLLO11_ORIGINAL: Partial<Record<string, string>> = { tli: 'tli', landing: 'landing', firstStep: 'surface', liftoff: 'liftoff' }
