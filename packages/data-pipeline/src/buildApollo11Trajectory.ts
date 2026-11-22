import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parkingOrbit } from './apollo/trajectory/apollo11Parking'
import { coast, correction, LOI, moonAt, solveCorrection, tliState, toMidcourse } from './apollo/trajectory/apollo11Translunar'
import type { State, Vec3 } from './apollo/trajectory/propagate'
import { simplifyTrajectory } from './voyager/trajectorySamples'

// Writes Apollo 11's reconstructed path from the S-IVB's first cutoff in Earth orbit to lunar orbit
// insertion (apollo/trajectory/), and the Moon's positions over the same time, for the app:
// packages/app/public/data/apollo11/translunar.bin and moon.bin - float32 records of mission time
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
  const values = new Float32Array(records.length * 4)
  records.forEach(({ t, position }, index) => values.set([t, ...toEcliptic(position)], index * 4))
  return Buffer.from(values.buffer)
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
  const atMidcourse = toMidcourse(keep)
  coast(correction(atMidcourse, solveCorrection(atMidcourse)), LOI.get, keep)
  return states.filter((state, index) => index === 0 || state.t > states[index - 1].t)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '../../app/public/data/apollo11')
  mkdirSync(out, { recursive: true })
  const path = apollo11Path()
  const thinned = simplifyTrajectory(path.map((state) => ({ julianDay: state.t, position: state.position, velocity: state.velocity })), TOLERANCE_KM).map(({ julianDay, position }) => ({ t: julianDay, position }))
  writeFileSync(join(out, 'translunar.bin'), binary(thinned))
  const moon = Array.from({ length: Math.ceil((LOI.get - path[0].t) / MOON_STEP) + 1 }, (_, k) => {
    const t = path[0].t + k * MOON_STEP
    return { t, position: moonAt(t) }
  })
  writeFileSync(join(out, 'moon.bin'), binary(moon))
  console.log(`path: ${path.length} states, ${thinned.length} kept; moon: ${moon.length} positions`)
}
