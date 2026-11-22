// A spacecraft coasting through the Earth-Moon system: its acceleration from Earth (a point mass
// plus its oblateness, J2), the Moon and the Sun (as third bodies, their positions from an
// ephemeris), integrated with fixed-step fourth-order Runge-Kutta. Km, seconds, the geocentric
// frame of Earth's mean equator and equinox of J2000.

export type Vec3 = [number, number, number]

export interface State {
  // Seconds (of whatever clock the acceleration takes: here mission time, GET).
  t: number
  position: Vec3
  velocity: Vec3
}

// km^3/s^2 (IERS / DE441).
export const EARTH_MU = 398600.4418
export const MOON_MU = 4902.800066
export const SUN_MU = 1.32712440018e11
// Earth's equatorial radius (km) and J2, for the oblateness term.
export const EARTH_RADIUS = 6378.137
const J2 = 1.08262668e-3

export type Acceleration = (t: number, position: Vec3) => Vec3

export function integrate(start: State, until: number, { step, acceleration, sample }: { step: number; acceleration: Acceleration; sample?: (state: State) => void }): State {
  let state = start
  sample?.(state)
  while (state.t < until - 1e-9) {
    state = rk4(state, Math.min(step, until - state.t), acceleration)
    sample?.(state)
  }
  return state
}

function rk4({ t, position: r, velocity: v }: State, h: number, a: Acceleration): State {
  const add = (x: Vec3, y: Vec3, k: number): Vec3 => [x[0] + y[0] * k, x[1] + y[1] * k, x[2] + y[2] * k]
  const a1 = a(t, r)
  const r2 = add(r, v, h / 2)
  const v2 = add(v, a1, h / 2)
  const a2 = a(t + h / 2, r2)
  const r3 = add(r, v2, h / 2)
  const v3 = add(v, a2, h / 2)
  const a3 = a(t + h / 2, r3)
  const r4 = add(r, v3, h)
  const v4 = add(v, a3, h)
  const a4 = a(t + h, r4)
  const position = r.map((value, i) => value + (h / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i])) as Vec3
  const velocity = v.map((value, i) => value + (h / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i])) as Vec3
  return { t: t + h, position, velocity }
}

// Earth as a point mass with its J2 oblateness (the equator the frame's xy-plane).
export function earthAcceleration([x, y, z]: Vec3): Vec3 {
  const r2 = x * x + y * y + z * z
  const r = Math.sqrt(r2)
  const k = (1.5 * J2 * EARTH_MU * EARTH_RADIUS ** 2) / r ** 5
  const zz = (5 * z * z) / r2
  return [(-EARTH_MU * x) / r ** 3 + k * x * (zz - 1), (-EARTH_MU * y) / r ** 3 + k * y * (zz - 1), (-EARTH_MU * z) / r ** 3 + k * z * (zz - 3)]
}

// A third body's pull on a spacecraft at `position`, in a frame centred on Earth (which it pulls
// too): the direct term less the indirect one.
export function thirdBody(mu: number, body: Vec3, position: Vec3): Vec3 {
  const d: Vec3 = [body[0] - position[0], body[1] - position[1], body[2] - position[2]]
  const dn = Math.hypot(...d) ** 3
  const bn = Math.hypot(...body) ** 3
  return [mu * (d[0] / dn - body[0] / bn), mu * (d[1] / dn - body[1] / bn), mu * (d[2] / dn - body[2] / bn)]
}
