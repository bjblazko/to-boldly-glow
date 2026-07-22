# Seasons Lesson Orbit-Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepend four new "real orbit" chapters to the existing "Why does Earth have seasons?" lesson, showing Earth actually orbiting the Sun with its axis held in one fixed direction, before cutting to the existing staged diagram.

**Architecture:** `Chapter` gains a `kind: 'orbit' | 'staged'` field. Orbit chapters reuse `seasonPhaseDegrees` to place Earth on a new compact circular orbit path (not the real elliptical explore-mode orbit) instead of tilting its axis; the axis itself is a single world-space constant throughout. A second one-time camera preset (`applyOrbitCameraFraming`) mirrors the existing `applyLearnCameraFraming` pattern - set once, hard-cut (never animated) at the orbit/staged chapter-kind boundary. A parallel, separate set of overlay lines (orbit path circle, fixed axis, current Sun-Earth reference, connecting arc) reuses the existing overlay-line rendering pipeline and the existing `axisTiltLabel` element, but Location A/B markers are omitted entirely during orbit chapters.

**Tech Stack:** TypeScript, hand-rolled WebGPU (no Three.js), gl-matrix, Vite, Vitest, Playwright.

## Global Constraints

- `Chapter.kind` is `'orbit' | 'staged'` - every existing chapter gets an explicit `kind: 'staged'` tag (not inferred).
- The 4 new chapters are, in this exact order, prepended before `intro`: `orbit-march` (phase 270), `orbit-june` (phase 0), `orbit-september` (phase 90), `orbit-december` (phase 180). Lesson goes from 5 to 9 chapters.
- Camera framing is a **hard cut** at the orbit/staged boundary - no animated transition, ever, matching this lesson's established "camera never moves during a lesson" rule (violating this caused two real bugs earlier in this project).
- The fixed axis reused throughout the orbit chapters must be **the same obliquity constant (23.4 degrees) and the same "X leans, remainder makes up the rest" shape as `seasonalPoleDirection`'s solstice value**, but re-expressed in this app's Z-up ecliptic convention (`ECLIPTIC_NORTH = [0,0,1]`, the same convention `axisAlignmentRotation` and every real body's pole already use) rather than `seasonalPoleDirection`'s own Y-up convention (built specifically for the staged camera's different `upAxis`). Reusing `seasonalPoleDirection(0)`'s raw numbers directly would misinterpret the vector under `axisAlignmentRotation` and look wrong from the orbit camera - this is a deliberate, documented deviation from a literal reading of the design spec's §5 wording, made necessary by the two chapter kinds using different up-axis conventions.
- Location A/B markers and their labels are never shown during orbit chapters.
- No changes to `seasonalPoleDirection`, `EARTH_STAGED_POSITION`/`EARTH_STAGED_RADIUS`, the staged camera preset, the location-marker latitude/longitude constants, or the declutter (orbit-paths/labels/flares) snapshot-restore behavior, which applies across the whole lesson regardless of chapter kind.

---

## Task 1: Chapter data model and the 4 new orbit chapters

**Files:**
- Modify: `packages/app/src/learn/lessonTypes.ts`
- Modify: `packages/app/src/learn/lessons/seasons.ts`
- Modify: `packages/app/test/seasonsLesson.test.ts`

**Interfaces:**
- Produces: `Chapter.kind: 'orbit' | 'staged'`, consumed by Task 3's rendering/camera logic and Task 4's e2e assertions (`data-chapter-kind`, set from this field).
- No consumers within this task - this is pure data, fully self-contained, and does not touch `main.ts`.

- [ ] **Step 1: Add `kind` to the `Chapter` interface**

Modify `packages/app/src/learn/lessonTypes.ts`:

```ts
// A chapter of a lesson. `kind` distinguishes the two halves of the "seasons" lesson: 'orbit'
// chapters show Earth's real position in its orbit (with its axis held in a single fixed
// direction - see main.ts's ORBIT_FIXED_POLE_DIRECTION), 'staged' chapters show the existing
// simplified diagram (fixed position, tilting axis - see main.ts's seasonalPoleDirection).
// `seasonPhaseDegrees` is this chapter's fixed position in an idealized annual cycle (0 = June
// solstice, 90 = September equinox, 180 = December solstice, 270 = March equinox), reused with a
// different meaning per kind: for 'staged' chapters it drives Earth's tilt orientation; for
// 'orbit' chapters it drives Earth's position on the compact orbit path instead (see main.ts's
// orbitPositionForPhase). There is no calendar date or scrub position in this design - each
// chapter is a fixed diagram, not a real date range.
export interface Chapter {
  id: string
  title: string
  kind: 'orbit' | 'staged'
  seasonPhaseDegrees: number
  text: string
}

export interface Lesson {
  id: string
  title: string
  chapters: Chapter[]
  // Latitude magnitude (degrees) for the two symmetric, always-visible location markers - one at
  // +markerLatitudeDegrees, one at -markerLatitudeDegrees. Only ever used for 'staged' chapters -
  // the two markers are never shown during 'orbit' chapters (see the design spec's §4).
  markerLatitudeDegrees: number
}
```

- [ ] **Step 2: Replace `seasons.ts`'s chapter list with the 4 new orbit chapters prepended, and `kind` added to the existing 5**

Replace the full contents of `packages/app/src/learn/lessons/seasons.ts`:

```ts
import type { Chapter, Lesson } from '../lessonTypes'

const CHAPTERS: Chapter[] = [
  {
    id: 'orbit-march',
    title: 'Real March Equinox',
    kind: 'orbit',
    seasonPhaseDegrees: 270,
    text:
      "This is Earth's real position in its orbit around the Sun in March. Its axis points the " +
      'same fixed direction in space it always does - what changes as Earth orbits is not the ' +
      'axis, but where Earth is relative to the Sun.',
  },
  {
    id: 'orbit-june',
    title: 'Real June Solstice',
    kind: 'orbit',
    seasonPhaseDegrees: 0,
    text:
      "Three months later, Earth has moved to this point in its orbit. Its axis hasn't moved at " +
      "all - it points the exact same fixed direction as before. But because Earth is now here, " +
      'that same axis leans 23.4° toward the Sun.',
  },
  {
    id: 'orbit-september',
    title: 'Real September Equinox',
    kind: 'orbit',
    seasonPhaseDegrees: 90,
    text:
      "Another three months on, and Earth's axis still hasn't moved - same fixed direction as " +
      'every chapter so far. From here, though, it leans neither toward nor away from the Sun.',
  },
  {
    id: 'orbit-december',
    title: 'Real December Solstice',
    kind: 'orbit',
    seasonPhaseDegrees: 180,
    text:
      'Half a year after June, Earth has orbited around to the opposite side of the Sun. The ' +
      "axis is still pointing the same fixed direction it always has - now that puts it 23.4° " +
      'away from the Sun instead of toward it. Watch how the next chapters show the same idea a ' +
      'different way.',
  },
  {
    id: 'intro',
    title: 'Intro: A Tilted World',
    // Shows the full 23.4-degree lean (same phase as june-solstice) so the picture backs up this
    // chapter's own opening sentence - an equinox-like 0-degree phase here would show a perfectly
    // upright axis while the text claims a visible 23.4-degree tilt, directly contradicting it.
    kind: 'staged',
    seasonPhaseDegrees: 0,
    text:
      "Earth's axis is tilted 23.4° relative to its orbit around the Sun. This tilt - not Earth's " +
      'distance from the Sun, which barely changes over a year - is what causes the seasons. Watch ' +
      'Location A (north) and Location B (south) as you step through the chapters below.',
  },
  {
    id: 'march-equinox',
    title: 'March Equinox',
    kind: 'staged',
    seasonPhaseDegrees: 270,
    text:
      "Around the March equinox, the Sun sits directly over Earth's equator. Location A and " +
      'Location B get close to equal day and night length.',
  },
  {
    id: 'june-solstice',
    title: 'June Solstice',
    kind: 'staged',
    seasonPhaseDegrees: 0,
    text:
      'The June solstice: the north pole tilts toward the Sun. Location A (north) gets longer days ' +
      'and more direct sunlight - summer. Location B (south) gets shorter days and more oblique ' +
      'sunlight - winter.',
  },
  {
    id: 'september-equinox',
    title: 'September Equinox',
    kind: 'staged',
    seasonPhaseDegrees: 90,
    text:
      'Around the September equinox, the Sun is back over the equator. Location A and Location B ' +
      'get close to equal day and night again - the reverse trend from March.',
  },
  {
    id: 'december-solstice',
    title: 'December Solstice',
    kind: 'staged',
    seasonPhaseDegrees: 180,
    text:
      'The December solstice: the south pole tilts toward the Sun. Location B (south) gets longer ' +
      'days and more direct sunlight - summer. Location A (north) gets shorter days and more ' +
      'oblique sunlight - winter.',
  },
]

export const SEASONS_LESSON: Lesson = {
  id: 'seasons',
  title: 'Why does Earth have seasons?',
  chapters: CHAPTERS,
  markerLatitudeDegrees: 45,
}

export const LESSONS_BY_ID: Record<string, Lesson> = {
  [SEASONS_LESSON.id]: SEASONS_LESSON,
}
```

- [ ] **Step 3: Run typecheck to confirm the data model change compiles**

Run: `cd packages/app && npm run typecheck`
Expected: passes with no errors (this task doesn't touch `main.ts`, so nothing there references `kind` yet).

- [ ] **Step 4: Update `seasonsLesson.test.ts` for 9 chapters, the new order, and `kind`**

Replace the full contents of `packages/app/test/seasonsLesson.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LESSONS_BY_ID, SEASONS_LESSON } from '../src/learn/lessons/seasons'

describe('SEASONS_LESSON', () => {
  it('has exactly 9 chapters in chronological order (4 real-orbit chapters, then the 5 staged ones)', () => {
    expect(SEASONS_LESSON.chapters).toHaveLength(9)
    const ids = SEASONS_LESSON.chapters.map((c) => c.id)
    expect(ids).toEqual([
      'orbit-march',
      'orbit-june',
      'orbit-september',
      'orbit-december',
      'intro',
      'march-equinox',
      'june-solstice',
      'september-equinox',
      'december-solstice',
    ])
  })

  it('the 4 orbit chapters are tagged kind "orbit" and the 5 staged chapters are tagged kind "staged"', () => {
    const orbitIds = ['orbit-march', 'orbit-june', 'orbit-september', 'orbit-december']
    const stagedIds = ['intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice']
    for (const id of orbitIds) {
      expect(SEASONS_LESSON.chapters.find((c) => c.id === id)!.kind).toBe('orbit')
    }
    for (const id of stagedIds) {
      expect(SEASONS_LESSON.chapters.find((c) => c.id === id)!.kind).toBe('staged')
    }
  })

  it('every chapter has a season phase in [0, 360) degrees', () => {
    for (const chapter of SEASONS_LESSON.chapters) {
      expect(chapter.seasonPhaseDegrees).toBeGreaterThanOrEqual(0)
      expect(chapter.seasonPhaseDegrees).toBeLessThan(360)
    }
  })

  it('the four staged solstice/equinox chapters use the four cardinal phases exactly once each', () => {
    const stagedNonIntro = SEASONS_LESSON.chapters.filter((c) => c.kind === 'staged' && c.id !== 'intro')
    const phases = stagedNonIntro.map((c) => c.seasonPhaseDegrees).sort((a, b) => a - b)
    expect(phases).toEqual([0, 90, 180, 270])
  })

  it('the four orbit chapters use the four cardinal phases exactly once each', () => {
    const orbitChapters = SEASONS_LESSON.chapters.filter((c) => c.kind === 'orbit')
    const phases = orbitChapters.map((c) => c.seasonPhaseDegrees).sort((a, b) => a - b)
    expect(phases).toEqual([0, 90, 180, 270])
  })

  // Intro's own text opens with "Earth's axis is tilted 23.4 degrees" - showing a neutral,
  // equinox-like 0-degree phase here would render a perfectly upright axis, directly contradicting
  // that opening sentence. Intro must show a visible tilt, matching one of the two solstices.
  it('Intro uses a solstice phase, so the picture backs up its own "tilted 23.4 degrees" opening line', () => {
    const intro = SEASONS_LESSON.chapters.find((c) => c.id === 'intro')!
    expect([0, 180]).toContain(intro.seasonPhaseDegrees)
  })

  it('every chapter has non-empty text', () => {
    for (const chapter of SEASONS_LESSON.chapters) {
      expect(chapter.text.length).toBeGreaterThan(0)
    }
  })

  it('June and December solstice text each mention both locations by name', () => {
    const june = SEASONS_LESSON.chapters.find((c) => c.id === 'june-solstice')!
    const december = SEASONS_LESSON.chapters.find((c) => c.id === 'december-solstice')!
    for (const chapter of [june, december]) {
      expect(chapter.text).toContain('Location A')
      expect(chapter.text).toContain('Location B')
    }
  })

  it('markerLatitudeDegrees is a single positive magnitude (the two markers are its +/- mirror)', () => {
    expect(SEASONS_LESSON.markerLatitudeDegrees).toBeGreaterThan(0)
    expect(SEASONS_LESSON.markerLatitudeDegrees).toBeLessThan(90)
  })

  it('is registered in LESSONS_BY_ID under "seasons"', () => {
    expect(LESSONS_BY_ID['seasons']).toBe(SEASONS_LESSON)
  })
})
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/app && npx vitest run test/seasonsLesson.test.ts`
Expected: all tests pass (9 tests).

- [ ] **Step 6: Run the full unit suite to confirm no regressions**

Run: `cd packages/app && npx vitest run`
Expected: all existing tests still pass (this task doesn't touch any code any other test imports).

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/learn/lessonTypes.ts packages/app/src/learn/lessons/seasons.ts packages/app/test/seasonsLesson.test.ts
git commit -m "Add kind field and 4 new real-orbit chapters to the seasons lesson"
```

---

## Task 2: New pure geometry/math functions for the orbit chapters

**Files:**
- Modify: `packages/app/src/learn/overlayGeometry.ts`
- Modify: `packages/app/src/main.ts` (only: add `ORBIT_OBLIQUITY_RADIANS`/`ORBIT_FIXED_POLE_DIRECTION` constants near `seasonalPoleDirection`, plus the new overlayGeometry imports - no other changes; the render loop/camera/chapter-navigation code is untouched until Task 3)
- Test: `packages/app/test/orbitOverlay.test.ts` (new)

**Interfaces:**
- Consumes: nothing from Task 1 (fully independent - these are pure functions with no `Chapter`/`Lesson` dependency).
- Produces (all consumed by Task 3):
  - `orbitPositionForPhase(phaseDegrees: number, orbitRadius: number): [number, number, number]`
  - `orbitPathCirclePoints(radius: number, segments: number): Float32Array`
  - `directedLinePoints(center: readonly [number, number, number], direction: readonly [number, number, number], length: number): Float32Array`
  - `greatCircleArcPoints(center: readonly [number, number, number], fromDirection: readonly [number, number, number], toDirection: readonly [number, number, number], radius: number, segments: number): Float32Array`
  - `angleBetweenDirections(a: readonly [number, number, number], b: readonly [number, number, number]): number` (radians, always in `[0, PI]`)
  - `ORBIT_FIXED_POLE_DIRECTION: [number, number, number]` (exported `const` from `main.ts`)

- [ ] **Step 1: Write the failing tests**

Create `packages/app/test/orbitOverlay.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  angleBetweenDirections,
  directedLinePoints,
  greatCircleArcPoints,
  orbitPathCirclePoints,
  orbitPositionForPhase,
} from '../src/learn/overlayGeometry'
import { ORBIT_FIXED_POLE_DIRECTION } from '../src/main'

describe('orbitPositionForPhase', () => {
  it('places Earth on a circle of the given radius, at the angle equal to the phase itself', () => {
    const expectedUnitDirections: Record<number, [number, number, number]> = {
      0: [1, 0, 0],
      90: [0, 1, 0],
      180: [-1, 0, 0],
      270: [0, -1, 0],
    }
    for (const [phase, expected] of Object.entries(expectedUnitDirections)) {
      const [x, y, z] = orbitPositionForPhase(Number(phase), 5)
      expect(x).toBeCloseTo(expected[0] * 5, 9)
      expect(y).toBeCloseTo(expected[1] * 5, 9)
      expect(z).toBeCloseTo(0, 9)
    }
  })
})

describe('orbitPathCirclePoints', () => {
  it('traces a closed loop of the given radius in the world X-Y plane', () => {
    const points = orbitPathCirclePoints(5, 32)
    expect(points.length).toBe((32 + 1) * 3)
    for (let i = 0; i <= 32; i++) {
      expect(Math.hypot(points[i * 3], points[i * 3 + 1])).toBeCloseTo(5, 9)
      expect(points[i * 3 + 2]).toBeCloseTo(0, 9)
    }
    expect(points[0]).toBeCloseTo(points[32 * 3], 9)
    expect(points[1]).toBeCloseTo(points[32 * 3 + 1], 9)
  })
})

describe('directedLinePoints', () => {
  it('returns two points straddling center, `length` apart in each direction along `direction`', () => {
    const points = directedLinePoints([2, 0, 0], [0, 1, 0], 3)
    expect(points.length).toBe(6)
    expect(points[0]).toBeCloseTo(2, 9)
    expect(points[1]).toBeCloseTo(-3, 9)
    expect(points[2]).toBeCloseTo(0, 9)
    expect(points[3]).toBeCloseTo(2, 9)
    expect(points[4]).toBeCloseTo(3, 9)
    expect(points[5]).toBeCloseTo(0, 9)
  })

  it('normalizes a non-unit direction vector first', () => {
    const points = directedLinePoints([0, 0, 0], [0, 2, 0], 1)
    expect(points[4]).toBeCloseTo(1, 9)
  })
})

describe('greatCircleArcPoints', () => {
  it('starts at fromDirection and ends at toDirection, staying at radius from center throughout', () => {
    const points = greatCircleArcPoints([1, 1, 1], [1, 0, 0], [0, 1, 0], 2, 16)
    expect(points[0]).toBeCloseTo(1 + 2, 9)
    expect(points[1]).toBeCloseTo(1, 9)
    expect(points[2]).toBeCloseTo(1, 9)
    const lastX = points[16 * 3]
    const lastY = points[16 * 3 + 1]
    expect(lastX).toBeCloseTo(1, 9)
    expect(lastY).toBeCloseTo(1 + 2, 9)
    for (let i = 0; i <= 16; i++) {
      const dx = points[i * 3] - 1
      const dy = points[i * 3 + 1] - 1
      const dz = points[i * 3 + 2] - 1
      expect(Math.hypot(dx, dy, dz)).toBeCloseTo(2, 9)
    }
  })

  it('returns every point at fromDirection when the two directions already coincide', () => {
    const points = greatCircleArcPoints([0, 0, 0], [1, 0, 0], [1, 0, 0], 1, 8)
    for (let i = 0; i <= 8; i++) {
      expect(points[i * 3]).toBeCloseTo(1, 9)
      expect(points[i * 3 + 1]).toBeCloseTo(0, 9)
      expect(points[i * 3 + 2]).toBeCloseTo(0, 9)
    }
  })
})

describe('angleBetweenDirections', () => {
  it('returns 0 for identical directions and PI for opposite ones', () => {
    expect(angleBetweenDirections([1, 0, 0], [1, 0, 0])).toBeCloseTo(0, 9)
    expect(angleBetweenDirections([1, 0, 0], [-1, 0, 0])).toBeCloseTo(Math.PI, 9)
  })

  it('returns PI/2 for perpendicular directions', () => {
    expect(angleBetweenDirections([1, 0, 0], [0, 1, 0])).toBeCloseTo(Math.PI / 2, 9)
  })

  it('normalizes non-unit inputs first', () => {
    expect(angleBetweenDirections([5, 0, 0], [0, 3, 0])).toBeCloseTo(Math.PI / 2, 9)
  })
})

describe('ORBIT_FIXED_POLE_DIRECTION', () => {
  it('is a unit vector', () => {
    const [x, y, z] = ORBIT_FIXED_POLE_DIRECTION
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9)
  })

  // The whole pedagogical point of the orbit chapters: the SAME fixed axis, combined with the
  // Sun-Earth direction at each of the four orbit phases, reproduces the exact 23.4/0-degree
  // pattern the staged chapters already show via a completely different mechanism (a rotating
  // axis at a fixed position, instead of a fixed axis at a rotating position).
  it('reproduces the 23.4/0-degree sequence at the four orbit-chapter phases', () => {
    const orbitRadius = 5
    const expectedDegrees: Record<number, number> = { 0: 23.4, 90: 0, 180: 23.4, 270: 0 }
    for (const [phase, expected] of Object.entries(expectedDegrees)) {
      const earthPosition = orbitPositionForPhase(Number(phase), orbitRadius)
      const sunward: [number, number, number] = [-earthPosition[0], -earthPosition[1], -earthPosition[2]]
      const angleRadians = angleBetweenDirections(ORBIT_FIXED_POLE_DIRECTION, sunward)
      const angleDegrees = (angleRadians * 180) / Math.PI
      // The angle between the fixed axis and the sunward direction is 90 degrees at the equinoxes
      // (axis perpendicular to the Sun line) and 90 +/- 23.4 degrees at the solstices - expressed
      // here as "how far from perpendicular", which is exactly the obliquity at the solstices and
      // 0 at the equinoxes, matching seasonalTilt.test.ts's own subsolar-latitude-style check.
      expect(Math.abs(90 - angleDegrees)).toBeCloseTo(expected, 5)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/app && npx vitest run test/orbitOverlay.test.ts`
Expected: FAIL - `orbitPositionForPhase`, `orbitPathCirclePoints`, `directedLinePoints`, `greatCircleArcPoints`, `angleBetweenDirections` are not exported from `overlayGeometry.ts`, and `ORBIT_FIXED_POLE_DIRECTION` is not exported from `main.ts`.

- [ ] **Step 3: Add the new pure functions to `overlayGeometry.ts`**

Append to `packages/app/src/learn/overlayGeometry.ts` (after `latitudeMarkerPoints`, at the end of the file):

```ts

// The angle (radians, always in [0, PI]) between any two arbitrary directions, via the standard
// acos-of-normalized-dot-product formula - normalizes both inputs internally, so callers don't
// need to pre-normalize. Used by the orbit chapters to display "how far apart" the fixed axis and
// the current Sun-Earth direction are (main.ts's per-frame orbit-chapter overlay block), the same
// way the staged chapters' atan2-based tilt angle does for its own fixed-plane case.
export function angleBetweenDirections(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const unitA = vec3.normalize(vec3.create(), a)
  const unitB = vec3.normalize(vec3.create(), b)
  const dot = unitA[0] * unitB[0] + unitA[1] * unitB[1] + unitA[2] * unitB[2]
  return Math.acos(Math.min(1, Math.max(-1, dot)))
}

// A geodesic arc from `fromDirection` to `toDirection` (need not be unit-length - normalized
// internally), centered on `center` at `radius`. Built with spherical linear interpolation
// (gl-matrix's vec3.slerp) rather than a fixed-plane sin/cos parameterization like
// tiltAngleArcPoints above, since the orbit chapters' two directions (the current Sun-Earth line
// and the fixed axis) are only coplanar with a shared fixed world plane at the solstice phases,
// not generally. Guards the case where the two directions already coincide (slerp divides by zero
// there - see cameraFollow.ts's own identical guard, added for the same reason) by returning every
// point at `fromDirection` since there's nothing to sweep.
export function greatCircleArcPoints(
  center: readonly [number, number, number],
  fromDirection: readonly [number, number, number],
  toDirection: readonly [number, number, number],
  radius: number,
  segments: number,
): Float32Array {
  const points = new Float32Array((segments + 1) * 3)
  const from = vec3.normalize(vec3.create(), fromDirection)
  const to = vec3.normalize(vec3.create(), toDirection)
  const nearlyIdentical = vec3.dot(from, to) > 0.9999999
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const direction = nearlyIdentical ? from : vec3.slerp(vec3.create(), from, to, t)
    points[i * 3] = center[0] + radius * direction[0]
    points[i * 3 + 1] = center[1] + radius * direction[1]
    points[i * 3 + 2] = center[2] + radius * direction[2]
  }
  return points
}

// A short line segment through `center`, extending `length` in both directions along `direction`
// (need not be unit-length - normalized internally). Used by the orbit chapters for two roles that
// share this same shape: the fixed axis line (main.ts's ORBIT_FIXED_POLE_DIRECTION, already
// expressed directly in world space, unlike rotationAxisPoints' local +Z which needs a per-body
// matrix transform) and the current Sun-Earth reference line (which rotates chapter to chapter,
// unlike the staged chapters' always-vertical verticalReferencePoints).
export function directedLinePoints(
  center: readonly [number, number, number],
  direction: readonly [number, number, number],
  length: number,
): Float32Array {
  const unit = vec3.normalize(vec3.create(), direction)
  return new Float32Array([
    center[0] - unit[0] * length,
    center[1] - unit[1] * length,
    center[2] - unit[2] * length,
    center[0] + unit[0] * length,
    center[1] + unit[1] * length,
    center[2] + unit[2] * length,
  ])
}

// A closed loop tracing the compact circular path Earth's position moves along during the orbit
// chapters (see orbitPositionForPhase below) - centered on the Sun (the world origin, which this
// lesson never moves - see EARTH_STAGED_POSITION's own comment in main.ts), lying flat in the
// world X-Y plane (matching how every real body's own orbital position in this app already lies
// close to that plane - world Z is "ecliptic north", see poleOrientation.ts's ECLIPTIC_NORTH).
// Unlike equatorRingPoints above, this needs no world-matrix transform: the orbit circle doesn't
// rotate or tilt at any phase.
export function orbitPathCirclePoints(radius: number, segments: number): Float32Array {
  const points = new Float32Array((segments + 1) * 3)
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    points[i * 3] = radius * Math.cos(angle)
    points[i * 3 + 1] = radius * Math.sin(angle)
    points[i * 3 + 2] = 0
  }
  return points
}

// Earth's position on the compact, circular "real orbit" path used by this lesson's orbit
// chapters - NOT the real elliptical orbit-path renderer used in explore mode, and not to any real
// AU scale. Uses the exact same phase convention seasonalPoleDirection uses for its own lean (0 =
// June solstice, 90 = September equinox, 180 = December solstice, 270 = March equinox), applied
// here to a position on a circle instead of a tilt: the Sun-Earth radial direction at phase P is
// [cos(P), sin(P), 0], lying flat in the world X-Y plane (see orbitPathCirclePoints above).
export function orbitPositionForPhase(phaseDegrees: number, orbitRadius: number): [number, number, number] {
  const phase = (phaseDegrees * Math.PI) / 180
  return [orbitRadius * Math.cos(phase), orbitRadius * Math.sin(phase), 0]
}
```

- [ ] **Step 4: Add `ORBIT_FIXED_POLE_DIRECTION` to `main.ts`, and import the new overlayGeometry functions**

Modify `packages/app/src/main.ts`'s existing overlayGeometry import (currently `equatorRingPoints, latitudeMarkerCenter, latitudeMarkerPoints, rotationAxisPoints, tiltAngleArcPoints, verticalReferencePoints`) to add the 5 new names:

```ts
import {
  angleBetweenDirections,
  directedLinePoints,
  equatorRingPoints,
  greatCircleArcPoints,
  latitudeMarkerCenter,
  latitudeMarkerPoints,
  orbitPathCirclePoints,
  orbitPositionForPhase,
  rotationAxisPoints,
  tiltAngleArcPoints,
  verticalReferencePoints,
} from './learn/overlayGeometry'
```

Add this directly after `seasonalPoleDirection`'s closing brace (still before `async function main()`):

```ts
// The fixed direction Earth's real rotation axis points in space, expressed in this app's own
// ecliptic-plane convention (world Z = "ecliptic north" - see poleOrientation.ts's ECLIPTIC_NORTH
// and axisAlignmentRotation's own contract, which every real body's pole already uses) - unlike
// seasonalPoleDirection's Y-up convention, built specifically for the staged chapters' different
// camera upAxis. Computed once and reused unchanged across all four orbit chapters: the entire
// visual point of this lesson's prelude is that this vector does NOT depend on phase, unlike
// seasonalPoleDirection's pole. Uses the same obliquity constant and the same "X leans, remainder
// makes up the rest" shape as seasonalPoleDirection(0)'s own lean, just re-expressed with the
// "remainder" on Z (this convention's up axis) instead of Y.
const ORBIT_OBLIQUITY_RADIANS = (23.4 * Math.PI) / 180
export const ORBIT_FIXED_POLE_DIRECTION: [number, number, number] = [
  -Math.sin(ORBIT_OBLIQUITY_RADIANS),
  0,
  Math.cos(ORBIT_OBLIQUITY_RADIANS),
]
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/app && npx vitest run test/orbitOverlay.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 6: Run typecheck and the full unit suite**

Run: `cd packages/app && npm run typecheck && npx vitest run`
Expected: both pass. The 5 newly imported function names in `main.ts` are unused until Task 3 wires them into the render loop - this project's `tsconfig.base.json` does not set `noUnusedLocals`/`noUnusedParameters`, so `tsc --noEmit` does not flag unused imports and this compiles cleanly as-is.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/learn/overlayGeometry.ts packages/app/src/main.ts packages/app/test/orbitOverlay.test.ts
git commit -m "Add pure orbit-position/angle math for the orbit chapters"
```

---

## Task 3: Camera, rendering, and navigation wiring (main.ts)

This task cannot be split further: the camera-framing hard-cut, the position/pole-direction kind branch, and the new orbit overlay lines are all coupled through the same per-frame render loop and the same chapter-navigation handlers - an intermediate state with only some of these wired up would not typecheck or render meaningfully. This mirrors the prior seasons-redesign plan's Tasks 4/5/6, which were combined for the identical reason.

**Files:**
- Modify: `packages/app/src/main.ts`

**Interfaces:**
- Consumes: `Chapter.kind` (Task 1), `orbitPositionForPhase`/`orbitPathCirclePoints`/`directedLinePoints`/`greatCircleArcPoints`/`angleBetweenDirections`/`ORBIT_FIXED_POLE_DIRECTION` (Task 2, already imported/defined).
- Produces: `lessonPanel.dataset.chapterKind` (consumed by Task 4's e2e assertions).

**Important - expected test breakage:** After this task, three *existing* e2e tests will fail because they assume the lesson's first chapter is `intro` (it's now `orbit-march`): `learnMode.spec.ts`'s "chapter navigation updates lesson-panel state" and "globe overlays and both location markers render..." tests, and `seasonsLessonFlow.spec.ts`'s "full seasons lesson flow" test. **This is expected and is Task 4's job to fix, not this task's.** Do not attempt to fix them here - verify this task via the unit suite (must fully pass) and a manual live-browser check instead of the full e2e suite.

- [ ] **Step 1: Add the orbit camera preset**

Add directly after the existing `applyLearnCameraFraming` function in `packages/app/src/main.ts`:

```ts
  // Wide, mostly top-down shot for the orbit chapters (design spec's §3) - centered on the Sun
  // (which never moves), framed to show the whole compact orbit circle with Earth visible
  // wherever it currently sits on it. Deliberately does NOT override upAxis (contrast with
  // applyLearnCameraFraming's own upAxis override, above) - this view wants the app's normal
  // ecliptic-north-up convention (world Z), matching how every other body's real orbital position
  // already lies in the world X-Y plane, so a high elevation here genuinely reads as "looking down
  // from above." Still explicitly sets upAxis (rather than relying on it already being correct)
  // so this framing function is self-contained regardless of what state the camera was left in.
  // Tune these visually once running, same as LEARN_CAMERA_* above.
  const ORBIT_CAMERA_TARGET: [number, number, number] = [0, 0, 0]
  const ORBIT_CAMERA_RADIUS = 20
  const ORBIT_CAMERA_AZIMUTH = 0
  const ORBIT_CAMERA_ELEVATION = 1.45 // near-vertical (MAX_ELEVATION is PI/2 - 0.01, ~1.5608) - top-down, not degenerate
  const ORBIT_PATH_RADIUS = 6.5 // the compact circle Earth's position moves along
  const ORBIT_EARTH_RADIUS = 0.6 // deliberately smaller than EARTH_STAGED_RADIUS - this is a wide establishing shot, not the close-up

  function applyOrbitCameraFraming(): void {
    vec3.set(orbitCamera.target, ...ORBIT_CAMERA_TARGET)
    orbitCamera.radius = ORBIT_CAMERA_RADIUS
    orbitCamera.azimuth = ORBIT_CAMERA_AZIMUTH
    orbitCamera.elevation = ORBIT_CAMERA_ELEVATION
    vec3.set(orbitCamera.upAxis, ...ECLIPTIC_NORTH)
  }

  // Applies whichever one-time camera preset matches `kind` - called only when the chapter kind
  // actually changes (see goToChapter below), never every navigation, so the camera stays
  // perfectly still across same-kind chapter changes exactly like it always has.
  function applyCameraFramingForKind(kind: 'orbit' | 'staged'): void {
    if (kind === 'orbit') applyOrbitCameraFraming()
    else applyLearnCameraFraming()
  }
```

- [ ] **Step 2: Add the four new orbit overlay lines alongside the existing staged ones**

Modify `packages/app/src/main.ts`'s `createOverlayLineRenderable` function signature - widen the `id` parameter from `OverlayLineId` to `string` (it's only ever used for the GPU buffer's debug `label`, so this is a safe, backward-compatible widening that lets the same helper build orbit-chapter renderables too):

```ts
  function createOverlayLineRenderable(id: string, initialPoints: Float32Array): OverlayLineRenderable {
```

Also widen `OverlayLineRenderable.id`'s type from `OverlayLineId` to `string` in its interface declaration.

Add directly after the existing `overlayLineRenderables`/`OVERLAY_COLORS`/`OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND` block:

```ts
  // Four overlay lines for the orbit chapters (design spec's §4): the compact circular orbit path
  // Earth's position moves along, the fixed axis line, the current Sun-Earth reference line, and
  // the arc between them. A separate set from OVERLAY_LINE_IDS above (the staged chapters' own
  // equator/axis/markers/protractor) - the two chapter kinds never render simultaneously and use
  // genuinely different geometry (world-space-direct here, vs earthWorld-matrix-transformed there).
  const ORBIT_OVERLAY_LINE_IDS = ['orbit-path', 'orbit-axis', 'orbit-reference', 'orbit-arc'] as const
  type OrbitOverlayLineId = (typeof ORBIT_OVERLAY_LINE_IDS)[number]
  const ORBIT_PATH_SEGMENTS = 64
  const orbitOverlayLineRenderables: Record<OrbitOverlayLineId, OverlayLineRenderable> = {
    'orbit-path': createOverlayLineRenderable('orbit-path', new Float32Array((ORBIT_PATH_SEGMENTS + 1) * 3)),
    'orbit-axis': createOverlayLineRenderable('orbit-axis', new Float32Array(6)),
    'orbit-reference': createOverlayLineRenderable('orbit-reference', new Float32Array(6)),
    'orbit-arc': createOverlayLineRenderable('orbit-arc', new Float32Array((OVERLAY_TILT_ARC_SEGMENTS + 1) * 3)),
  }
  const ORBIT_OVERLAY_COLORS: Record<OrbitOverlayLineId, [number, number, number, number]> = {
    'orbit-path': [0.5, 0.5, 0.55, 0.5], // faint neutral grey - a construction guide, not a teaching focus
    'orbit-axis': [0.98, 0.25, 0.65, 0.95], // same neon pink/magenta as the staged axis line - same concept, same color
    'orbit-reference': [0.3, 0.7, 1.0, 0.95], // bright sky blue - the moving Sun-Earth line, the other half of this chapter's teaching point
    'orbit-arc': [0.99, 0.78, 0.25, 0.95], // same warm amber as the staged tilt-arc
  }
```

- [ ] **Step 3: Add `data-chapter-kind` and remove the tween-retarget call from `refreshChapterUI`**

Replace the existing `refreshChapterUI` function body:

```ts
  function refreshChapterUI(): void {
    const chapter = lessonPlayer.currentChapter
    lessonChapterTitle.textContent = `${lessonPlayer.currentChapterIndex + 1} / ${lessonPlayer.currentLesson.chapters.length}: ${chapter.title}`
    lessonPrevBtn.disabled = !lessonPlayer.hasPreviousChapter
    lessonNextBtn.disabled = !lessonPlayer.hasNextChapter
    lessonChapterText.textContent = chapter.text
    lessonPanel.dataset.chapterId = chapter.id
    lessonPanel.dataset.chapterKind = chapter.kind
  }
```

(The `seasonPhaseTween.retarget(...)` call that used to live here moves to Step 4 below, since it now needs to branch on whether the chapter `kind` changed.)

- [ ] **Step 4: Replace the lesson-picker load handler and the prev/next handlers with kind-aware navigation**

Replace the existing lesson-picker `item.addEventListener('click', ...)` body's tail (everything from `learnModeController.enter(lesson.id)` onward):

```ts
      learnModeController.enter(lesson.id)
      const firstChapter = lesson.chapters[0]
      applyCameraFramingForKind(firstChapter.kind)
      currentSeasonPhase = firstChapter.seasonPhaseDegrees
      seasonPhaseTween.retarget(firstChapter.seasonPhaseDegrees, firstChapter.seasonPhaseDegrees)
      learnSpinRadians = 0
      lessonPanel.hidden = false
      refreshChapterUI()
    })
  })
```

Replace the existing `lessonPrevBtn`/`lessonNextBtn` click handlers:

```ts
  // Shared by both Prev/Next: navigates, then either hard-snaps (no tween) if the chapter kind
  // changed - since a "position phase" and a "tilt phase" are different physical quantities, an
  // interpolation between them would mean nothing - or smoothly tweens as before if it didn't,
  // matching this lesson's existing "camera never moves, only re-tilts smoothly" chapter-change
  // behavior for the common case.
  function goToChapter(navigate: () => void): void {
    const previousKind = lessonPlayer.currentChapter.kind
    navigate()
    const chapter = lessonPlayer.currentChapter
    if (chapter.kind !== previousKind) {
      applyCameraFramingForKind(chapter.kind)
      currentSeasonPhase = chapter.seasonPhaseDegrees
      seasonPhaseTween.retarget(chapter.seasonPhaseDegrees, chapter.seasonPhaseDegrees)
    } else {
      seasonPhaseTween.retarget(chapter.seasonPhaseDegrees, currentSeasonPhase)
    }
    refreshChapterUI()
  }
  lessonPrevBtn.addEventListener('click', () => goToChapter(() => lessonPlayer.previousChapter()))
  lessonNextBtn.addEventListener('click', () => goToChapter(() => lessonPlayer.nextChapter()))
```

- [ ] **Step 5: Branch Earth's position and radius on chapter kind**

Modify the `planetFrameData` map callback (the block computing `sx, sy, sz`/`radius` for each planet):

```ts
    const planetFrameData = planetRenderables.map((renderable) => {
      const isLearnEarth = learnModeController.currentMode === 'learn' && renderable.definition.id === 'earth'
      const isOrbitChapter = isLearnEarth && lessonPlayer.currentChapter.kind === 'orbit'
      // Earth in learn mode bypasses the real orbital-position pipeline (planetAuPosition +
      // scaledPosition) entirely - during 'orbit' chapters it sits on the compact orbit path
      // (orbitPositionForPhase); during 'staged' chapters it sits at a fixed staged coordinate.
      // Neither is ever derived from a real date, per the design spec's §3.
      let sx: number, sy: number, sz: number
      if (isOrbitChapter) {
        ;[sx, sy, sz] = orbitPositionForPhase(currentSeasonPhase, ORBIT_PATH_RADIUS)
      } else if (isLearnEarth) {
        ;[sx, sy, sz] = EARTH_STAGED_POSITION
      } else {
        const { x, y, z, distanceAu } = planetAuPosition(renderable.definition, T)
        ;[sx, sy, sz] = scaledPosition(x, y, z, distanceAu, scaleBlend)
      }
      planetPositionsById.set(renderable.definition.id, [sx, sy, sz])
      const radius = isOrbitChapter
        ? ORBIT_EARTH_RADIUS
        : isLearnEarth
          ? EARTH_STAGED_RADIUS
          : scaledBodyRadiusUnits(renderable.definition.radiusKm, renderable.definition.compactVisualRadius, scaleBlend, AU_KM)
      planetRadiusById.set(renderable.definition.id, radius)
      return { renderable, x: sx, y: sy, z: sz, radius }
    })
```

- [ ] **Step 6: Branch the pole direction on chapter kind, and only set `earthLearnTilt` for staged chapters**

Modify the per-body loop's tilt computation:

```ts
    for (const { renderable, x: sx, y: sy, z: sz, radius } of planetFrameData) {
      const isLearnEarth = learnModeController.currentMode === 'learn' && renderable.definition.id === 'earth'
      const isOrbitChapter = isLearnEarth && lessonPlayer.currentChapter.kind === 'orbit'
      const rotation = isLearnEarth ? learnSpinRadians : rotationAngleRadians(daysSinceEpoch, renderable.definition.siderealRotationHours)
      const poleDirection = isOrbitChapter
        ? ORBIT_FIXED_POLE_DIRECTION
        : isLearnEarth
          ? seasonalPoleDirection(currentSeasonPhase)
          : equatorialToEclipticPoleDirection(renderable.definition.poleRightAscensionDegrees, renderable.definition.poleDeclinationDegrees)
      const tilt = axisAlignmentRotation(poleDirection)
      // earthLearnTilt is only set for 'staged' chapters (null during 'orbit' chapters and
      // outside learn mode) - the staged-chapter overlay block below is gated on it being
      // non-null, so this alone correctly skips that block during orbit chapters without needing
      // to touch that block's own condition at all. earthLearnTilt deliberately excludes the spin
      // rotation (learnSpinRadians, applied below via fromZRotation only to the sphere mesh's own
      // `world` matrix) - the axis/equator overlay lines and the two location markers are
      // spin-invariant and must stay fixed in place at their tilt-defined latitude rather than
      // periodically spinning around to Earth's occluded far side.
      if (renderable.definition.id === 'earth') earthLearnTilt = isLearnEarth && !isOrbitChapter ? tilt : null
      const world = mat4.multiply(
        mat4.create(),
        mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
        mat4.multiply(
          mat4.create(),
          tilt,
          mat4.multiply(mat4.create(), mat4.fromZRotation(mat4.create(), rotation), mat4.fromScaling(mat4.create(), [radius, radius, radius])),
        ),
      )
```

(The rest of this loop body - `wvp`, `lightDirection`, uniform writes, ring/label handling - is unchanged.)

- [ ] **Step 7: Add the orbit-chapter overlay block, and gate the existing staged block/label-hiding on chapter kind**

Add a `currentChapterKind` computation directly before the existing `if (learnModeController.currentMode === 'learn' && earthLearnTilt) {` block:

```ts
    const currentChapterKind = learnModeController.currentMode === 'learn' ? lessonPlayer.currentChapter.kind : null

    if (learnModeController.currentMode === 'learn' && earthLearnTilt) {
```

(Leave that entire existing staged-chapter overlay block body completely unchanged.) Then replace its trailing `} else {` / label-hiding branch with:

```ts
    } else if (currentChapterKind === 'orbit') {
      const earthEntry = planetFrameData.find((entry) => entry.renderable.definition.id === 'earth')
      if (earthEntry) {
        const earthPosition: [number, number, number] = [earthEntry.x, earthEntry.y, earthEntry.z]
        const sunwardDirection: [number, number, number] = [-earthEntry.x, -earthEntry.y, -earthEntry.z]
        const axisLength = earthEntry.radius * 4
        const referenceLength = earthEntry.radius * 4
        const arcRadius = earthEntry.radius * 3
        const arcAngleRadians = angleBetweenDirections(ORBIT_FIXED_POLE_DIRECTION, sunwardDirection)

        const orbitGeometryById: Record<OrbitOverlayLineId, Float32Array> = {
          'orbit-path': orbitPathCirclePoints(ORBIT_PATH_RADIUS, ORBIT_PATH_SEGMENTS),
          'orbit-axis': directedLinePoints(earthPosition, ORBIT_FIXED_POLE_DIRECTION, axisLength),
          'orbit-reference': directedLinePoints(earthPosition, sunwardDirection, referenceLength),
          'orbit-arc': greatCircleArcPoints(earthPosition, sunwardDirection, ORBIT_FIXED_POLE_DIRECTION, arcRadius, OVERLAY_TILT_ARC_SEGMENTS),
        }
        const pulsePhaseRadians = (performance.now() / 1000) * OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND
        for (const id of ORBIT_OVERLAY_LINE_IDS) {
          const renderable = orbitOverlayLineRenderables[id]
          updateOverlayLineRenderable(renderable, orbitGeometryById[id])
          const uniforms = new Float32Array(LINE_UNIFORM_FLOAT_COUNT)
          uniforms.set(viewProjection, 0)
          uniforms.set(ORBIT_OVERLAY_COLORS[id], 16)
          // The fixed axis and the current Sun-Earth reference are this chapter's teaching focus
          // (pulsing, like the staged chapters' own axis/equator/markers); the orbit path and the
          // angle arc are construction/measurement aids (solid, like the staged reference/tilt-arc).
          const dashMode = id === 'orbit-axis' || id === 'orbit-reference' ? 2.0 : 0
          uniforms.set([0, pulsePhaseRadians, 0, dashMode], 20)
          device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
        }

        const arcMidpoint = greatCircleArcPoints(earthPosition, sunwardDirection, ORBIT_FIXED_POLE_DIRECTION, arcRadius, 2)
        const tiltLabelScreen = worldToScreen(viewProjection, arcMidpoint[3], arcMidpoint[4], arcMidpoint[5], canvas.clientWidth, canvas.clientHeight)
        axisTiltLabel.textContent = `${((arcAngleRadians * 180) / Math.PI).toFixed(1)}°`
        updateLabelPosition(axisTiltLabel, tiltLabelScreen)
      }
      locationALabel.style.display = 'none'
      locationBLabel.style.display = 'none'
    } else {
      locationALabel.style.display = 'none'
      locationBLabel.style.display = 'none'
      axisTiltLabel.style.display = 'none'
    }
```

- [ ] **Step 8: Draw the correct overlay-line set based on chapter kind in the render pass**

Modify the existing `if (learnModeController.currentMode === 'learn') { pass.setPipeline(linePipeline); for (const id of OVERLAY_LINE_IDS) {...} }` block in the render-pass section:

```ts
    if (learnModeController.currentMode === 'learn') {
      pass.setPipeline(linePipeline)
      if (currentChapterKind === 'orbit') {
        for (const id of ORBIT_OVERLAY_LINE_IDS) {
          const renderable = orbitOverlayLineRenderables[id]
          pass.setVertexBuffer(0, renderable.vertexBuffer)
          pass.setVertexBuffer(1, renderable.distanceBuffer)
          pass.setBindGroup(0, renderable.bindGroup)
          pass.draw(renderable.pointCount)
        }
      } else {
        for (const id of OVERLAY_LINE_IDS) {
          const renderable = overlayLineRenderables[id]
          pass.setVertexBuffer(0, renderable.vertexBuffer)
          pass.setVertexBuffer(1, renderable.distanceBuffer)
          pass.setBindGroup(0, renderable.bindGroup)
          pass.draw(renderable.pointCount)
        }
      }
    }
```

- [ ] **Step 9: Typecheck and build**

Run: `cd packages/app && npm run typecheck && npm run build`
Expected: both pass with no errors.

- [ ] **Step 10: Run the full unit suite**

Run: `cd packages/app && npx vitest run`
Expected: all tests pass (this task doesn't change any pure function under unit test).

- [ ] **Step 11: Manual live-browser verification (required - do not skip)**

Start the dev server (`npm run dev` from `packages/app`), open the app, enter the "Why does Earth have seasons?" lesson, and confirm:
- It opens on "Real March Equinox" (`orbit-march`), a wide top-down view showing the Sun, a compact orbit circle, and a small Earth on it with a fixed-looking axis line.
- Stepping through all 4 orbit chapters keeps the same camera framing (no jump/slide) and shows the angle label reading ~23.4° at June/December and ~0° at March/September, with the axis line visibly *not* rotating between chapters (only Earth's position on the circle moves).
- Stepping from "Real December Solstice" into "Intro: A Tilted World" performs an instant hard cut to the existing close-up side-on staged view, with no animation and no console errors.
- Location A/B labels are absent throughout the 4 orbit chapters and reappear starting at "Intro".
- Stepping backward from "Intro" to "Real December Solstice" also hard-cuts correctly.
- Exiting learn mode and re-entering still works normally (explore-mode camera/upAxis unaffected).

Check the browser console for zero errors throughout this walkthrough.

- [ ] **Step 12: Commit**

```bash
git add packages/app/src/main.ts
git commit -m "Wire the orbit chapters into the camera, render loop, and chapter navigation"
```

---

## Task 4: e2e coverage for the 9-chapter flow

**Files:**
- Modify: `packages/app/e2e/seasonsLessonFlow.spec.ts`
- Modify: `packages/app/e2e/learnMode.spec.ts`

**Interfaces:**
- Consumes: `data-chapter-id`/`data-chapter-kind` on `#lesson-panel` (Task 3), `#location-a-label`/`#location-b-label`/`#axis-tilt-label` (pre-existing).

- [ ] **Step 1: Update the full-lesson-flow test for 9 chapters**

In `packages/app/e2e/seasonsLessonFlow.spec.ts`, rename the test and update `expectedChapterIds`:

```ts
import { expect, test } from '@playwright/test'

test('full seasons lesson flow: enter, all 9 chapters, exit', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')

  const expectedChapterIds = [
    'orbit-march',
    'orbit-june',
    'orbit-september',
    'orbit-december',
    'intro',
    'march-equinox',
    'june-solstice',
    'september-equinox',
    'december-solstice',
  ]
  for (const chapterId of expectedChapterIds) {
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', chapterId)
    if (chapterId !== expectedChapterIds[expectedChapterIds.length - 1]) {
      await page.locator('#lesson-next-chapter').click()
      await page.waitForTimeout(300)
    }
  }
  await expect(page.locator('#lesson-next-chapter')).toBeDisabled()

  await page.locator('#learn-mode-btn').click() // exit
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  expect(errors).toEqual([])
})
```

- [ ] **Step 2: Run this test to verify it passes**

Run: `cd packages/app && npx playwright test seasonsLessonFlow.spec.ts --workers=1`
Expected: PASS.

- [ ] **Step 3: Rewrite `learnMode.spec.ts`'s "chapter navigation" test for the new first chapter and the kind boundary**

Replace the existing `test('chapter navigation updates lesson-panel state', ...)` in `packages/app/e2e/learnMode.spec.ts`:

```ts
test('chapter navigation updates lesson-panel state, including the kind change at the orbit/staged boundary', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'orbit-march')
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', 'orbit')

  await page.locator('#lesson-next-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'orbit-june')
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', 'orbit')

  await page.locator('#lesson-prev-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'orbit-march')
  await expect(page.locator('#lesson-prev-chapter')).toBeDisabled()

  // Step all the way to the orbit/staged boundary and confirm the kind flips (a hard camera cut,
  // not an animated one - see main.ts's goToChapter).
  for (let i = 0; i < 4; i++) {
    await page.locator('#lesson-next-chapter').click()
  }
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'intro')
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', 'staged')

  expect(errors).toEqual([])
})
```

- [ ] **Step 4: Rewrite the "globe overlays" test to cover the orbit-to-staged transition**

Replace the existing `test('globe overlays and both location markers render without WebGPU errors across a chapter change', ...)` in `packages/app/e2e/learnMode.spec.ts`:

```ts
test('globe overlays and both location markers render without WebGPU errors across the orbit-to-staged transition', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.waitForTimeout(1500) // let the initial orbit-position tween settle

  // Location A/B are staged-chapter-only - hidden during every orbit chapter.
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'orbit-march')
  await expect(page.locator('#location-a-label')).toBeHidden()
  await expect(page.locator('#location-b-label')).toBeHidden()
  await expect(page.locator('#axis-tilt-label')).toBeVisible()

  for (let i = 0; i < 4; i++) {
    await page.locator('#lesson-next-chapter').click()
  }
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'intro')
  await page.waitForTimeout(1500) // let the tilt tween settle

  await expect(page.locator('#location-a-label')).toBeVisible()
  await expect(page.locator('#location-b-label')).toBeVisible()

  await page.locator('#lesson-next-chapter').click() // intro -> march-equinox
  await page.locator('#lesson-next-chapter').click() // march-equinox -> june-solstice's tilt tween begins
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'june-solstice')
  await page.waitForTimeout(1500) // let the tween settle

  await expect(page.locator('#location-a-label')).toBeVisible()
  await expect(page.locator('#location-b-label')).toBeVisible()
  // June solstice: the axis leans the full 23.4 degrees away from the vertical reference line.
  await expect(page.locator('#axis-tilt-label')).toHaveText('23.4°')
  expect(errors).toEqual([])
})
```

- [ ] **Step 5: Run the full e2e suite**

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all tests pass, including the two rewritten ones and the untouched rest of the suite.

- [ ] **Step 6: Run the full unit suite once more for good measure**

Run: `cd packages/app && npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/e2e/seasonsLessonFlow.spec.ts packages/app/e2e/learnMode.spec.ts
git commit -m "Update e2e coverage for the 9-chapter orbit-intro flow"
```
