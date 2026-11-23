import { encodeRecords } from './apollo/trajectory/trajectoryRecords'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parkingOrbit } from './apollo/trajectory/apollo11Parking'
import { inLunarOrbit, intoLunarOrbit } from './apollo/trajectory/apollo11LunarOrbit'
import { grailField } from './apollo/trajectory/lunarGravity'
import { eagleAtPdi } from './apollo/trajectory/apollo11LunarFit'
import { descentAt, onSurface, poweredDescent, TOUCHDOWN } from './apollo/trajectory/apollo11Descent'
import { ascentAt, eagleUp, INSERTION_CUTOFF, LIFTOFF } from './apollo/trajectory/apollo11Ascent'
import { coast, moonAt, tliState } from './apollo/trajectory/apollo11Translunar'
import { backToTei, ENTRY_INTERFACE, entryInterfaceState, solveTransearthCorrection, TRANSEARTH_MIDCOURSE } from './apollo/trajectory/apollo11Transearth'
import type { State, Vec3 } from './apollo/trajectory/propagate'
import { simplifyTrajectory } from './voyager/trajectorySamples'

// Writes Apollo 11's reconstructed path (apollo/trajectory/) for the app: from the S-IVB's first
// cutoff in Earth orbit to lunar orbit insertion (packages/app/public/data/apollo11/translunar.bin),
// Columbia's lunar orbits to the transearth injection (lunar.bin) and Eagle's way down, its stay
// and its way back up to Columbia (eagle.bin) - these two from the Moon's centre - from the
// transearth injection to entry
// interface (transearth.bin), and the Moon's positions over the whole flight (moon.bin) - float32 records of mission time
// (GET, s) and geocentric position (km) in the ecliptic frame of J2000 (the app's planets'), the
// path thinned to within 1 km. The TLI burn (2:44:16 to 2:50:13) is drawn as a smooth join between
// the parking orbit and the injected state. `npm run build-apollo11-trajectory`.

const OBLIQUITY = (23.4392911 * Math.PI) / 180
const TOLERANCE_KM = 1
const MOON_STEP = 600

// Earth's mean equator of J2000 to the ecliptic of J2000.
function toEcliptic([x, y, z]: Vec3): Vec3 {
  return [x, Math.cos(OBLIQUITY) * y + Math.sin(OBLIQUITY) * z, -Math.sin(OBLIQUITY) * y + Math.cos(OBLIQUITY) * z]
}

function binary(records: { t: number; position: Vec3 }[]): Buffer {
  return encodeRecords(records.map(({ t, position }) => ({ t, position: toEcliptic(position) })))
}

// A cubic Hermite join between two states (position and velocity at each end).
function join2(a: State, b: State, steps: number): State[] {
  const span = b.t - a.t
  return Array.from({ length: steps - 1 }, (_, k) => {
    const s = (k + 1) / steps
    const [h00, h10, h01, h11] = [2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s, -2 * s ** 3 + 3 * s ** 2, s ** 3 - s ** 2]
    const position = [0, 1, 2].map((i) => h00 * a.position[i] + h10 * span * a.velocity[i] + h01 * b.position[i] + h11 * span * b.velocity[i]) as Vec3
    return { t: a.t + s * span, position, velocity: [0, 0, 0] as Vec3 }
  })
}

export function apollo11Path(): State[] {
  const states: State[] = []
  const keep = (state: State) => states.push(state)
  const ignition = parkingOrbit(keep)
  const injected = tliState()
  states.push(...join2(ignition, injected, 30))
  intoLunarOrbit(keep)
  return ordered(states)
}

// Columbia's 30 lunar orbits, from the insertion to the transearth injection, in the Moon's
// gravity field (GRAIL, to degree 60).
export async function apollo11InLunarOrbit(): Promise<State[]> {
  const states: State[] = []
  inLunarOrbit(await grailField(60), (state) => states.push(state))
  return ordered(states)
}

