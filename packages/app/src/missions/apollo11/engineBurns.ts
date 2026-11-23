import type { Vec3 } from '../../math/tuples'

// When which engine burned, and where its nozzle is: the third stage's J-2 for TLI, the service
// module's SPS for the midcourse corrections, LOI, the circularization and TEI, Eagle's descent
// engine for DOI and the powered descent, its ascent engine for the climb off the Moon. Times from
// Apollo by the Numbers (apollo11Events.ts and its burn tables); the descent's throttle as flown
// in outline (10% for the first 26 s, full until the throttle-down, then some 55%), APPROX. The
// rendezvous burns were mostly on the RCS thrusters - left out.

const T = (hours: number, minutes: number, seconds = 0) => hours * 3600 + minutes * 60 + seconds

export type Engine = 'j2' | 'sps' | 'descent' | 'ascent'

interface Burn {
  engine: Engine
  from: number
  to: number
}

export const BURNS: readonly Burn[] = [
  { engine: 'j2', from: T(2, 44, 16.2), to: T(2, 50, 3.03) },
  { engine: 'sps', from: T(26, 44, 58.64), to: T(26, 45, 1.77) },
  { engine: 'sps', from: T(75, 49, 50.37), to: T(75, 55, 47.9) },
  { engine: 'sps', from: T(80, 11, 36.75), to: T(80, 11, 53.63) },
  { engine: 'descent', from: T(101, 36, 14), to: T(101, 36, 42.5) },
  { engine: 'descent', from: T(102, 33, 5.01), to: T(102, 45, 40) },
  { engine: 'ascent', from: T(124, 22, 0.79), to: T(124, 29, 15.67) },
  { engine: 'sps', from: T(135, 23, 42.28), to: T(135, 26, 13.69) },
  { engine: 'sps', from: T(150, 29, 57.4), to: T(150, 30, 8.2) },
]

// Each engine's nozzle exit in its craft's frame (m; the stack's J-2 24 m below Columbia's), the way its
// exhaust leaves (-Y: down the craft's axis), its exit's radius, its plume's length and colour:
// hydrogen and oxygen burn nearly invisibly blue-violet, the hypergolic engines a faint orange.
export const NOZZLES: Record<Engine, { exit: Vec3; radius: number; length: number; color: Vec3; craft: 'columbia' | 'eagle' }> = {
  j2: { exit: [0, -24.3, 0], radius: 0.98, length: 28, color: [0.55, 0.6, 1], craft: 'columbia' },
  sps: { exit: [0, -0.1, 0], radius: 1.2, length: 16, color: [1, 0.62, 0.32], craft: 'columbia' },
  descent: { exit: [0, 0.45, 0], radius: 0.75, length: 11, color: [1, 0.66, 0.36], craft: 'eagle' },
  ascent: { exit: [0, 2.45, 0], radius: 0.45, length: 8, color: [1, 0.68, 0.4], craft: 'eagle' },
}

const RAMP_SECONDS = 1.2

// How hard the descent engine pushed, a share of full thrust.
function descentThrottle(burn: Burn, get: number): number {
  if (burn.to - burn.from < 60) return 1
  const into = get - burn.from
  if (into < 26) return 0.1
  return get < T(102, 39, 30) ? 1 : 0.55
}

// The engines burning at a mission time, each with its strength (0 to 1, eased in and out).
export function burnsAt(get: number): { engine: Engine; strength: number }[] {
  return BURNS.filter((burn) => get >= burn.from && get <= burn.to).map((burn) => {
    const ease = Math.min(1, (get - burn.from) / RAMP_SECONDS, (burn.to - get) / RAMP_SECONDS)
    const throttle = burn.engine === 'descent' ? descentThrottle(burn, get) : 1
    return { engine: burn.engine, strength: Math.max(0, ease) * throttle }
  })
}
