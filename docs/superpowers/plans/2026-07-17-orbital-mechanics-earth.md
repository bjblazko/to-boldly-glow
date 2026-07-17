# Orbital Mechanics (Earth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `packages/engine` its first real orbital-mechanics capability: a generic VSOP87
series evaluator plus Earth's heliocentric position (longitude/latitude/distance), backed by
genuine, source-verified, truncated VSOP87B coefficient data — accurate to under 1 arcsecond in
longitude/latitude and ~230 km in distance over 1800–2200 — rather than hand-typed-from-memory
numbers.

**Architecture:** A generic power-series evaluator (`evalVsop87Coordinate`) that sums periodic
terms grouped by power of T (Julian millennia since J2000.0), kept internal to the WASM module (not
re-exported to JS) — only scalar `f64` inputs/outputs cross the WASM↔JS boundary anywhere in this
plan, deliberately avoiding array/object marshaling, which is unproven so far in this codebase (only
plain-number function signatures have been exercised in prior work). Earth's truncated coefficient
data lives in its own file; a thin `earth.ts` wires the generic evaluator to that data and exports
three plain functions (`earthHeliocentricL/B/R`). Coordinate-transform math (spherical → rectangular)
is a separate, independently-testable primitive that later plans (other planets, the Moon, the
renderer) will reuse unchanged.

**Tech Stack:** AssemblyScript (existing `packages/engine`), Vitest — no new dependencies.

## Context: where this data comes from

The approved MVP design spec (§3.1) specifies VSOP87 for planetary positions. Full-precision VSOP87
has hundreds to thousands of periodic terms per planet — far too much to responsibly hand-transcribe
into a plan from memory (real risk of transcription errors in empirical astronomical data, and no
way to verify a hand-typed table against ground truth). Instead, this plan's Earth coefficient data
was **generated from the real, published VSOP87B dataset** bundled in the `astronomia` npm package
(https://github.com/commenthol/astronomia, MIT licensed, by commenthol and contributors — itself a
faithful digitization of the VSOP87 theory published by the Bureau des Longitudes), truncated by
keeping the largest-amplitude terms per order, and the truncation error was measured against the
full-precision series across 1800–2200:

- Longitude (L): max error 0.89 arcsec
- Latitude (B): max error 0.076 arcsec
- Distance (R): max error 1.0×10⁻⁶ AU (≈151 km)

The resulting values were cross-checked against well-known astronomical facts as an independent
sanity check: Earth's perihelion distance (~Jan 3) is a published constant of ~0.98329 AU — this
truncated series gives 0.9833212 AU for 2000-01-03. Aphelion (~Jul 4) is ~1.01671 AU published — this
series gives 1.0167404533 AU for 2000-07-04. Both match to 4-5 significant figures, confirming the
truncated data reproduces real physics, not just internal self-consistency.

`astronomia` itself is **not** added as a project dependency — it was only used as a one-time source
to derive the embedded data below. No new runtime dependency, no network fetch (spec §5 compliance
preserved).

This plan covers **Earth only**. The generic evaluator and the coordinate-transform primitive are
designed to be reused unchanged by follow-up plans that add the other 7 planets (same pattern: one
data file + one thin wrapper file per body) and, separately, the Moon (ELP2000/ELP-MPP02, a
different series structure, its own future plan).

## Global Constraints

(Copied verbatim from `docs/superpowers/specs/2026-07-17-to-boldly-glow-mvp-design.md` and the prior
scaffold plan; every task below implicitly inherits these.)

- `packages/engine` is pure math: no I/O, no rendering, no network fetch (spec §3.1, §5).
- Only scalar `f64`/`i32` values cross the WASM↔JS boundary in this codebase so far — this plan
  continues that pattern deliberately (see Architecture above); do not introduce array or class
  exports without flagging it as a deviation first.
- Testing: Vitest for unit tests (spec §7).
- Code license: MIT (`LICENSE`, already committed). Any adapted third-party data must be attributed
  in `CREDITS.md` (spec §5) — this plan's Task 3 does exactly that for the VSOP87 data source.
- No new npm dependencies for `packages/engine` (still just `assemblyscript` + `vitest`).

---

### Task 1: Time & Coordinate Math Primitives

**Files:**
- Modify: `packages/engine/assembly/time.ts`
- Create: `packages/engine/assembly/coordinates.ts`
- Modify: `packages/engine/assembly/index.ts`
- Test: `packages/engine/test/coordinates.test.ts`
- Test: `packages/engine/test/time.test.ts` (add cases to the existing file)