// Eagle on its own: from the undocking through its descent orbit and powered descent to the
// landing, standing on Tranquility Base (turning with the Moon) until its liftoff, then its ascent
// stage's climb and rendezvous back to Columbia, to the docking.
export async function apollo11Eagle(): Promise<State[]> {
  const field = await grailField(60)
  const states: State[] = []
  const atPdi = eagleAtPdi(field, undefined, (state) => states.push(state))
  const descent = poweredDescent(atPdi)
  for (let get = atPdi.t + 1; get <= TOUCHDOWN; get += 1) states.push(descentAt(descent, get))
  for (let get = TOUCHDOWN + 60; get < LIFTOFF; get += 60) states.push(onSurface(descent, get))
  const { ascent, coast } = eagleUp(field)
  for (let get = LIFTOFF; get < INSERTION_CUTOFF; get += 1) states.push(ascentAt(ascent, get))
  states.push(...coast)
  return ordered(states)
}

// The way home, from the transearth injection to entry interface (computed backward).
export function apollo11WayHome(): State[] {
  const states: State[] = []
  const keep = (state: State) => states.push(state)
  const atCorrection = coast(entryInterfaceState(), TRANSEARTH_MIDCOURSE.get, keep)
  backToTei(atCorrection, solveTransearthCorrection(atCorrection), keep)
  return ordered(states)
}

// In time order, each moment once.
function ordered(states: State[]): State[] {
  const sorted = [...states].sort((a, b) => a.t - b.t)
  return sorted.filter((state, index) => index === 0 || state.t > sorted[index - 1].t)
}

function thinned(path: State[], tolerance = TOLERANCE_KM): { t: number; position: Vec3 }[] {
  return simplifyTrajectory(path.map((state) => ({ julianDay: state.t, position: state.position, velocity: state.velocity })), tolerance).map(({ julianDay, position }) => ({ t: julianDay, position }))
}

// Near the Moon, positions from its centre: float32 then keeps centimetres (from Earth's centre only
// tens of metres), what Eagle's last metres down need: its path thinned to within a metre,
// Columbia's orbits to within 10 m.
const EAGLE_TOLERANCE_KM = 0.001
const ORBIT_TOLERANCE_KM = 0.01
function fromMoon(path: State[]): State[] {
  return path.map((state) => {
    const moon = moonAt(state.t)
    const [ahead, behind] = [moonAt(state.t + 1), moonAt(state.t - 1)]
    return { t: state.t, position: state.position.map((value, k) => value - moon[k]) as Vec3, velocity: state.velocity.map((value, k) => value - (ahead[k] - behind[k]) / 2) as Vec3 }
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '../../app/public/data/apollo11')
  mkdirSync(out, { recursive: true })
  const [path, home] = [apollo11Path(), apollo11WayHome()]
  const [outbound, inbound] = [thinned(path), thinned(home)]
  writeFileSync(join(out, 'translunar.bin'), binary(outbound))
  writeFileSync(join(out, 'transearth.bin'), binary(inbound))
  const lunar = thinned(fromMoon(await apollo11InLunarOrbit()), ORBIT_TOLERANCE_KM)
  writeFileSync(join(out, 'lunar.bin'), binary(lunar))
  console.log(`lunar.bin: ${lunar.length} points`)
  const eagle = thinned(fromMoon(await apollo11Eagle()), EAGLE_TOLERANCE_KM)
  writeFileSync(join(out, 'eagle.bin'), binary(eagle))
  console.log(`eagle.bin: ${eagle.length} points`)
  const moon = Array.from({ length: Math.ceil((ENTRY_INTERFACE.get - path[0].t) / MOON_STEP) + 1 }, (_, k) => {
    const t = path[0].t + k * MOON_STEP
    return { t, position: moonAt(t) }
  })
  writeFileSync(join(out, 'moon.bin'), binary(moon))
  console.log(`out: ${outbound.length} points, home: ${inbound.length} points, moon: ${moon.length} positions`)
}
