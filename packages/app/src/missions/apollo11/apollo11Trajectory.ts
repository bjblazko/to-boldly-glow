// Apollo 11's reconstructed path for the tour (the data pipeline's buildApollo11Trajectory): where
// Columbia, Eagle and the Moon were at any mission time (GET, s), in km from Earth's centre,
// ecliptic J2000 - the frame of the planets' positions.
//
// The files hold five float32s a point: the time as whole seconds and the fraction left over (one
// float32 would hold only about 1/32 s at 100 hours), then x, y, z. Near the Moon (lunar.bin,
// eagle.bin) the positions are from the Moon's centre - float32 keeps centimetres there - and the
// Moon's own position (moon.bin, every 10 minutes) is added back here, in double precision.

export type Vec3 = [number, number, number]

const RECORD_FLOATS = 5

export interface Track {
  times: Float64Array
  // x, y, z per point.
  positions: Float64Array
}

export function parseTrack(buffer: ArrayBuffer): Track {
  const values = new Float32Array(buffer)
  const count = Math.floor(values.length / RECORD_FLOATS)
  const times = new Float64Array(count)
  const positions = new Float64Array(count * 3)
  for (let i = 0; i < count; i++) {
    const at = i * RECORD_FLOATS
    times[i] = values[at] + values[at + 1]
    positions.set(values.subarray(at + 2, at + 5), i * 3)
  }
  return { times, positions }
}

const point = ({ positions }: Track, i: number): Vec3 => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]

// The velocity at a point (km/s): across its neighbours (one-sided at the ends).
function velocity(track: Track, i: number): Vec3 {
  const last = track.times.length - 1
  const [a, b] = [Math.max(0, i - 1), Math.min(last, i + 1)]
  const [p, q] = [point(track, a), point(track, b)]
  const span = track.times[b] - track.times[a]
  return span > 0 ? [(q[0] - p[0]) / span, (q[1] - p[1]) / span, (q[2] - p[2]) / span] : [0, 0, 0]
}

interface Knot {
  t: number
  position: Vec3
  velocity: Vec3
}

// A cubic Hermite piece between two knots: smooth in position and velocity at both.
function hermite(a: Knot, b: Knot, t: number): Vec3 {
  const span = b.t - a.t
  const s = (t - a.t) / span
  const [h00, h10, h01, h11] = [2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s, -2 * s ** 3 + 3 * s ** 2, s ** 3 - s ** 2]
  return [0, 1, 2].map((k) => h00 * a.position[k] + h10 * span * a.velocity[k] + h01 * b.position[k] + h11 * span * b.velocity[k]) as Vec3
}

const knot = (track: Track, i: number): Knot => ({ t: track.times[i], position: point(track, i), velocity: velocity(track, i) })

// The last point at or before `t` (binary search); -1 before the first.
function indexBefore(times: Float64Array, t: number): number {
  let [low, high] = [-1, times.length - 1]
  while (low < high) {
    const middle = Math.ceil((low + high + 1) / 2)
    if (times[middle] <= t) low = middle
    else high = middle - 1
  }
  return low
}

// Where the track is at `t` (null outside it).
export function sampleTrack(track: Track, t: number): Vec3 | null {
  const { times } = track
  if (times.length === 0 || t < times[0] || t > times[times.length - 1]) return null
  const i = indexBefore(times, t)
  if (times[i] === t || i === times.length - 1) return point(track, i)
  return hermite(knot(track, i), knot(track, i + 1), t)
}

export interface Apollo11Files {
  translunar: ArrayBuffer
  lunar: ArrayBuffer
  eagle: ArrayBuffer
  transearth: ArrayBuffer
  moon: ArrayBuffer
}

export interface Apollo11Trajectory {
  // The mission times Columbia's path covers: from Earth orbit insertion to entry.
  start: number
  end: number
  moon(get: number): Vec3 | null
  columbia(get: number): Vec3 | null
  // Eagle: on its own (alone) from the undocking to the docking, otherwise riding with Columbia.
  eagle(get: number): { position: Vec3; alone: boolean } | null
}

const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

export function apollo11Trajectory(files: Apollo11Files): Apollo11Trajectory {
  const moonTrack = parseTrack(files.moon)
  const moon = (get: number) => sampleTrack(moonTrack, get)
  const fromMoon = (track: Track) => (get: number) => {
    const [here, centre] = [sampleTrack(track, get), moon(get)]
    return here && centre ? plus(here, centre) : null
  }
  const columbia = joinedPath([geocentric(parseTrack(files.translunar)), aroundMoon(parseTrack(files.lunar), fromMoon), geocentric(parseTrack(files.transearth))])
  const eagleTrack = parseTrack(files.eagle)
  const eagleAlone = fromMoon(eagleTrack)
  const eagle = (get: number) => {
    const alone = eagleAlone(get)
    if (alone) return { position: alone, alone: true }
    const ridden = columbia.at(get)
    return ridden ? { position: ridden, alone: false } : null
  }
  return { start: columbia.start, end: columbia.end, moon, columbia: columbia.at, eagle }
}

// A stretch of path: where it starts and ends, and its position at a time within.
interface Leg {
  start: number
  end: number
  at: (get: number) => Vec3 | null
}

function geocentric(track: Track): Leg {
  return { start: track.times[0], end: track.times[track.times.length - 1], at: (get) => sampleTrack(track, get) }
}

function aroundMoon(track: Track, fromMoon: (track: Track) => (get: number) => Vec3 | null): Leg {
  return { start: track.times[0], end: track.times[track.times.length - 1], at: fromMoon(track) }
}

// Legs one after another; across a gap between two (the transearth injection's burn) a smooth
// Hermite bridge from the one's last motion to the other's first.
function joinedPath(legs: Leg[]): Leg {
  const motion = (leg: Leg, t: number, side: 1 | -1): Knot => {
    const [here, near] = [leg.at(t)!, leg.at(t - side)!]
    const v = here.map((value, k) => (side * (value - near[k]))) as Vec3
    return { t, position: here, velocity: v }
  }
  const at = (get: number): Vec3 | null => {
    const index = legs.findIndex((leg) => get <= leg.end)
    if (index < 0) return null
    const leg = legs[index]
    if (get >= leg.start) return leg.at(get)
    if (index === 0) return null
    const previous = legs[index - 1]
    return hermite(motion(previous, previous.end, 1), motion(leg, leg.start, -1), get)
  }
  return { start: legs[0].start, end: legs[legs.length - 1].end, at }
}

// Fetches the files from public/data/apollo11/.
export async function loadApollo11Trajectory(base = 'data/apollo11/'): Promise<Apollo11Trajectory> {
  const names = ['translunar', 'lunar', 'eagle', 'transearth', 'moon'] as const
  const buffers = await Promise.all(
    names.map(async (name) => {
      const response = await fetch(`${base}${name}.bin`)
      if (!response.ok) throw new Error(`Apollo 11 trajectory: ${name}.bin: HTTP ${response.status}`)
      return response.arrayBuffer()
    }),
  )
  const [translunar, lunar, eagle, transearth, moon] = buffers
  return apollo11Trajectory({ translunar, lunar, eagle, transearth, moon })
}