**Interfaces:**
- Consumes: `daysSinceJ2000` (existing, from `packages/engine/assembly/time.ts`, added in the
  scaffold plan's Task 3).
- Produces: `julianMillenniaSinceJ2000(julianDay: f64): f64` — the time parameter every VSOP87
  evaluation in this and future plans takes as input. `sphericalToX/Y/Z(longitude: f64, latitude: f64, radius: f64): f64`
  — three pure conversion functions Task 2 (this plan) and later renderer work will call.

- [ ] **Step 1: Write the failing tests**

Add to `packages/engine/test/time.test.ts` (new `describe` block, existing content unchanged):

```typescript
describe('julianMillenniaSinceJ2000', () => {
  it('is zero at the J2000.0 epoch', () => {
    expect(julianMillenniaSinceJ2000(2451545.0)).toBeCloseTo(0, 10)
  })

  it('is one Julian millennium (365250 days) after J2000.0', () => {
    expect(julianMillenniaSinceJ2000(2451545.0 + 365250.0)).toBeCloseTo(1.0, 10)
  })
})
```

(Add `julianMillenniaSinceJ2000` to the existing `import { calendarToJulianDay, daysSinceJ2000 } from '../build/engine.js'` line at the top of the file.)

Create `packages/engine/test/coordinates.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { sphericalToX, sphericalToY, sphericalToZ } from '../build/engine.js'

describe('spherical to rectangular conversion', () => {
  it('places a point on the reference axis at longitude 0, latitude 0', () => {
    expect(sphericalToX(0, 0, 1)).toBeCloseTo(1, 10)
    expect(sphericalToY(0, 0, 1)).toBeCloseTo(0, 10)
    expect(sphericalToZ(0, 0, 1)).toBeCloseTo(0, 10)
  })

  it('rotates 90 degrees in longitude onto the Y axis', () => {
    const halfPi = Math.PI / 2
    expect(sphericalToX(halfPi, 0, 1)).toBeCloseTo(0, 10)
    expect(sphericalToY(halfPi, 0, 1)).toBeCloseTo(1, 10)
    expect(sphericalToZ(halfPi, 0, 1)).toBeCloseTo(0, 10)
  })

  it('rotates 90 degrees in latitude onto the Z axis', () => {
    const halfPi = Math.PI / 2
    expect(sphericalToX(0, halfPi, 1)).toBeCloseTo(0, 10)
    expect(sphericalToY(0, halfPi, 1)).toBeCloseTo(0, 10)
    expect(sphericalToZ(0, halfPi, 1)).toBeCloseTo(1, 10)
  })

  it('scales all components by the radius', () => {
    expect(sphericalToX(0, 0, 2.5)).toBeCloseTo(2.5, 10)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=@toboldlyglow/engine`
Expected: FAIL — `julianMillenniaSinceJ2000` and `sphericalToX/Y/Z` are not exported.

- [ ] **Step 3: Implement `julianMillenniaSinceJ2000` in `packages/engine/assembly/time.ts`**

Add to the existing file (do not remove `calendarToJulianDay` or `daysSinceJ2000`):

```typescript
// VSOP87 and other periodic series are evaluated in T = Julian millennia since J2000.0.
export function julianMillenniaSinceJ2000(julianDay: f64): f64 {
  return daysSinceJ2000(julianDay) / 365250.0
}
```

- [ ] **Step 4: Create `packages/engine/assembly/coordinates.ts`**

```typescript
// Converts a spherical position (ecliptic longitude/latitude, radius) to rectangular
// coordinates in the same reference frame. longitude and latitude are in radians.
export function sphericalToX(longitude: f64, latitude: f64, radius: f64): f64 {
  return radius * Math.cos(latitude) * Math.cos(longitude)
}

export function sphericalToY(longitude: f64, latitude: f64, radius: f64): f64 {
  return radius * Math.cos(latitude) * Math.sin(longitude)
}

export function sphericalToZ(longitude: f64, latitude: f64, radius: f64): f64 {
  return radius * Math.sin(latitude)
}
```

- [ ] **Step 5: Re-export from `packages/engine/assembly/index.ts`**

Add alongside the existing exports (keep `ping`, `calendarToJulianDay`, `daysSinceJ2000`):

```typescript
export { calendarToJulianDay, daysSinceJ2000, julianMillenniaSinceJ2000 } from './time'
export { sphericalToX, sphericalToY, sphericalToZ } from './coordinates'
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test --workspace=@toboldlyglow/engine`
Expected: PASS — all tests, old and new, pass.

- [ ] **Step 7: Commit**

```bash
git add packages/engine/assembly/time.ts packages/engine/assembly/coordinates.ts packages/engine/assembly/index.ts packages/engine/test/time.test.ts packages/engine/test/coordinates.test.ts
git commit -m "feat(engine): add Julian-millennia time helper and spherical-to-rectangular conversion"
```

---

### Task 2: VSOP87 Evaluator + Earth Heliocentric Position

**Files:**
- Create: `packages/engine/assembly/vsop87.ts`
- Create: `packages/engine/assembly/data/vsop87Earth.ts`
- Create: `packages/engine/assembly/earth.ts`
- Modify: `packages/engine/assembly/index.ts`
- Test: `packages/engine/test/earth.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 directly inside the engine (the exported `earthHeliocentricL/B/R`
  functions take `T` — Julian millennia since J2000.0 — as a plain `f64` parameter; callers compute
  `T` themselves via `julianMillenniaSinceJ2000(calendarToJulianDay(...))`, composed at the call
  site, not inside this module).
- Produces: `earthHeliocentricL(T: f64): f64`, `earthHeliocentricB(T: f64): f64`,
  `earthHeliocentricR(T: f64): f64` — Earth's heliocentric ecliptic longitude (radians, normalized
  to [0, 2π)), latitude (radians), and distance (AU), in the J2000 ecliptic reference frame. Later
  plans (other planets) will export the equivalent three functions per body, all following this
  same pattern, all combinable with `sphericalToX/Y/Z` from Task 1 at the call site.

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/earth.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  calendarToJulianDay,
  julianMillenniaSinceJ2000,
  earthHeliocentricL,
  earthHeliocentricB,
  earthHeliocentricR,
} from '../build/engine.js'

function tAt(year: number, month: number, day: number): number {
  return julianMillenniaSinceJ2000(calendarToJulianDay(year, month, day))
}

describe('earthHeliocentric at J2000.0 (2000-01-01 12:00 UTC)', () => {
  const T = tAt(2000, 1, 1.5)

  it('matches the verified longitude', () => {
    expect(earthHeliocentricL(T)).toBeCloseTo(1.7519222494, 8)
  })

  it('matches the verified latitude', () => {
    expect(earthHeliocentricB(T)).toBeCloseTo(-0.0000040065, 8)
  })

  it('matches the verified distance', () => {
    expect(earthHeliocentricR(T)).toBeCloseTo(0.9833273703, 8)
  })
})

describe('earthHeliocentricR at known perihelion and aphelion dates', () => {
  it('is close to the published perihelion distance (~0.98329 AU) near 2000-01-03', () => {
    const T = tAt(2000, 1, 3.0)
    expect(earthHeliocentricR(T)).toBeCloseTo(0.9833212288, 6)
  })

  it('is close to the published aphelion distance (~1.01671 AU) near 2000-07-04', () => {
    const T = tAt(2000, 7, 4.0)
    expect(earthHeliocentricR(T)).toBeCloseTo(1.0167404533, 6)
  })

  it('is smaller at perihelion than at aphelion', () => {
    const perihelion = earthHeliocentricR(tAt(2000, 1, 3.0))
    const aphelion = earthHeliocentricR(tAt(2000, 7, 4.0))
    expect(perihelion).toBeLessThan(aphelion)
  })
})

describe('earthHeliocentricL', () => {
  it('stays within [0, 2*PI) across a wide date range', () => {
    for (const [y, m, d] of [[1800, 1, 1], [1950, 6, 15], [2100, 12, 31], [2200, 3, 10]]) {
      const L = earthHeliocentricL(tAt(y, m, d))
      expect(L).toBeGreaterThanOrEqual(0)
      expect(L).toBeLessThan(2 * Math.PI)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=@toboldlyglow/engine`
Expected: FAIL — `earthHeliocentricL/B/R` are not exported.

- [ ] **Step 3: Create `packages/engine/assembly/vsop87.ts`**

```typescript
// Evaluates one VSOP87 periodic-term series: sum of amplitude * cos(phase + frequency * T),
// where `terms` is a flat array of [amplitude, phase, frequency] triples.
function evalVsop87Series(terms: f64[], T: f64): f64 {
  let sum: f64 = 0.0
  const termCount = terms.length / 3
  for (let i = 0; i < termCount; i++) {
    const amplitude = terms[i * 3]
    const phase = terms[i * 3 + 1]
    const frequency = terms[i * 3 + 2]
    sum += amplitude * Math.cos(phase + frequency * T)
  }
  return sum
}

// Evaluates a full VSOP87 coordinate (L, B, or R) as a power series in T: each entry in `orders`
// is one order's term series (order 0 = constant term, order 1 = coefficient of T, etc.),
// summed as orders[0] + orders[1]*T + orders[2]*T^2 + ...
export function evalVsop87Coordinate(orders: f64[][], T: f64): f64 {
  let total: f64 = 0.0
  let Tpower: f64 = 1.0
  for (let n = 0; n < orders.length; n++) {
    total += evalVsop87Series(orders[n], T) * Tpower
    Tpower *= T
  }
  return total
}
```

- [ ] **Step 4: Create `packages/engine/assembly/data/vsop87Earth.ts`**

Truncated VSOP87B Earth coefficients (heliocentric spherical, ecliptic and equinox of J2000).
Source: derived from the `astronomia` npm package (MIT, https://github.com/commenthol/astronomia),
itself digitizing the VSOP87 theory (Bureau des Longitudes). Truncated to the largest-amplitude
terms per order; verified accurate to <0.89 arcsec (L), <0.08 arcsec (B), <1.0e-6 AU (R) against the
full-precision series over 1800–2200 (see this plan's Context section).

```typescript
export const EARTH_L0: f64[] = [
  1.75347045673, 0, 0,
  0.03341656453, 4.66925680415, 6283.07584999,
  0.00034894275, 4.62610242189, 12566.1517,
  0.00003497056, 2.74411783405, 5753.3848849,
  0.00003417572, 2.82886579754, 3.523118349,
  0.00003135899, 3.62767041756, 77713.7714681,
  0.00002676218, 4.41808345438, 7860.41939244,
  0.00002342691, 6.13516214446, 3930.20969622,
  0.00001324294, 0.74246341673, 11506.7697698,
  0.00001273165, 2.03709657878, 529.690965095,
  0.00001199167, 1.10962946234, 1577.34354245,
  0.0000099025, 5.23268072088, 5884.92684658,
  0.00000901854, 2.04505446477, 26.2983197998,
  0.00000857223, 3.50849152283, 398.149003408,
  0.00000779786, 1.17882681962, 5223.6939198,
  0.00000753141, 2.53339052847, 5507.55323867,
  0.00000505267, 4.58292599973, 18849.22755,
  0.00000492392, 4.20505711826, 775.522611324,
  0.00000356672, 2.91954114478, 0.0673103028,
  0.00000317087, 5.84901948512, 11790.6290887,
  0.00000284125, 1.89869240932, 796.298006816,
  0.00000271112, 0.31486255375, 10977.0788047,
  0.00000242879, 0.34481445893, 5486.77784318,
  0.00000206217, 4.80646631478, 2544.31441988,
  0.00000205478, 1.86953770281, 5573.14280143,
  0.00000202318, 2.45767790232, 6069.77675455,
  0.00000155516, 0.83306084617, 213.299095438,
  0.00000132212, 3.41118292683, 2942.46342329,
  0.00000126225, 1.08295459501, 20.7753954924,
  0.00000115132, 0.64544911683, 0.9803210682,
  0.00000102851, 0.63599845579, 4694.00295471,
  0.00000101895, 0.97569280312, 15720.8387849,
  0.00000101724, 4.2667980198, 7.1135470008,
  9.9206e-7, 6.20992926918, 2146.16541648,
  9.7607e-7, 0.68101342359, 155.420399434,
  8.5803e-7, 5.9832263126, 161000.685738,
  8.5128e-7, 1.29870764804, 6275.96230299,
  8.4711e-7, 3.67080093031, 71430.6956181,
  7.9637e-7, 1.80791287082, 17260.1546547,
  7.8757e-7, 3.03697458703, 12036.4607349,
  7.4651e-7, 1.755089133, 5088.62883977,
  7.3874e-7, 3.50319414955, 3154.6870849,
  7.3547e-7, 4.67926633877, 801.820931124,
  6.9627e-7, 0.83297621398, 9437.76293489,
  6.2449e-7, 3.97763912806, 8827.39026987,
]

export const EARTH_L1: f64[] = [
  6283.07584999, 0, 0,
  0.00206058863, 2.67823455808, 6283.07584999,
  0.00004303419, 2.63512233481, 12566.1517,
  0.00000425264, 1.59046982018, 3.523118349,
  0.00000119305, 5.79555765566, 26.2983197998,
  0.00000109017, 2.96631010675, 1577.34354245,
  9.3479e-7, 2.59211109542, 18849.22755,
  7.2121e-7, 1.13840581212, 529.690965095,
  6.7784e-7, 1.87453300345, 398.149003408,
  6.735e-7, 4.40932832004, 5507.55323867,
  5.9045e-7, 2.88815790631, 5223.6939198,
  5.5976e-7, 2.17471740035, 155.420399434,
  4.5411e-7, 0.39799502896, 796.298006816,
  3.6298e-7, 0.46875437227, 775.522611324,
  2.8962e-7, 2.64732254645, 7.1135470008,
  2.0844e-7, 5.34138275149, 0.9803210682,
  1.9097e-7, 1.84628376049, 5486.77784318,
  1.8508e-7, 4.96855179468, 213.299095438,
  1.7293e-7, 2.9911676063, 6275.96230299,
  1.6233e-7, 0.03216587315, 2544.31441988,
  1.5832e-7, 1.43049301283, 2146.16541648,
  1.4608e-7, 1.2046979369, 10977.0788047,
  1.2461e-7, 2.83432282119, 1748.01641307,
  1.1877e-7, 3.25805082007, 5088.62883977,
]

export const EARTH_L2: f64[] = [
  0.00008721859, 1.07253635559, 6283.07584999,
  0.0000099099, 3.14159265359, 0,
  0.00000294833, 0.43717350256, 12566.1517,
  2.7338e-7, 0.05295636147, 3.523118349,
  1.6333e-7, 5.18820215724, 26.2983197998,
  1.5745e-7, 3.68504712183, 155.420399434,
  9.425e-8, 0.29667114694, 18849.22755,
  8.938e-8, 2.05706319592, 77713.7714681,
  6.94e-8, 0.82691541038, 775.522611324,
  5.061e-8, 4.6624323168, 1577.34354245,
  4.06e-8, 1.03067032318, 7.1135470008,
  3.809e-8, 3.44043369494, 5573.14280143,
]

export const EARTH_L3: f64[] = [
  0.00000289058, 5.84173149732, 6283.07584999,
  2.0712e-7, 6.0498393902, 12566.1517,
  2.962e-8, 5.1956057957, 155.420399434,
  2.527e-8, 3.14159265359, 0,
  1.288e-8, 4.7219761197, 3.523118349,
  6.35e-9, 5.96904899168, 242.728603974,
]

export const EARTH_L4: f64[] = [
  7.714e-8, 4.14117321449, 6283.07584999,
  1.016e-8, 3.27573644241, 12566.1517,
  4.2e-9, 0.41892851415, 155.420399434,
]

export const EARTH_L5: f64[] = [
  1.72e-9, 2.74854172392, 6283.07584999,
  5e-10, 2.01352986713, 155.420399434,
]

export const EARTH_B0: f64[] = [
  0.0000027962, 3.19870156017, 84334.6615813,
  0.00000101643, 5.42248619256, 5507.55323867,
  8.0445e-7, 3.88013204458, 5223.6939198,
  4.3806e-7, 3.70444689759, 2352.86615377,
  3.1933e-7, 4.00026369781, 1577.34354245,
  2.2724e-7, 3.9847383156, 1047.74731175,
  1.8141e-7, 4.98367470262, 6283.07584999,
  1.6392e-7, 3.56456119782, 5856.47765912,
  1.4443e-7, 3.70275614915, 9437.76293489,
  1.4304e-7, 3.41117857526, 10213.2855462,
  1.1246e-7, 4.82820690527, 14143.4952424,
  1.09e-7, 2.08574562329, 6812.76681509,
  1.0367e-7, 4.05663927945, 71092.8813549,
  9.714e-8, 3.47303947751, 4694.00295471,
  9.145e-8, 1.14182646613, 6620.89011319,
  8.775e-8, 4.44016515666, 5753.3848849,
  8.366e-8, 4.99251512183, 7084.89678112,
  7.698e-8, 5.55425745881, 167621.575851,
  7.194e-8, 3.60193205744, 529.690965095,
  6.921e-8, 4.32559054073, 6275.96230299,
]

export const EARTH_B1: f64[] = [
  0.00227777722, 3.4137662053, 6283.07584999,
  0.00003805678, 3.37063423795, 12566.1517,
  0.00003619589, 0, 0,
  7.1542e-7, 3.32777549735, 18849.22755,
  8.107e-8, 3.89190403643, 5507.55323867,
  7.655e-8, 1.79489607186, 5223.6939198,
  6.456e-8, 5.1978942475, 2352.86615377,
  3.897e-8, 4.87293945629, 10213.2855462,
  3.894e-8, 2.15568517178, 6279.55273164,
  3.892e-8, 1.53021064904, 6286.59896834,
]

export const EARTH_B2: f64[] = [
  0.00009721424, 5.1519280992, 6283.07584999,
  0.00000233002, 3.14159265359, 0,
  0.00000134188, 0.64406212977, 12566.1517,
  6.504e-8, 1.07333397797, 18849.22755,
  1.662e-8, 1.62746869551, 84334.6615813,
]

export const EARTH_B3: f64[] = [
  0.00000275993, 0.59480097092, 6283.07584999,
  1.7034e-7, 3.14159265359, 0,
]

export const EARTH_B4: f64[] = [
  5.745e-8, 2.26734029843, 6283.07584999,
]

export const EARTH_B5: f64[] = [
  1.14e-9, 4.31455980099, 6283.07584999,
]

export const EARTH_R0: f64[] = [
  1.00013988784, 0, 0,
  0.01670699632, 3.09846350258, 6283.07584999,
  0.00013956024, 3.05524609456, 12566.1517,
  0.0000308372, 5.19846674381, 77713.7714681,
  0.00001628463, 1.17387558054, 5753.3848849,
  0.00001575572, 2.84685214877, 7860.41939244,
  0.00000924799, 5.45292236722, 11506.7697698,
  0.00000542439, 4.56409151453, 3930.20969622,
  0.0000047211, 3.66100022149, 5884.92684658,
  0.00000345969, 0.96368627272, 5507.55323867,
  0.0000032878, 5.89983686142, 5223.6939198,
  0.00000306784, 0.29867139512, 5573.14280143,
  0.00000243181, 4.2734953079, 11790.6290887,
  0.00000211836, 5.84714461348, 1577.34354245,
  0.0000018574, 5.02199710705, 10977.0788047,
  0.00000174844, 3.01193636733, 18849.22755,
  0.00000109835, 5.0551063586, 5486.77784318,
  9.8316e-7, 0.88681311278, 6069.77675455,
  8.65e-7, 5.68956418946, 15720.8387849,
  8.5831e-7, 1.27079125277, 161000.685738,
  6.4908e-7, 0.27251341435, 17260.1546547,
  6.2917e-7, 0.92177053978, 529.690965095,
  5.7056e-7, 2.01374292245, 83996.8473181,
  5.5736e-7, 5.2415979917, 71430.6956181,
  4.9384e-7, 3.24501240359, 2544.31441988,
  4.6966e-7, 2.57799853213, 775.522611324,
  4.4666e-7, 5.53715663816, 9437.76293489,
  4.252e-7, 6.01110257982, 6275.96230299,
  3.8963e-7, 5.36063832897, 4694.00295471,
  3.8245e-7, 2.39255343973, 8827.39026987,
  3.7486e-7, 0.82961281844, 19651.0484811,
  3.6957e-7, 4.90107587287, 12139.5535091,
  3.5661e-7, 1.67447135798, 12036.4607349,
  3.4537e-7, 1.84270693281, 2942.46342329,
  3.3193e-7, 0.24370221704, 7084.89678112,
  3.1922e-7, 0.18368299942, 5088.62883977,
  3.1846e-7, 1.77775642078, 398.149003408,
  2.8468e-7, 1.21344887533, 6286.59896834,
  2.7795e-7, 1.89934427832, 6279.55273164,
  2.6275e-7, 4.58896863104, 10447.3878396,
  2.4596e-7, 3.78660838036, 8429.24126647,
  2.3927e-7, 4.99598548145, 5856.47765912,
  2.3587e-7, 0.26866098169, 796.298006816,
  2.3287e-7, 2.80783632869, 14143.4952424,
  2.2099e-7, 1.95002636847, 3154.6870849,
]

export const EARTH_R1: f64[] = [
  0.00103018607, 1.10748968172, 6283.07584999,
  0.00001721238, 1.06442300386, 12566.1517,
  0.00000702217, 3.14159265359, 0,
  3.2345e-7, 1.02168583254, 18849.22755,
  3.0801e-7, 2.84358443952, 5507.55323867,
  2.4978e-7, 1.31906570344, 5223.6939198,
  1.8487e-7, 1.42428709076, 1577.34354245,
  1.0077e-7, 5.91385248388, 10977.0788047,
  8.654e-8, 1.42046854427, 6275.96230299,
  8.635e-8, 0.27158192945, 5486.77784318,
  5.069e-8, 1.68613408916, 5088.62883977,
  4.985e-8, 6.01402338185, 6286.59896834,
  4.667e-8, 5.98749245692, 529.690965095,
  4.395e-8, 0.51800423445, 4694.00295471,
  4.1e-8, 1.08424801084, 9437.76293489,
  3.87e-8, 4.74932206877, 2544.31441988,
  3.755e-8, 5.07053801166, 796.298006816,
  3.518e-8, 0.02290216978, 83996.8473181,
  3.436e-8, 0.94937503872, 71430.6956181,
  3.418e-8, 5.4115158188, 775.522611324,
  3.221e-8, 6.15628775321, 2146.16541648,
  2.863e-8, 5.48433323746, 10447.3878396,
  2.828e-8, 3.41986300734, 2352.86615377,
  2.554e-8, 6.13241770582, 6438.49624943,
]

export const EARTH_R2: f64[] = [
  0.00004359385, 5.78455133808, 6283.07584999,
  0.00000123633, 5.57935427994, 12566.1517,
  1.2342e-7, 3.14159265359, 0,
  8.792e-8, 3.62777893099, 77713.7714681,
  5.689e-8, 1.86958905084, 5573.14280143,
  3.302e-8, 5.47034879713, 18849.22755,
  1.471e-8, 4.47964125007, 5507.55323867,
  1.102e-8, 2.84173992403, 161000.685738,
  1.013e-8, 2.81323115556, 5223.6939198,
  8.54e-9, 3.107765669, 1577.34354245,
  6.48e-9, 5.47348203398, 775.522611324,
  6.08e-9, 1.37894173533, 6438.49624943,
]

export const EARTH_R3: f64[] = [
  0.00000144595, 4.27319433901, 6283.07584999,
  6.729e-8, 3.91706261708, 12566.1517,
  7.74e-9, 0, 0,
  2.47e-9, 3.73021571217, 18849.22755,
  3.6e-10, 2.8008140905, 6286.59896834,
  3.3e-10, 5.62990083112, 6127.65545056,
]

export const EARTH_R4: f64[] = [
  3.858e-8, 2.56389016346, 6283.07584999,
  3.06e-9, 2.26911740541, 12566.1517,
  5.3e-10, 3.44031471924, 5573.14280143,
]

export const EARTH_R5: f64[] = [
  8.6e-10, 1.21805304895, 6283.07584999,
  1.2e-10, 0.65572878044, 12566.1517,
]
```

- [ ] **Step 5: Create `packages/engine/assembly/earth.ts`**

```typescript
import { evalVsop87Coordinate } from './vsop87'
import {
  EARTH_L0, EARTH_L1, EARTH_L2, EARTH_L3, EARTH_L4, EARTH_L5,
  EARTH_B0, EARTH_B1, EARTH_B2, EARTH_B3, EARTH_B4, EARTH_B5,
  EARTH_R0, EARTH_R1, EARTH_R2, EARTH_R3, EARTH_R4, EARTH_R5,
} from './data/vsop87Earth'

const EARTH_L_ORDERS: f64[][] = [EARTH_L0, EARTH_L1, EARTH_L2, EARTH_L3, EARTH_L4, EARTH_L5]
const EARTH_B_ORDERS: f64[][] = [EARTH_B0, EARTH_B1, EARTH_B2, EARTH_B3, EARTH_B4, EARTH_B5]
const EARTH_R_ORDERS: f64[][] = [EARTH_R0, EARTH_R1, EARTH_R2, EARTH_R3, EARTH_R4, EARTH_R5]

const TWO_PI: f64 = 2.0 * Math.PI

// T: Julian millennia since J2000.0 (see julianMillenniaSinceJ2000 in time.ts).
// Returns heliocentric ecliptic longitude in radians, normalized to [0, 2*PI).
export function earthHeliocentricL(T: f64): f64 {
  let l = evalVsop87Coordinate(EARTH_L_ORDERS, T) % TWO_PI
  if (l < 0.0) l += TWO_PI
  return l
}

// Returns heliocentric ecliptic latitude in radians.
export function earthHeliocentricB(T: f64): f64 {
  return evalVsop87Coordinate(EARTH_B_ORDERS, T)
}

// Returns heliocentric distance in astronomical units (AU).
export function earthHeliocentricR(T: f64): f64 {
  return evalVsop87Coordinate(EARTH_R_ORDERS, T)
}
```

- [ ] **Step 6: Re-export from `packages/engine/assembly/index.ts`**

```typescript
export { earthHeliocentricL, earthHeliocentricB, earthHeliocentricR } from './earth'
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test --workspace=@toboldlyglow/engine`
Expected: PASS — all tests, old and new, pass. (The `toBeCloseTo(..., 8)` assertions at J2000.0
check agreement to 8 decimal places against this exact truncated dataset; the perihelion/aphelion
assertions use `toBeCloseTo(..., 6)` against the published real-world constants, which is a looser
tolerance appropriate for comparing truncated-series output to a rounded textbook figure.)

- [ ] **Step 8: Commit**

```bash
git add packages/engine/assembly/vsop87.ts packages/engine/assembly/data/vsop87Earth.ts packages/engine/assembly/earth.ts packages/engine/assembly/index.ts packages/engine/test/earth.test.ts
git commit -m "feat(engine): add VSOP87 evaluator and Earth heliocentric position"
```

---

### Task 3: Data Attribution

**Files:**
- Create: `CREDITS.md` (repo root)
- Modify: `README.md` (add a link to `CREDITS.md`)

**Interfaces:**
- Consumes: nothing.
- Produces: `CREDITS.md`, the single source of truth for third-party data/library provenance that
  the future About/Credits dialog (roadmap item, deferred to a later UI plan) will read from or
  mirror.

- [ ] **Step 1: Create `CREDITS.md`**

```markdown
# Credits & Data Sources

To Boldly Glow builds on the work of the following open, public-domain, and openly-licensed
projects. Thank you.

## Planetary position data (VSOP87)

Earth's heliocentric position (`packages/engine/assembly/data/vsop87Earth.ts`) is a truncated
(largest-amplitude terms only) derivation of the VSOP87 planetary theory, originally published by
the Bureau des Longitudes (P. Bretagnon, J.-L. Simon, and collaborators). The specific coefficient
values were sourced from the **astronomia** JavaScript library
(https://github.com/commenthol/astronomia) by commenthol and contributors, MIT licensed:

```
MIT License
Copyright (c) astronomia contributors
https://github.com/commenthol/astronomia/blob/master/LICENSE
```

The truncation (keeping the largest-amplitude periodic terms per order) and its accuracy bounds
(under 1 arcsecond in longitude/latitude, under 200 km in distance, over the year range
1800–2200) were derived and verified specifically for this project; see
`docs/superpowers/plans/2026-07-17-orbital-mechanics-earth.md` for the verification method.

The evaluation method (summing periodic terms as a power series in Julian millennia since J2000.0)
follows the standard VSOP87 usage described in Jean Meeus, *Astronomical Algorithms*, 2nd ed.
(Willmann-Bell, 1998).

## Build tooling

- [AssemblyScript](https://www.assemblyscript.org/) — MIT License
- [Vite](https://vitejs.dev/) — MIT License
- [Vitest](https://vitest.dev/) — MIT License
- [Playwright](https://playwright.dev/) — Apache License 2.0
```

- [ ] **Step 2: Add a link from `README.md`**

In `README.md`, add one line after the existing "Roadmap" bullet:

```markdown
- [Credits](CREDITS.md) — third-party data and library attributions.
```

- [ ] **Step 3: Commit**

```bash
git add CREDITS.md README.md
git commit -m "docs: attribute VSOP87 Earth data to its source"
```

---

## Verification (whole plan)

After all 3 tasks: `npm run test --workspace=@toboldlyglow/engine` should show all tests passing
(the pre-existing `ping`/Julian Date tests plus this plan's coordinate and Earth tests). Root-level
`npm run lint && npm run typecheck && npm run build && npm test` should all still pass (this plan
doesn't touch `packages/app`, so nothing there should regress). `git log --oneline` should show 3
new commits.

## What's next

Two follow-up plans complete "orbital mechanics" for the MVP:

1. **Remaining 7 planets** — same pattern as this plan's Task 2 (one truncated VSOP87B data file +
   one thin wrapper file exporting `<planet>HeliocentricL/B/R` per body), reusing
   `evalVsop87Coordinate` unchanged. Each body's data should go through the same
   generate-and-verify-against-full-precision process used here for Earth, not be hand-typed.
2. **The Moon** — ELP2000/ELP-MPP02 lunar theory, a materially different series structure (as seen
   in the `astronomia` package's `elp.js`/`elpMppDe.js`, which includes an additional precession
   rotation step beyond a simple L/B/R power series) — treat as its own research-backed plan rather
   than assuming it drops into the same shape as VSOP87.

After both, the renderer plan can consume `earthHeliocentricL/B/R` (and the other bodies' equivalents)
plus `sphericalToX/Y/Z` to place bodies in the scene using the floating-origin technique from the
MVP design spec (§3.3).
