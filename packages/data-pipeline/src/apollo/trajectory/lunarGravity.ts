import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Vec3 } from './propagate'

// The Moon's gravity field as spherical harmonics: NASA/GSFC's GRAIL model GRGM660PRIM (Lemoine et
// al. 2013), from NASA's Planetary Data System (gggrx_0660pm_sha.tab, public domain), downloaded
// once into the pipeline's cache (not committed). Fully normalized coefficients, a reference radius
// of 1738 km, in the Moon's principal-axis frame (moonOrientation.ts). Evaluated with the V/W
// recursion of Montenbruck & Gill, "Satellite Orbits" (2000), section 3.2.5, on unnormalized
// coefficients - fine in double precision to the degrees used here (under 100).

export const GRAIL_URL = 'https://pds-geosciences.wustl.edu/grail/grail-l-lgrs-5-rdr-v1/grail_1001/shadr/gggrx_0660pm_sha.tab'
const CACHE = join(dirname(fileURLToPath(import.meta.url)), '../../../cache/grail/gggrx_0660pm_sha.tab')

export interface GravityField {
  radius: number
  mu: number
  degree: number
  // Unnormalized coefficients, by degree then order.
  c: Float64Array[]
  s: Float64Array[]
}

function logFactorial(n: number): number {
  let sum = 0
  for (let k = 2; k <= n; k++) sum += Math.log(k)
  return sum
}

// The factor that turns a fully normalized coefficient of degree n and order m into an
// unnormalized one: sqrt((2 - δm0) (2n + 1) (n - m)! / (n + m)!).
export function unnormalized(n: number, m: number, normalized: number): number {
  const log = 0.5 * (Math.log((m === 0 ? 1 : 2) * (2 * n + 1)) + logFactorial(n - m) - logFactorial(n + m))
  return normalized * Math.exp(log)
}

// The field up to `degree`, read from the cache (downloaded into it first if missing).
export async function grailField(degree: number): Promise<GravityField> {
  if (!existsSync(CACHE)) {
    const response = await fetch(GRAIL_URL)
    if (!response.ok) throw new Error(`GRAIL: HTTP ${response.status}`)
    mkdirSync(dirname(CACHE), { recursive: true })
    // Written whole under a name of its own first, then moved into place: tests running side by
    // side (CI, no cache yet) each download it, and none may read another's half-written file.
    const part = `${CACHE}.${process.pid}.${Math.random().toString(36).slice(2)}.part`
    writeFileSync(part, Buffer.from(await response.arrayBuffer()))
    renameSync(part, CACHE)
  }
  return parseField(readFileSync(CACHE, 'latin1'), degree)
}

export function parseField(text: string, degree: number): GravityField {
  const lines = text.split('\n')
  const header = lines[0].split(',').map((value) => Number.parseFloat(value))
  const c = Array.from({ length: degree + 1 }, () => new Float64Array(degree + 1))
  const s = Array.from({ length: degree + 1 }, () => new Float64Array(degree + 1))
  c[0][0] = 1
  for (const line of lines.slice(1)) {
    const fields = line.split(',')
    if (fields.length < 4) continue
    const [n, m] = [Number.parseInt(fields[0], 10), Number.parseInt(fields[1], 10)]
    if (n > degree) break
    c[n][m] = unnormalized(n, m, Number.parseFloat(fields[2]))
    s[n][m] = unnormalized(n, m, Number.parseFloat(fields[3]))
  }
  return { radius: header[0], mu: header[1], degree, c, s }
}

// V and W of Montenbruck & Gill (3.29-3.31) up to degree n + 1, at a point (km) in the field's
// frame.
function harmonicsVW([x, y, z]: Vec3, radius: number, n: number): { v: Float64Array[]; w: Float64Array[] } {
  const r2 = x * x + y * y + z * z
  const point = { rho: (radius * radius) / r2, x0: (radius * x) / r2, y0: (radius * y) / r2, z0: (radius * z) / r2 }
  const v = Array.from({ length: n + 2 }, () => new Float64Array(n + 2))
  const w = Array.from({ length: n + 2 }, () => new Float64Array(n + 2))
  v[0][0] = radius / Math.sqrt(r2)
  v[1][0] = point.z0 * v[0][0]
  for (let k = 2; k <= n + 1; k++) v[k][0] = ((2 * k - 1) * point.z0 * v[k - 1][0] - (k - 1) * point.rho * v[k - 2][0]) / k
  for (let m = 1; m <= n + 1; m++) fillOrder({ v, w }, m, n + 1, point)
  return { v, w }
}

// One order m: its sectoral term from the one before, then up the degrees.
function fillOrder({ v, w }: { v: Float64Array[]; w: Float64Array[] }, m: number, top: number, { rho, x0, y0, z0 }: { rho: number; x0: number; y0: number; z0: number }): void {
  v[m][m] = (2 * m - 1) * (x0 * v[m - 1][m - 1] - y0 * w[m - 1][m - 1])
  w[m][m] = (2 * m - 1) * (x0 * w[m - 1][m - 1] + y0 * v[m - 1][m - 1])
  if (m < top) {
    v[m + 1][m] = (2 * m + 1) * z0 * v[m][m]
    w[m + 1][m] = (2 * m + 1) * z0 * w[m][m]
  }
  for (let k = m + 2; k <= top; k++) {
    v[k][m] = ((2 * k - 1) * z0 * v[k - 1][m] - (k + m - 1) * rho * v[k - 2][m]) / (k - m)
    w[k][m] = ((2 * k - 1) * z0 * w[k - 1][m] - (k + m - 1) * rho * w[k - 2][m]) / (k - m)
  }
}

// The acceleration (km/s², the field's frame) from the terms of degree `from` up to the field's
// degree, at a point (km) in that frame: `from` 2 leaves out the point mass the propagator already
// has (degree 1 is zero about the centre of mass).
export function harmonicAcceleration(field: GravityField, position: Vec3, from: number): Vec3 {
  const { c, s, degree, radius, mu } = field
  const { v, w } = harmonicsVW(position, radius, degree)
  let [ax, ay, az] = [0, 0, 0]
  for (let n = from; n <= degree; n++) {
    ax -= c[n][0] * v[n + 1][1]
    ay -= c[n][0] * w[n + 1][1]
    az += (n + 1) * (-c[n][0] * v[n + 1][0])
    for (let m = 1; m <= n; m++) {
      const f = (n - m + 2) * (n - m + 1)
      ax += 0.5 * (-c[n][m] * v[n + 1][m + 1] - s[n][m] * w[n + 1][m + 1] + f * (c[n][m] * v[n + 1][m - 1] + s[n][m] * w[n + 1][m - 1]))
      ay += 0.5 * (-c[n][m] * w[n + 1][m + 1] + s[n][m] * v[n + 1][m + 1] + f * (-c[n][m] * w[n + 1][m - 1] + s[n][m] * v[n + 1][m - 1]))
      az += (n - m + 1) * (-c[n][m] * v[n + 1][m] - s[n][m] * w[n + 1][m])
    }
  }
  const scale = mu / (radius * radius)
  return [ax * scale, ay * scale, az * scale]
}

// The potential (km²/s²) at a point (km) in the field's frame: μ/R Σ (C V + S W).
export function harmonicPotential(field: GravityField, position: Vec3): number {
  const { v, w } = harmonicsVW(position, field.radius, field.degree)
  let sum = 0
  for (let n = 0; n <= field.degree; n++) for (let m = 0; m <= n; m++) sum += field.c[n][m] * v[n][m] + field.s[n][m] * w[n][m]
  return (field.mu / field.radius) * sum
}
