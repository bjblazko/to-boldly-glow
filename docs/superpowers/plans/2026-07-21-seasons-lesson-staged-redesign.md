# Seasons Lesson Staged-Diagram Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the shipped "Why does Earth have seasons" learning-mode lesson from a real-astronomical-position camera scene into a fixed, non-realistic "studio diagram": Sun and Earth side by side and never moving, Earth's axis tilt (not its position) changing per chapter, two symmetric always-visible location markers instead of a 7-preset picker, and two neon pulsing overlay lines instead of four dashed ones.

**Architecture:** The camera is set once on entering learn mode and never moves again (no fly-to tween). Earth's world position is a fixed staged coordinate (the Sun stays at the true origin, unmoved). Each chapter supplies a `seasonPhaseDegrees` value; a new pure function derives a synthetic pole direction from it and feeds the existing `axisAlignmentRotation` helper — the same alignment machinery already used for real IAU pole data, just given a synthetic direction instead. Earth spins continuously each frame (elapsed-time-driven) around that seasonal pole, and switching chapters tweens the phase value smoothly rather than snapping.

**Tech Stack:** TypeScript, Vite, gl-matrix, hand-rolled WebGPU (WGSL), Vitest, Playwright — no new dependencies.

## Global Constraints

- This project has no WGSL unit-test framework — "the test" for shader/rendering-integration changes means: `npm run typecheck`, `npm run build`, the existing Vitest suite for pure TypeScript functions, a Playwright e2e smoke test (assert zero `pageerror`s), and — **for this plan specifically, since the browser-extension connectivity issue that blocked every manual check earlier this session is now resolved** — a real manual visual walkthrough in Task 10, not a "browser unavailable" disclaimer.
- Colors (spec §6): rotation axis `[0.98, 0.25, 0.65, 0.95]`-ish neon pink/magenta (~`#ff3fa4`), equator ring `[0.18, 0.88, 0.79, 0.95]`-ish neon teal (~`#2de0c9`). Exact RGBA tuned visually against the shipped shader, not pixel-locked to these hex conversions.
- Location markers (spec §5): symmetric latitude magnitude on opposite hemispheres — this plan uses exactly `+45°` / `-45°`. Labeled generically "Location A" / "Location B", never real place names.
- Never a bare literal for any GPU buffer/uniform size — every allocation/write site for the line-shader uniform continues to use the existing `LINE_UNIFORM_FLOAT_COUNT` named constant (unchanged at 24 floats; this plan does not resize it).
- Never commit until a task's own verification steps pass.
- Run `cd packages/app && npx playwright test --workers=1` for the full e2e suite — NOT the root `npm run test:e2e -- --workers=1` (confirmed repo-specific quirk, still true).
- Supersede/keep list (spec §8) is binding: `Chapter.dateRange`, `ChapterCameraFraming.date`, `dateAtScrubPosition`, `LessonPlayer.scrubT`/`setScrubT`, `LATITUDE_PRESETS`, `.hud-latitude-chip`/`refreshLatitudeRow`, `sunAngleRayPoints`, `flyToCurrentChapterFraming`, and the per-frame camera-target-recentering block are all removed for this lesson. `CameraFollowController.flyToFraming`/`isFlying`, `equatorRingPoints`/`rotationAxisPoints`/`latitudeMarkerPoints`/`latitudeMarkerCenter`, `computeCumulativeLineDistances`/`createLineVertexBuffer`/`updateLineVertexBuffer`, and the general learning-mode shell (`LearnModeController`, corner controls, Display relocation) are all kept, unmodified in their own APIs.

---

### Task 1: Chapter data model — tilt phase replaces date, two markers replace the preset list

**Files:**
- Modify: `packages/app/src/learn/lessonTypes.ts`
- Modify: `packages/app/src/learn/lessons/seasons.ts`
- Delete: `packages/app/test/lessonTypes.test.ts` (tests only `dateAtScrubPosition`, which is removed entirely)
- Modify: `packages/app/test/seasonsLesson.test.ts` (full rewrite — every existing test references `dateRange`/`cameraFraming.date`/`latitudePresets`, all removed)

**Interfaces:**
- Consumes: `ECLIPTIC_NORTH` (existing, `solarSystem/poleOrientation.ts`) — no longer used as `upAxis` per chapter (camera is fixed globally now, not per chapter), but the seasonal pole-direction math below produces its own direction vector.
- Produces: `Chapter` (new shape: `id`, `title`, `seasonPhaseDegrees`, `text`), `Lesson` (`id`, `title`, `chapters`, `markerLatitudeDegrees`), `SEASONS_LESSON`, `LESSONS_BY_ID` — Task 2 (LessonPlayer) and Task 3 (main.ts staging) both consume `Chapter.seasonPhaseDegrees`/`Chapter.text` and `Lesson.markerLatitudeDegrees`.

- [ ] **Step 1: Rewrite `lessonTypes.ts`**

```typescript
// packages/app/src/learn/lessonTypes.ts
// A chapter of a lesson. `seasonPhaseDegrees` is this chapter's fixed position in an idealized
// annual cycle (0 = June solstice, 90 = September equinox, 180 = December solstice, 270 = March
// equinox - see main.ts's seasonalPoleDirection for how this becomes an actual tilt orientation).
// There is no calendar date or scrub position in this design - the lesson stages a fixed diagram
// where only Earth's tilt orientation changes between chapters, not its position or a real date.
export interface Chapter {
  id: string
  title: string
  seasonPhaseDegrees: number
  text: string
}

export interface Lesson {
  id: string
  title: string
  chapters: Chapter[]
  // Latitude magnitude (degrees) for the two symmetric, always-visible location markers - one at
  // +markerLatitudeDegrees, one at -markerLatitudeDegrees. A single number, not a pair, since the
  // whole point is that they're mirror images of each other (same distance from the poles and from
  // the equator).
  markerLatitudeDegrees: number
}
```

- [ ] **Step 2: Delete the now-invalid `lessonTypes.test.ts`**

```bash
rm packages/app/test/lessonTypes.test.ts
```

There is no pure logic left in `lessonTypes.ts` to unit-test (it's type declarations only) — the
seasonal-pole-direction math this data feeds into lives in `main.ts` (Task 3), which gets its own
test coverage there.

- [ ] **Step 3: Rewrite `lessons/seasons.ts`**

```typescript
// packages/app/src/learn/lessons/seasons.ts
import type { Chapter, Lesson } from '../lessonTypes'

const CHAPTERS: Chapter[] = [
  {
    id: 'intro',
    title: 'Intro: A Tilted World',
    seasonPhaseDegrees: 90, // neutral/equinox-like, per the design spec's Intro treatment
    text:
      "Earth's axis is tilted 23.4° relative to its orbit around the Sun. This tilt - not Earth's " +
      'distance from the Sun, which barely changes over a year - is what causes the seasons. Watch ' +
      'Location A (north) and Location B (south) as you step through the chapters below.',
  },
  {
    id: 'march-equinox',
    title: 'March Equinox',
    seasonPhaseDegrees: 270,
    text:
      "Around the March equinox, the Sun sits directly over Earth's equator. Location A and " +
      'Location B get close to equal day and night length.',
  },
  {
    id: 'june-solstice',
    title: 'June Solstice',
    seasonPhaseDegrees: 0,
    text:
      'The June solstice: the north pole tilts toward the Sun. Location A (north) gets longer days ' +
      'and more direct sunlight - summer. Location B (south) gets shorter days and more oblique ' +
      'sunlight - winter.',
  },
  {
    id: 'september-equinox',
    title: 'September Equinox',
    seasonPhaseDegrees: 90,
    text:
      'Around the September equinox, the Sun is back over the equator. Location A and Location B ' +
      'get close to equal day and night again - the reverse trend from March.',
  },
  {
    id: 'december-solstice',
    title: 'December Solstice',
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

- [ ] **Step 4: Rewrite `test/seasonsLesson.test.ts`**

```typescript
// packages/app/test/seasonsLesson.test.ts
import { describe, expect, it } from 'vitest'
import { LESSONS_BY_ID, SEASONS_LESSON } from '../src/learn/lessons/seasons'

describe('SEASONS_LESSON', () => {
  it('has exactly 5 chapters in chronological order', () => {
    expect(SEASONS_LESSON.chapters).toHaveLength(5)
    const ids = SEASONS_LESSON.chapters.map((c) => c.id)
    expect(ids).toEqual(['intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice'])
  })

  it('every chapter has a season phase in [0, 360) degrees', () => {
    for (const chapter of SEASONS_LESSON.chapters) {
      expect(chapter.seasonPhaseDegrees).toBeGreaterThanOrEqual(0)
      expect(chapter.seasonPhaseDegrees).toBeLessThan(360)
    }
  })

  it('the four solstice/equinox chapters use the four cardinal phases exactly once each', () => {
    const nonIntro = SEASONS_LESSON.chapters.filter((c) => c.id !== 'intro')
    const phases = nonIntro.map((c) => c.seasonPhaseDegrees).sort((a, b) => a - b)
    expect(phases).toEqual([0, 90, 180, 270])
  })

  it('Intro uses a neutral (equinox-like) phase, matching one of the equinox chapters', () => {
    const intro = SEASONS_LESSON.chapters.find((c) => c.id === 'intro')!
    const septemberEquinox = SEASONS_LESSON.chapters.find((c) => c.id === 'september-equinox')!
    expect(intro.seasonPhaseDegrees).toBe(septemberEquinox.seasonPhaseDegrees)
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

- [ ] **Step 5: Run typecheck (expect failures in files Tasks 2-9 will fix) and the new test file alone**

Run: `cd packages/app && npx vitest run test/seasonsLesson.test.ts`
Expected: PASS, 8/8.

Run: `npm run typecheck` (repo root)
Expected: FAIL — `lessonPlayer.ts`, `main.ts` still reference the old `Chapter`/`Lesson` shape
(`dateRange`, `cameraFraming`, `latitudePresets`, `dateAtScrubPosition`). This is expected; Tasks 2-3
fix these call sites. Do not attempt to fix them in this task.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/learn/lessonTypes.ts packages/app/src/learn/lessons/seasons.ts \
  packages/app/test/seasonsLesson.test.ts
git rm packages/app/test/lessonTypes.test.ts
git commit -m "Replace calendar-date chapter model with a fixed season-phase + two-marker model

Chapter.dateRange/cameraFraming.date and the 7-entry latitude-preset
list are gone - each chapter now just specifies where it sits in an
idealized annual cycle (a season-phase angle), and the lesson defines
one latitude magnitude for two always-visible, symmetric location
markers instead of a preset picker. dateAtScrubPosition and its test
are removed with nothing to replace them, since scrubbing itself is
gone (see the staged-redesign design spec, §4/§8)."
```

---

### Task 2: LessonPlayer — remove scrub state, keep chapter navigation only

**Files:**
- Modify: `packages/app/src/learn/lessonPlayer.ts`

**Interfaces:**
- Consumes: `Chapter`, `Lesson` (Task 1).
- Produces: `LessonPlayer` with `load(lesson)`, `nextChapter()`, `previousChapter()`, `get currentLesson()`, `get currentChapterIndex()`, `get currentChapter()`, `get hasPreviousChapter()`, `get hasNextChapter()` — `scrubT`, `setScrubT`, `currentDate` are gone. Task 3 (main.ts staging) and Task 8 (HTML/CSS) both consume this narrower surface.

- [ ] **Step 1: Rewrite `lessonPlayer.ts`**

```typescript
// packages/app/src/learn/lessonPlayer.ts
import type { Chapter, Lesson } from './lessonTypes'

// Holds which lesson/chapter is currently active. Pure state - no DOM access, no rendering - so
// main.ts's render loop and UI wiring can both read it each frame without this class needing to
// know about either. No scrub/date state here (unlike the original real-astronomical-position
// design) - the staged redesign has nothing left for a user to scrub through; each chapter is a
// fixed season-phase orientation (see lessons/seasons.ts), not a real date range.
export class LessonPlayer {
  private lesson: Lesson | null = null
  private chapterIndex = 0

  load(lesson: Lesson): void {
    this.lesson = lesson
    this.chapterIndex = 0
  }

  get currentLesson(): Lesson {
    if (!this.lesson) throw new Error('LessonPlayer.load() must be called before use.')
    return this.lesson
  }

  get currentChapterIndex(): number {
    return this.chapterIndex
  }

  get currentChapter(): Chapter {
    return this.currentLesson.chapters[this.chapterIndex]
  }

  get hasPreviousChapter(): boolean {
    return this.chapterIndex > 0
  }

  get hasNextChapter(): boolean {
    return this.chapterIndex < this.currentLesson.chapters.length - 1
  }

  nextChapter(): void {
    if (!this.hasNextChapter) return
    this.chapterIndex += 1
  }

  previousChapter(): void {
    if (!this.hasPreviousChapter) return
    this.chapterIndex -= 1
  }
}
```

- [ ] **Step 2: Typecheck this file in isolation (main.ts will still fail — expected until Task 3)**

Run: `cd packages/app && npx tsc --noEmit -p . 2>&1 | grep lessonPlayer`
Expected: no output (no errors specifically in `lessonPlayer.ts`).

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/learn/lessonPlayer.ts
git commit -m "Remove scrub state from LessonPlayer - chapter navigation only

No calendar date or scrub position exists in the staged redesign,
so scrubT/setScrubT/currentDate have nothing left to compute. Chapter
navigation (load/next/previous + the current-chapter getters) is
unchanged."
```

---

### Task 3: Fixed staged Sun/Earth positioning, seasonal tilt, continuous spin, and chapter-tilt tween

This is the largest, highest-risk task — it replaces the camera fly-to and per-frame target-
recentering mechanism with a one-time fixed camera setup, moves Earth to a fixed staged position,
and introduces the season-phase-to-tilt math plus a continuous spin animation. Read this task fully
before starting; the steps below touch several non-adjacent regions of `main.ts`.

**Files:**
- Modify: `packages/app/src/main.ts`
- Test: `packages/app/test/seasonalTilt.test.ts` (new)

**Interfaces:**
- Consumes: `Chapter.seasonPhaseDegrees` (Task 1), `LessonPlayer.currentChapter` (Task 2),
  `axisAlignmentRotation` (existing, `solarSystem/poleOrientation.ts`), `easeInOutCubic` (existing,
  `camera/easing.ts`).
- Produces: `seasonalPoleDirection(phaseDegrees: number): [number, number, number]` (pure function,
  in `main.ts` — small enough not to warrant its own module, matches this file's existing pattern of
  small local pure helpers like `defaultFramingRadius`). Task 5 (overlay geometry) and Task 4
  (two-marker rendering) both need the same tilt matrix this task computes per frame, exposed as a
  local `earthLearnTilt: mat4 | null` variable read every frame (see Step 6).

- [ ] **Step 1: Write the failing test for `seasonalPoleDirection`**

```typescript
// packages/app/test/seasonalTilt.test.ts
import { describe, expect, it } from 'vitest'
import { seasonalPoleDirection } from '../src/main'

const OBLIQUITY_RADIANS = (23.4 * Math.PI) / 180

describe('seasonalPoleDirection', () => {
  it('returns a unit vector at every phase', () => {
    for (const phase of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const [x, y, z] = seasonalPoleDirection(phase)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9)
    }
  })

  it('at phase=0 (June solstice), the pole leans maximally along the Sun-Earth axis (local X)', () => {
    const [x, , z] = seasonalPoleDirection(0)
    expect(x).toBeCloseTo(Math.sin(OBLIQUITY_RADIANS), 9)
    expect(z).toBeCloseTo(0, 9)
  })

  it('at phase=180 (December solstice), the X-lean is exactly reversed from phase=0', () => {
    const [xJune] = seasonalPoleDirection(0)
    const [xDecember] = seasonalPoleDirection(180)
    expect(xDecember).toBeCloseTo(-xJune, 9)
  })

  it('at phase=90 and phase=270 (equinoxes), the pole has zero lean along the Sun-Earth axis', () => {
    for (const phase of [90, 270]) {
      const [x] = seasonalPoleDirection(phase)
      expect(x).toBeCloseTo(0, 9)
    }
  })

  it('the Y-component (base tilt magnitude) is constant across every phase', () => {
    const ys = [0, 90, 180, 270].map((phase) => seasonalPoleDirection(phase)[1])
    for (const y of ys) {
      expect(y).toBeCloseTo(Math.cos(OBLIQUITY_RADIANS), 9)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/app && npx vitest run test/seasonalTilt.test.ts`
Expected: FAIL — `seasonalPoleDirection` is not exported from `../src/main` yet.

- [ ] **Step 3: Add `seasonalPoleDirection` and remove `flyToCurrentChapterFraming`**

In `packages/app/src/main.ts`, find `flyToCurrentChapterFraming` (currently right after the
`lessonScrub` element lookup, before `let selectedLatitudeId`) and delete the whole function — it's
superseded entirely (Global Constraints). In its place, add:

```typescript
// The 23.4-degree real axial tilt, expressed as a pure function of an idealized "season phase"
// (0 = June solstice, 90 = September equinox, 180 = December solstice, 270 = March equinox)
// instead of a real calendar date. In this staged diagram, Earth's position never changes - only
// its tilt orientation does - so the usual "axis is fixed in space, orbital position changes the
// angle to the Sun" mechanism is inverted: here the axis itself rotates to represent each season,
// with the Sun-Earth line fixed along local +X (see EARTH_STAGED_POSITION below).
//
// The pole always makes a fixed angle (the obliquity, 23.4 degrees) from local +Y; phase controls
// how that tilt's *lean* is distributed between the Sun-Earth line (local X - visible on screen as
// leaning left/right) and local Z (perpendicular to the screen from this camera's side-on angle -
// invisible as a left/right lean, reads as "upright" on screen). At phase=0 the lean is entirely
// along X (visibly tilted toward/away from the Sun - a solstice); at phase=90/270 the lean is
// entirely along Z (reads as upright on screen, no visible left/right tilt - an equinox), exactly
// matching the standard textbook seasons-diagram convention.
export function seasonalPoleDirection(phaseDegrees: number): [number, number, number] {
  const obliquity = (23.4 * Math.PI) / 180
  const phase = (phaseDegrees * Math.PI) / 180
  return [Math.sin(obliquity) * Math.cos(phase), Math.cos(obliquity), Math.sin(obliquity) * Math.sin(phase)]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/app && npx vitest run test/seasonalTilt.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Fixed staging constants and one-time camera setup**

Still in `main.ts`, in the same region (right after `seasonalPoleDirection`), add:

```typescript
// Sun stays exactly where it already is (world origin, unmoved - see planetAuPosition/SUN's own
// rendering, untouched by this lesson). Earth is moved here, a fixed distance away along local +X,
// for the whole time the lesson is open - not derived from any real AU distance (this is a staged
// diagram, not a scale model; see the design spec's §3).
const EARTH_STAGED_POSITION: [number, number, number] = [6, 0, 0]
const EARTH_STAGED_RADIUS = 1 // matches Earth's own Compact-scale compactVisualRadius (bodies.ts)

// Set once on entering learn mode (see the lesson-picker click handler, Step 7) and never moved
// again - this is what structurally eliminates the old slide/jump camera artifact, rather than
// patching its timing. Tune these three visually once running: the goal is Sun and Earth both
// comfortably in frame with a clear gap between them (see the design spec's approved mockup).
const LEARN_CAMERA_TARGET: [number, number, number] = [EARTH_STAGED_POSITION[0] / 2, 0, 0]
const LEARN_CAMERA_RADIUS = 9
const LEARN_CAMERA_AZIMUTH = Math.PI / 2
const LEARN_CAMERA_ELEVATION = 0.12
```

- [ ] **Step 6: Chapter-to-chapter phase tween + continuous spin state**

Add, in the same region:

```typescript
// Smoothly re-tilts Earth's axis when switching chapters (a rotation tween on Earth's own transform,
// never the camera - the camera is fixed for the whole lesson per Step 5 above). Mirrors
// ScaleBlendTween's retarget/update pattern (solarSystem/scaleBlendTween.ts).
class SeasonPhaseTween {
  private startPhase = 0
  private endPhase = 0
  private elapsedSeconds = 0
  private readonly durationSeconds = 1

  retarget(newPhase: number, currentPhase: number): void {
    this.startPhase = currentPhase
    this.endPhase = newPhase
    this.elapsedSeconds = 0
  }

  get isAnimating(): boolean {
    return this.elapsedSeconds < this.durationSeconds
  }

  update(deltaSeconds: number): number {
    this.elapsedSeconds = Math.min(this.elapsedSeconds + deltaSeconds, this.durationSeconds)
    const t = this.elapsedSeconds / this.durationSeconds
    return this.startPhase + (this.endPhase - this.startPhase) * easeInOutCubic(t)
  }
}
const seasonPhaseTween = new SeasonPhaseTween()
let currentSeasonPhase = SEASONS_LESSON.chapters[0].seasonPhaseDegrees

// Accumulated spin angle (radians) while a chapter is open - continuous, elapsed-time-driven, never
// reset between chapters, so Earth keeps turning smoothly through chapter changes too. A full
// rotation every ~12 seconds is a starting pace; tune visually.
const LEARN_SPIN_RADIANS_PER_SECOND = (2 * Math.PI) / 12
let learnSpinRadians = 0
```

Add the `easeInOutCubic` import (it already exists in `camera/easing.ts` — used by
`ScaleBlendTween`/`CameraFollowController`):

```typescript
import { easeInOutCubic } from './camera/easing'
```

(If this import already exists elsewhere in `main.ts` for a different purpose, merge into the
existing import line instead of duplicating it — check the current import list first.)

- [ ] **Step 7: Rewire the lesson-picker/chapter-nav click handlers to set the camera once and retarget the phase tween**

Replace the `learnModeBtn`/lesson-picker/prev/next click handlers' bodies (currently calling
`refreshChapterUI()`, which itself calls the now-deleted `flyToCurrentChapterFraming()`) so that:

```typescript
  function applyLearnCameraFraming(): void {
    vec3.set(orbitCamera.target, ...LEARN_CAMERA_TARGET)
    orbitCamera.radius = LEARN_CAMERA_RADIUS
    orbitCamera.azimuth = LEARN_CAMERA_AZIMUTH
    orbitCamera.elevation = LEARN_CAMERA_ELEVATION
  }
```

is called exactly once, when entering learn mode (inside the lesson-picker item's click handler,
right after `learnModeController.enter(lesson.id)` — not on every chapter change). Update
`refreshChapterUI()` (used by prev/next and by the initial lesson load) to retarget the phase tween
instead of flying the camera:

```typescript
  function refreshChapterUI(): void {
    const chapter = lessonPlayer.currentChapter
    seasonPhaseTween.retarget(chapter.seasonPhaseDegrees, currentSeasonPhase)
    lessonChapterTitle.textContent = `${lessonPlayer.currentChapterIndex + 1} / ${lessonPlayer.currentLesson.chapters.length}: ${chapter.title}`
    lessonPrevBtn.disabled = !lessonPlayer.hasPreviousChapter
    lessonNextBtn.disabled = !lessonPlayer.hasNextChapter
    lessonChapterText.textContent = chapter.text
    lessonPanel.dataset.chapterId = chapter.id
  }
```

And the lesson-picker item's click handler becomes:

```typescript
  lessonPicker.querySelectorAll<HTMLButtonElement>('.hud-lesson-picker-item').forEach((item) => {
    item.addEventListener('click', () => {
      const lessonId = item.dataset.lessonId
      const lesson = lessonId ? LESSONS_BY_ID[lessonId] : undefined
      if (!lesson) return
      lessonPicker.hidden = true
      lessonPlayer.load(lesson)
      learnModeController.enter(lesson.id)
      applyLearnCameraFraming()
      currentSeasonPhase = lesson.chapters[0].seasonPhaseDegrees
      learnSpinRadians = 0
      lessonPanel.hidden = false
      refreshChapterUI()
    })
  })
```

(`lessonPrevBtn`/`lessonNextBtn` click handlers stay exactly as they are today —
`lessonPlayer.previousChapter()`/`nextChapter()` followed by `refreshChapterUI()` — since
`refreshChapterUI` now does the right thing.)

- [ ] **Step 8: Remove the old per-frame target-recentering block; add the per-frame phase/spin update and Earth position override**

Delete the whole `if (learnModeController.currentMode === 'learn') { ... } else { delete
canvas.dataset.cameraTargetEarthOffset }` block from `frame()` (Global Constraints — this mechanism
is fully superseded; the camera never moves once set in Step 7, so there's nothing left to
recenter).

In its place, still inside `frame()`, add (right after `deltaSeconds`/`lastFrameTime` are computed,
near the top of `frame()`, so `currentSeasonPhase`/`learnSpinRadians` are up to date before the
`planetFrameData` map that reads them below):

```typescript
    if (learnModeController.currentMode === 'learn') {
      currentSeasonPhase = seasonPhaseTween.isAnimating ? seasonPhaseTween.update(deltaSeconds) : currentSeasonPhase
      learnSpinRadians += deltaSeconds * LEARN_SPIN_RADIANS_PER_SECOND
    }
```

Now update the `planetFrameData` construction's `isLearnEarth` branch (the block that currently
computes Earth's real position from `lessonPlayer.currentDate`) to use the fixed staged position
instead:

```typescript
    const planetFrameData = planetRenderables.map((renderable) => {
      const isLearnEarth = learnModeController.currentMode === 'learn' && renderable.definition.id === 'earth'
      // Earth in learn mode bypasses the real orbital-position pipeline (planetAuPosition +
      // scaledPosition) entirely - it sits at a fixed staged coordinate for as long as the lesson
      // is open, never derived from a real date, per the design spec's §3.
      let sx: number, sy: number, sz: number
      if (isLearnEarth) {
        ;[sx, sy, sz] = EARTH_STAGED_POSITION
      } else {
        const { x, y, z, distanceAu } = planetAuPosition(renderable.definition, T)
        ;[sx, sy, sz] = scaledPosition(x, y, z, distanceAu, scaleBlend)
      }
      planetPositionsById.set(renderable.definition.id, [sx, sy, sz])
      const radius = isLearnEarth
        ? EARTH_STAGED_RADIUS
        : scaledBodyRadiusUnits(renderable.definition.radiusKm, renderable.definition.compactVisualRadius, scaleBlend, AU_KM)
      planetRadiusById.set(renderable.definition.id, radius)
      return { renderable, x: sx, y: sy, z: sz, radius }
    })
```

- [ ] **Step 9: Replace the real pole/tilt computation with the seasonal one for learn-mode Earth, and drive spin from `learnSpinRadians`**

In the per-planet rendering loop (`for (const { renderable, x: sx, y: sy, z: sz, radius } of
planetFrameData) { ... }`), the existing code computes `rotation`, `poleDirection`, and `tilt` once
per planet using real data. Update it so Earth in learn mode uses the seasonal pole and the
accumulated spin instead:

```typescript
      const isLearnEarth = learnModeController.currentMode === 'learn' && renderable.definition.id === 'earth'
      const rotation = isLearnEarth ? learnSpinRadians : rotationAngleRadians(daysSinceEpoch, renderable.definition.siderealRotationHours)
      const poleDirection = isLearnEarth
        ? seasonalPoleDirection(currentSeasonPhase)
        : equatorialToEclipticPoleDirection(renderable.definition.poleRightAscensionDegrees, renderable.definition.poleDeclinationDegrees)
      const tilt = axisAlignmentRotation(poleDirection)
```

(This replaces the existing `rotationDaysSinceEpoch`/`rotation`/`poleDirection`/`tilt` lines in that
loop — the rest of the loop, from `const world = mat4.multiply(...)` onward, is unchanged.)

- [ ] **Step 10: Typecheck and build**

Run: `npm run typecheck && npm run build` (repo root)
Expected: both succeed. (`main.ts` no longer references `lessonPlayer.currentDate`,
`lessonPlayer.scrubT`, `flyToCurrentChapterFraming`, or `cameraFollow.flyToFraming`/`isFlying` for
this lesson — `cameraFollow`/`isFlying` remain imported/constructed for entity-search fly-to, which
is untouched.)

- [ ] **Step 11: Run the full Vitest suite**

Run: `npm run test` (repo root)
Expected: all pass, including the new `seasonalTilt.test.ts` (5/5) — some `learnMode`/
`seasonsLessonFlow` e2e specs will still fail at this point (Tasks 4-9 fix those); that's expected
and not a regression to chase down mid-task.

- [ ] **Step 12: Commit**

```bash
git add packages/app/src/main.ts packages/app/test/seasonalTilt.test.ts
git commit -m "Replace per-chapter camera fly-to with a fixed staged camera + seasonal tilt

The camera is now set exactly once on entering learn mode and never
moves again - this structurally eliminates the slide/jump artifact
rather than patching its timing. Earth's position is now a fixed
staged coordinate (the Sun is untouched, still at the true origin);
each chapter's 'season' is expressed as a tilt-orientation angle
(seasonalPoleDirection) fed through the existing axisAlignmentRotation
helper, the same machinery already used for real IAU pole data - just
given a synthetic direction. Earth spins continuously via an
accumulated elapsed-time angle, and chapter changes tween the tilt
phase (SeasonPhaseTween) instead of flying the camera anywhere."
```

---

### Task 4: Two fixed location markers replace the latitude-picker UI

**Files:**
- Modify: `packages/app/src/main.ts`

**Interfaces:**
- Consumes: `Lesson.markerLatitudeDegrees` (Task 1), `latitudeMarkerPoints`/`latitudeMarkerCenter`
  (existing, `learn/overlayGeometry.ts` — unchanged signatures), `worldToScreen`/`updateLabelPosition`
  (existing, already used for body labels — same DOM-label pattern reused here),
  `OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND` (Task 6 — this task's per-frame overlay-uniform write
  uses it directly; land Tasks 4-6 together, see Task 6 Step 4's commit note).
- Produces: two new DOM label elements (`#location-a-label`, `#location-b-label`) positioned each
  frame; no new exported functions consumed by later tasks.

- [ ] **Step 1: Remove the latitude-picker state/UI wiring**

In `main.ts`, delete: `let selectedLatitudeId`, `currentLatitudePreset()`, `refreshLatitudeRow()`, and
the `lessonLatitudeRow` element lookup. Delete the line `selectedLatitudeId =
lesson.latitudePresets[0].id` from the lesson-picker click handler (Task 3, Step 7 already omitted
it from the shown replacement — if you did Task 3 first, this is already gone; if reviewing the
diff, confirm no reference to `selectedLatitudeId`/`currentLatitudePreset`/`refreshLatitudeRow`
remains anywhere in the file).

- [ ] **Step 2: Add the two marker label DOM elements**

In `main.ts`, near the existing `labelsContainer`/`labelElements` setup (search for
`requireElement<HTMLDivElement>('#body-labels')`), add:

```typescript
  const locationALabel = requireElement<HTMLDivElement>('#location-a-label')
  const locationBLabel = requireElement<HTMLDivElement>('#location-b-label')
```

- [ ] **Step 3: Compute and position the two markers each frame, in the existing learn-mode overlay block**

In the `if (learnModeController.currentMode === 'learn') { const earthEntry = ... }` block (the one
that currently computes `earthTilt`/`markerCenterWorld`/the four-line `geometryById`), replace the
single `currentLatitudePreset()`-driven marker/ray with two fixed markers, and update `earthTilt` to
use the seasonal pole direction (matching Task 3's rendering-loop change, so the overlay geometry's
Earth transform always matches the actually-rendered Earth):

```typescript
    if (learnModeController.currentMode === 'learn') {
      const earthEntry = planetFrameData.find((entry) => entry.renderable.definition.id === 'earth')
      if (earthEntry) {
        const earthTilt = axisAlignmentRotation(seasonalPoleDirection(currentSeasonPhase))
        const earthWorld = mat4.multiply(mat4.create(), mat4.fromTranslation(mat4.create(), [earthEntry.x, earthEntry.y, earthEntry.z]), earthTilt)
        const ringRadius = earthEntry.radius * 1.02
        const markerLatitude = lessonPlayer.currentLesson.markerLatitudeDegrees
        const now = performance.now() / 1000
        const pulse = 1 + 0.15 * Math.sin(now * 3)
        const markerRadius = earthEntry.radius * 0.04 * pulse

        const geometryById: Record<OverlayLineId, Float32Array> = {
          equator: equatorRingPoints(earthWorld, ringRadius, OVERLAY_EQUATOR_SEGMENTS),
          axis: rotationAxisPoints(earthWorld, earthEntry.radius, 1.3),
          'marker-a': latitudeMarkerPoints(earthWorld, ringRadius, markerLatitude, markerRadius, OVERLAY_LATITUDE_MARKER_SEGMENTS),
          'marker-b': latitudeMarkerPoints(earthWorld, ringRadius, -markerLatitude, markerRadius, OVERLAY_LATITUDE_MARKER_SEGMENTS),
        }
        const pulsePhaseRadians = now * OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND
        for (const id of OVERLAY_LINE_IDS) {
          const renderable = overlayLineRenderables[id]
          updateOverlayLineRenderable(renderable, geometryById[id])
          const uniforms = new Float32Array(LINE_UNIFORM_FLOAT_COUNT)
          uniforms.set(viewProjection, 0)
          uniforms.set(OVERLAY_COLORS[id], 16)
          // dashParams: x/z unused in glow mode, y = live pulse phase, w = 2.0 (glow mode) - see
          // Task 6 for OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND and the shader's glow-mode branch.
          uniforms.set([0, pulsePhaseRadians, 0, 2.0], 20)
          device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
        }

        const markerACenter = latitudeMarkerCenter(earthWorld, ringRadius, markerLatitude)
        const markerBCenter = latitudeMarkerCenter(earthWorld, ringRadius, -markerLatitude)
        const markerAScreen = worldToScreen(viewProjection, ...markerACenter, canvas.clientWidth, canvas.clientHeight)
        const markerBScreen = worldToScreen(viewProjection, ...markerBCenter, canvas.clientWidth, canvas.clientHeight)
        updateLabelPosition(locationALabel, markerAScreen)
        updateLabelPosition(locationBLabel, markerBScreen)
        locationALabel.style.display = ''
        locationBLabel.style.display = ''
      }
    } else {
      locationALabel.style.display = 'none'
      locationBLabel.style.display = 'none'
    }
```

Note `OVERLAY_LINE_IDS`/`overlayLineRenderables`/`OVERLAY_COLORS`/`OVERLAY_GLOW_PARAMS` are updated
to the new 4-entry id set (`equator`, `axis`, `marker-a`, `marker-b` — dropping `latitude-marker` and
`sun-ray`) in Task 5/6; this task's own diff should use whatever the current `OVERLAY_LINE_IDS`
constant is at the time you write this step (coordinate with Task 5 if executing tasks out of
order — the two are meant to land together or Task 4 first, Task 5 immediately after, since this
step already assumes the renamed ids).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck` (repo root)
Expected: will still fail on `OVERLAY_LINE_IDS`/`sunAngleRayPoints`/`'latitude-marker'` references
until Task 5 removes the sun-ray entirely and renames the overlay id set — that's fine, proceed
directly to Task 5 without a standalone commit for this task if working through the plan linearly.
(If a reviewer needs a clean commit boundary here, note in your report that Tasks 4 and 5 must be
reviewed together for this reason — they touch the same `OVERLAY_LINE_IDS` declaration.)

---

### Task 5: Drop the sun-angle ray; rename the overlay line set to `equator`/`axis`/`marker-a`/`marker-b`

**Files:**
- Modify: `packages/app/src/learn/overlayGeometry.ts`
- Modify: `packages/app/src/main.ts`
- Modify: `packages/app/test/overlayGeometry.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `equatorRingPoints`/`rotationAxisPoints`/`latitudeMarkerPoints`/`latitudeMarkerCenter`
  unchanged; `sunAngleRayPoints` removed entirely. `OVERLAY_LINE_IDS` becomes `['equator', 'axis',
  'marker-a', 'marker-b'] as const` — Task 6 consumes this same id set for the new color/glow maps.

- [ ] **Step 1: Remove `sunAngleRayPoints` from `overlayGeometry.ts`**

Delete the `sunAngleRayPoints` function entirely (the design spec §6/§8 explicitly drops it — the
Sun is directly visible in the staged frame now, so a separate pointer to it is redundant).

- [ ] **Step 2: Remove its test from `overlayGeometry.test.ts`**

Delete the `sunAngleRayPoints` import and its `describe`/`it` block. The other four functions'
tests (`equatorRingPoints`, `rotationAxisPoints`, `latitudeMarkerPoints`, `latitudeMarkerCenter`)
are untouched — their geometry math doesn't change.

- [ ] **Step 3: Rename `OVERLAY_LINE_IDS` and the renderable/color maps in `main.ts`**

```typescript
  const OVERLAY_LINE_IDS = ['equator', 'axis', 'marker-a', 'marker-b'] as const
  type OverlayLineId = (typeof OVERLAY_LINE_IDS)[number]
```

Update the `overlayLineRenderables` construction to build all four with the SAME segment count
(`OVERLAY_LATITUDE_MARKER_SEGMENTS`) for `marker-a`/`marker-b` (both are the same kind of small
ring, just at `+latitude`/`-latitude`):

```typescript
  const overlayLineRenderables: Record<OverlayLineId, OverlayLineRenderable> = {
    equator: createOverlayLineRenderable('equator', new Float32Array((OVERLAY_EQUATOR_SEGMENTS + 1) * 3)),
    axis: createOverlayLineRenderable('axis', new Float32Array(6)),
    'marker-a': createOverlayLineRenderable('marker-a', new Float32Array((OVERLAY_LATITUDE_MARKER_SEGMENTS + 1) * 3)),
    'marker-b': createOverlayLineRenderable('marker-b', new Float32Array((OVERLAY_LATITUDE_MARKER_SEGMENTS + 1) * 3)),
  }
```

(Placeholder sizes must match real per-frame usage exactly, per the existing comment already in this
file about `createLineVertexBuffer` fixing GPU buffer capacity at construction — both markers use
`OVERLAY_LATITUDE_MARKER_SEGMENTS` in Task 4's Step 3 geometry computation, so this matches.)

`OVERLAY_COLORS`/`OVERLAY_GLOW_PARAMS` (the latter new in Task 6) key off this same 4-entry
`OverlayLineId` type — see Task 6 for their values. Remove the old `sunAngleRayPoints` import from
`main.ts`'s `./learn/overlayGeometry` import line.

- [ ] **Step 4: Typecheck and run the updated overlay geometry test**

Run: `cd packages/app && npx vitest run test/overlayGeometry.test.ts`
Expected: PASS (sun-ray test removed, other 4 untouched).

Run: `npm run typecheck` (repo root)
Expected: will still fail on `OVERLAY_COLORS`/the draw-call loop referencing old ids until Task 6 —
proceed directly to Task 6.

---

### Task 6: Pulsing-glow overlay shader (replaces dash-pattern for these two lines) + new neon colors

**Files:**
- Modify: `packages/app/src/renderer/shaders.ts`
- Modify: `packages/app/src/main.ts`

**Interfaces:**
- Consumes: `LINE_UNIFORM_FLOAT_COUNT` (existing, unchanged at 24 — this task reinterprets the
  existing `dashParams` uniform slot, it does not resize anything).
- Produces: `lineShaderCode`'s `dashParams.w` gains a third mode (`2.0` = pulsing glow, in addition
  to the existing `0.0` = solid and `1.0` = dashed, which orbit paths keep using unchanged);
  `OVERLAY_GLOW_PARAMS: Record<OverlayLineId, [number, number, number, number]>` in `main.ts` — no
  later task consumes this beyond this task's own per-frame write (already shown inline in Task 4,
  Step 3, as `uniforms.set(OVERLAY_GLOW_PARAMS[id], 20)`).

- [ ] **Step 1: Extend `lineShaderCode`'s fragment shader with a pulsing-glow branch**

In `packages/app/src/renderer/shaders.ts`, update the `lineShaderCode` fragment function's comment
and body:

```typescript
// Uniform layout: [0..16) worldViewProjection : mat4x4f, [16..20) color : vec4f,
// [20..24) dashParams : vec4f (x = dash length in world units [dash mode] or unused [glow mode],
// y = animated dash offset in world units [dash mode] or the current pulse phase in radians [glow
// mode], z = duty cycle 0..1 [dash mode] or unused [glow mode], w = 0.0 solid / 1.0 dashed / 2.0
// pulsing glow).
export const LINE_UNIFORM_FLOAT_COUNT = 24

// Shared by orbit paths (dashParams.w = 0, solid), learn-mode axis/equator overlays (dashParams.w =
// 2, pulsing glow - a smoothly oscillating alpha, no marching-ants offset), and any future dashed
// use (dashParams.w = 1, kept for orbit-path-style solid/dashed rendering) - one pipeline, one
// shader, gated by a uniform flag rather than near-duplicate shaders.
export const lineShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  color: vec4f,
  dashParams: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) lineDistance: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) lineDistance: f32,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.lineDistance = vert.lineDistance;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  if (uni.dashParams.w > 1.5) {
    // Pulsing glow: alpha oscillates smoothly between 70% and 100% of the base color's own alpha -
    // never fully invisible (unlike the dash mode's hard on/off), reading as a soft pulse rather
    // than a marching pattern.
    let pulse = 0.85 + 0.15 * sin(uni.dashParams.y);
    return vec4f(uni.color.rgb, uni.color.a * pulse);
  }
  if (uni.dashParams.w > 0.5) {
    let dashLength = max(uni.dashParams.x, 0.0001);
    let phase = fract((in.lineDistance - uni.dashParams.y) / dashLength);
    if (phase > uni.dashParams.z) {
      discard;
    }
  }
  return uni.color;
}
`
```

- [ ] **Step 2: New neon colors + pulse-speed constant in `main.ts`**

Replace `OVERLAY_DASH_LENGTH`/`OVERLAY_DASH_SPEED`/`OVERLAY_DASH_DUTY_CYCLE`/`OVERLAY_COLORS` with:

```typescript
  const OVERLAY_COLORS: Record<OverlayLineId, [number, number, number, number]> = {
    equator: [0.16, 0.88, 0.79, 0.95], // neon teal
    axis: [0.98, 0.25, 0.65, 0.95], // neon pink/magenta
    'marker-a': [0.37, 0.88, 0.63, 0.95], // kept from the original marker color, distinct from both lines
    'marker-b': [0.45, 0.68, 0.98, 0.95], // a second, distinct marker color so A and B are visually distinguishable
  }
  const OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND = 3
```

`OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND` is consumed directly by Task 4 Step 3's per-frame overlay
loop (`const pulsePhaseRadians = now * OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND`, then
`uniforms.set([0, pulsePhaseRadians, 0, 2.0], 20)`) — if executing Task 4 before this task, that
line will not typecheck until this constant exists; land Tasks 4-6 together per Step 4's commit note
below.

Also update the overlay lines' vertex/silhouette extent to "extend past the globe" per the design
spec: `rotationAxisPoints`'s `overshootFactor` argument (currently `1.3` in Task 4 Step 3's call)
stays `1.3` (already extends 30% past each pole, judged sufficient — tune higher, e.g. `1.5`, during
Task 10's manual visual check if it still reads as too tight against the globe).

- [ ] **Step 3: Typecheck, build**

Run: `npm run typecheck && npm run build` (repo root)
Expected: both succeed.

- [ ] **Step 4: Commit (Tasks 4, 5, 6 together)**

These three tasks share one `OVERLAY_LINE_IDS` declaration and are impractical to review/commit
independently (Task 4's diff doesn't typecheck until Task 5's rename lands, which doesn't make
sense visually until Task 6's colors replace the dash params). Commit all three together:

```bash
git add packages/app/src/main.ts packages/app/src/learn/overlayGeometry.ts \
  packages/app/src/renderer/shaders.ts packages/app/test/overlayGeometry.test.ts \
  packages/app/index.html
git commit -m "Two symmetric location markers + pulsing neon overlay lines, drop the sun-ray

Replaces the 7-preset latitude picker with two always-visible, mirror-
symmetric markers (marker-a/marker-b at +/-45 degrees) rendered as DOM
labels positioned via the same worldToScreen technique already used
for body labels. Drops the sun-angle-ray overlay entirely - redundant
now that the Sun is directly visible in the staged frame. The
remaining axis/equator overlays get a new pulsing-glow shader mode
(dashParams.w=2, reusing the existing line-uniform layout and pipeline
rather than a new one) and neon pink/teal colors, replacing the
marching-ants dash animation."
```

(Note: `index.html` changes for the two marker label elements are folded into this commit per
Task 8's own file list below — if executing tasks strictly in written order, do Task 8's HTML step
first or fold its marker-label markup into this commit; either ordering is fine as long as the
final diff is coherent. A task reviewer should treat Tasks 4-6 and Task 8's marker-label markup as
one reviewable unit if they land in the same commit.)

---

### Task 7: Declutter — snapshot/restore Display toggles, hard-hide other planets

**Files:**
- Modify: `packages/app/src/main.ts`

**Interfaces:**
- Consumes: `showOrbitPaths`, `showBodyLabels` (existing local variables), `orbitPathsToggle`,
  `bodyLabelsToggle` (existing checkbox elements).
- Produces: nothing consumed by later tasks — this task only adds enter/exit side effects.

- [ ] **Step 1: Snapshot and force-off on entry, restore on exit**

In the lesson-picker click handler (the same one Task 3 Step 7 modified), add a snapshot right
before `learnModeController.enter(...)`:

```typescript
  let preLearnOrbitPaths = true
  let preLearnBodyLabels = true
```

(declare these two `let`s near the other lesson-mode state, e.g. right above the lesson-picker
click-handler registrations)

```typescript
      preLearnOrbitPaths = showOrbitPaths
      preLearnBodyLabels = showBodyLabels
      showOrbitPaths = false
      orbitPathsToggle.checked = false
      canvas.dataset.orbitPaths = 'false'
      showBodyLabels = false
      bodyLabelsToggle.checked = false
      labelsContainer.style.display = 'none'
      canvas.dataset.labelsVisible = 'false'
      learnModeController.enter(lesson.id)
```

(insert these lines right before the `learnModeController.enter(lesson.id)` call already there).

In the `learnModeBtn` click handler's exit branch (`if (learnModeController.currentMode === 'learn')
{ learnModeController.exit(); ... }`), add the restore right after `learnModeController.exit()`:

```typescript
      learnModeController.exit()
      showOrbitPaths = preLearnOrbitPaths
      orbitPathsToggle.checked = preLearnOrbitPaths
      canvas.dataset.orbitPaths = String(preLearnOrbitPaths)
      showBodyLabels = preLearnBodyLabels
      bodyLabelsToggle.checked = preLearnBodyLabels
      labelsContainer.style.display = preLearnBodyLabels ? '' : 'none'
      canvas.dataset.labelsVisible = String(preLearnBodyLabels)
      lessonPanel.hidden = true
      lessonPicker.hidden = true
      return
```

- [ ] **Step 2: Hard-hide every planet except Earth in the draw loop while in learn mode**

There is no existing per-planet visibility toggle (all planets are always drawn) — this is a new,
non-togglable rule specific to learn mode, not a snapshot/restore of user-facing state. In the draw
pass, find:

```typescript
    for (const renderable of planetRenderables) {
      drawBody(pass, litPipeline, meshBuffers, renderable.bindGroup)
    }
```

and change it to:

```typescript
    for (const renderable of planetRenderables) {
      if (learnModeController.currentMode === 'learn' && renderable.definition.id !== 'earth') continue
      drawBody(pass, litPipeline, meshBuffers, renderable.bindGroup)
    }
```

(Moons are already unconditionally hidden in learn mode via the existing `showMoons &&
learnModeController.currentMode !== 'learn'` guards at both the position-computation and draw-call
sites — confirmed already correct from the earlier plan's Task 5, no change needed there.)

- [ ] **Step 3: Typecheck, build, and a targeted manual check**

Run: `npm run typecheck && npm run build` (repo root)
Expected: both succeed.

Run: `cd packages/app && npm run dev`, manually: toggle "Show orbit paths" and "Show body labels"
off in explore mode, enter learn mode (confirm both stay off, as expected since they were already
off), exit (confirm both are still off, matching what you left them at) — then repeat with both ON
in explore mode, enter learn mode (confirm both get forced off despite being on), exit (confirm
both are restored to ON).

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/main.ts
git commit -m "Force-declutter learn mode: hide other planets/orbit paths/labels, restore on exit

Only Sun, Earth, and the starfield backdrop remain visible while a
lesson is open. Orbit paths and body labels reuse their existing
Display-toggle state variables (snapshotted on entry, restored on
exit, so a user's explore-mode preferences are never permanently
altered by visiting a lesson); other-planet visibility has no
existing toggle to snapshot, so it's a hard, non-togglable rule
specific to learn mode instead."
```

---

### Task 8: HTML/CSS — remove scrub bar and latitude-chip markup, add marker labels

**Files:**
- Modify: `packages/app/index.html`
- Modify: `packages/app/src/hud/hud.css`

**Interfaces:**
- Consumes: nothing.
- Produces: `#location-a-label`, `#location-b-label` DOM elements — consumed by Task 4's Step 2/3
  (already written assuming these ids exist; if executing Task 8 after Task 4, this step is what
  makes Task 4's `requireElement` calls actually resolve).

- [ ] **Step 1: Remove the scrub bar and latitude-chip row from the lesson panel markup**

In `packages/app/index.html`, inside `#lesson-panel`, delete the `#lesson-latitude-row` div and the
entire `.hud-shuttle` block containing `#lesson-scrub`/`#lesson-scrub-fill`. The lesson panel
becomes:

```html
    <div id="lesson-panel" class="hud-lesson-panel" hidden>
      <div class="hud-row-between">
        <button id="lesson-prev-chapter" class="hud-icon-btn" type="button" aria-label="Previous chapter">
          <svg class="icon" aria-hidden="true"><use href="#icon-rewind"></use></svg>
        </button>
        <span id="lesson-chapter-title"></span>
        <button id="lesson-next-chapter" class="hud-icon-btn" type="button" aria-label="Next chapter">
          <svg class="icon" aria-hidden="true"><use href="#icon-forward"></use></svg>
        </button>
      </div>

      <p id="lesson-chapter-text" class="hud-lesson-text"></p>
    </div>
```

- [ ] **Step 2: Add the two marker label elements**

Add, as siblings of the existing `#body-labels` container (search for `id="body-labels"` in
`index.html`):

```html
    <div id="location-a-label" class="body-label" style="display: none;">Location A</div>
    <div id="location-b-label" class="body-label" style="display: none;">Location B</div>
```

(Reuses the existing `.body-label` CSS class already defined for planet/Sun name labels —
`position: absolute`, positioned each frame via the same `updateLabelPosition` helper other labels
use, per Task 4 Step 3. No new CSS class is needed for basic positioning; if the labels need visual
distinction from body labels — e.g. a colored dot matching each marker's overlay color — add that
as a small inline style or a new `.location-marker-label` class at this step, tuned visually during
Task 10.)

- [ ] **Step 3: Remove now-dead CSS**

In `packages/app/src/hud/hud.css`, remove the `.hud-latitude-chip`/`.hud-latitude-chip.is-active`
rules and the `#lesson-scrub-fill` left-anchor override rule (`#lesson-scrub-fill { left: 0
!important; }`) — both are dead code now that the elements they styled no longer exist in the DOM.

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build` (repo root)
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add packages/app/index.html packages/app/src/hud/hud.css
git commit -m "Remove the scrub bar and latitude-chip markup; add the two marker labels

Both are dead UI now that scrubbing and the latitude picker are gone
(see the staged-redesign spec). The two marker labels reuse the
existing .body-label positioning pattern, updated each frame by the
same worldToScreen technique already used for planet/Sun name labels."
```

---

### Task 9: e2e test rewrite — the full redesigned flow

**Files:**
- Modify: `packages/app/e2e/learnMode.spec.ts` (remove/rewrite the tests listed below; leave the
  rest untouched)
- Modify: `packages/app/e2e/seasonsLessonFlow.spec.ts` (full rewrite)

**Interfaces:**
- Consumes: everything from Tasks 1-8.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: In `learnMode.spec.ts`, remove tests that no longer apply**

Delete these three tests entirely (their premises no longer exist):
- `'selecting a latitude preset updates the lesson panel and the displayed text'` (no picker left).
- `'camera target stays centered on Earth across a scrub, not frozen at the chapter-defining date (regression)'`
  (no scrub, no camera movement at all once set — nothing to regress-test here anymore).
- `'the canvas keeps rendering (camera locked, not frozen) across a chapter change'` (superseded by
  a simpler assertion in Step 3 below, since there's no more fly-to to keep rendering *through*).

Leave these four untouched (still valid, general learn-mode-shell behavior unaffected by the
staging redesign):
- `'entering and exiting learn mode toggles app-mode state and hides/restores the free-roam dock'`
- `'the corner Display button still opens and closes its panel while in learn mode'`
- `'orbit paths still render (via the shared, now dash-capable line pipeline) with zero pageerrors'`
- `'entity search is explicitly disabled in learn mode, not just unreachable behind the hidden dock'`

- [ ] **Step 2: Rewrite `'chapter navigation and scrubbing update lesson-panel state'`**

Rename and rewrite to drop scrub assertions:

```typescript
test('chapter navigation updates lesson-panel state', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'intro')

  await page.locator('#lesson-next-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'march-equinox')

  await page.locator('#lesson-prev-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'intro')
  await expect(page.locator('#lesson-prev-chapter')).toBeDisabled()

  expect(errors).toEqual([])
})
```

- [ ] **Step 3: Rewrite `'globe overlays render without WebGPU errors across a chapter and latitude change'`**

Rename and rewrite (no more latitude change — replace with a chapter-to-chapter tilt-tween check,
and confirm both marker labels are visible):

```typescript
test('globe overlays and both location markers render without WebGPU errors across a chapter change', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.waitForTimeout(1500) // let the initial season-phase tween settle

  await expect(page.locator('#location-a-label')).toBeVisible()
  await expect(page.locator('#location-b-label')).toBeVisible()

  await page.locator('#lesson-next-chapter').click() // -> june-solstice's tilt tween begins
  await page.waitForTimeout(1500) // let the tween settle

  await expect(page.locator('#location-a-label')).toBeVisible()
  await expect(page.locator('#location-b-label')).toBeVisible()
  expect(errors).toEqual([])
})
```

- [ ] **Step 4: Rewrite `seasonsLessonFlow.spec.ts` end to end**

```typescript
import { expect, test } from '@playwright/test'

test('full seasons lesson flow: enter, all 5 chapters, exit', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')

  const expectedChapterIds = ['intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice']
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

- [ ] **Step 5: Run the affected specs, then the full suite**

Run: `cd packages/app && npx playwright test e2e/learnMode.spec.ts e2e/seasonsLessonFlow.spec.ts --workers=1`
Expected: all pass.

Run: `cd packages/app && npx playwright test --workers=1` (full suite, per this plan's Global
Constraints)
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/app/e2e/learnMode.spec.ts packages/app/e2e/seasonsLessonFlow.spec.ts
git commit -m "Rewrite e2e coverage for the staged-redesign flow

Removes tests whose premises no longer exist (scrub position, the
latitude-preset picker, camera-drift-during-scrub), rewrites chapter-
navigation and overlay coverage for the fixed-camera/tilt-tween model,
and rewrites the full-flow test to drop scrub/latitude steps entirely."
```

---

### Task 10: Final verification pass (with a real manual visual check)

**Files:** none — verification only.

- [ ] **Step 1: Full clean build from scratch**

Run: `rm -rf packages/app/dist packages/engine/build && npm run build`
Expected: succeeds with no errors.

- [ ] **Step 2: Full unit test suite**

Run: `npm run test`
Expected: all pass (engine, app, data-pipeline workspaces).

- [ ] **Step 3: Full e2e suite, serially**

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all pass.

- [ ] **Step 4: Real manual visual walkthrough (the browser-extension connectivity issue is resolved — do not skip this with a "browser unavailable" disclaimer)**

Run: `cd packages/app && npm run dev`. From a fresh page load, using the actual browser (Chrome via
the claude-in-chrome tools, or ask the user to drive it live):

1. Confirm free-roam mode is completely unaffected: dock, camera drag, search, Display toggles all
   behave exactly as before this plan.
2. Click "Learn" → "Why does Earth have seasons?". Confirm: Sun and Earth both visible, clearly
   separated, roughly matching the approved combined-concept mockup from the design brainstorm.
   Confirm other planets, orbit paths, and body labels are NOT visible.
3. Confirm Earth is visibly, continuously spinning on its axis.
4. Confirm the axis line (pink/magenta) and equator ring (teal) are both thicker than before,
   extend past the globe's silhouette, and pulse smoothly rather than showing a moving dash pattern.
5. Confirm "Location A" and "Location B" labels are both visible and positioned on Earth's surface,
   symmetric north/south.
6. Step through all 5 chapters via next/prev. Confirm each chapter transition smoothly re-tilts
   Earth's axis (not a snap, not a camera move) over about a second, and confirm the camera itself
   never moves at any point.
7. At the June solstice chapter, confirm Location A (north) reads as being in daylight more than
   Location B as Earth spins; at the December solstice chapter, confirm this is reversed.
8. At the two equinox chapters, confirm the axis reads as visually upright (no left/right lean) on
   screen, per the seasonalPoleDirection design (§ in the plan header).
9. Toggle "Show orbit paths"/"Show body labels" ON in explore mode, enter learn mode (confirm both
   force off), exit (confirm both restored to ON).
10. Confirm zero console/page errors throughout.

- [ ] **Step 5: No commit** — this task is verification-only. If Step 4 surfaces a real problem, fix
      it as a new small commit on top of the relevant earlier task, re-run this task's steps, and
      only consider the plan complete once they pass clean and Step 4's manual check genuinely
      looks right.

---

## Self-Review Notes

- **Spec coverage:** §2 in-scope items → Task 3 (fixed staging, no camera fly-to), Task 3 (season
  phase replacing date), Task 3 (continuous spin, no scrub bar), Task 4 (two symmetric markers),
  Tasks 5-6 (overlay redesign: drop sun-ray, pulsing glow, neon colors, longer/thicker), Task 7
  (forced declutter), Task 3 (chapter-tilt tween). §3 (staged scene architecture) → Task 3 Steps
  5-8. §4 (chapter model) → Task 1, Task 3 Steps 6-9. §5 (location markers) → Task 1
  (`markerLatitudeDegrees`), Task 4. §6 (overlay lines) → Tasks 5-6. §7 (declutter) → Task 7. §8
  (supersede/keep list) → Global Constraints + verified against every task's diff during this
  self-review (no task reintroduces `dateRange`/`cameraFraming.date`/`scrubT`/`LATITUDE_PRESETS`/
  `sunAngleRayPoints`/`flyToCurrentChapterFraming`/the old target-recentering block; `flyToFraming`/
  `isFlying`/`equatorRingPoints`/`rotationAxisPoints`/`latitudeMarkerPoints`/`latitudeMarkerCenter`/
  `computeCumulativeLineDistances`/`createLineVertexBuffer`/`updateLineVertexBuffer`/
  `LearnModeController` all remain untouched in their own APIs, only new call sites use them). §9
  (testing) → every task's own verification steps, consolidated in Task 10 with a real (not
  disclaimed) manual check. §10 (files touched) → matches the files actually listed per task.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code. The camera-framing
  constants (`LEARN_CAMERA_TARGET`/`RADIUS`/`AZIMUTH`/`ELEVATION`) and a couple of overlay tuning
  values are explicitly marked "tune visually" with concrete starting numbers already given — this
  matches this project's own established convention for such constants (e.g. the original plan's
  `OVERLAY_DASH_LENGTH` comment), not a placeholder.
- **Type consistency:** `Chapter`/`Lesson` (Task 1) are used identically in Tasks 2-4 (`Chapter.
  seasonPhaseDegrees`/`.text`, `Lesson.markerLatitudeDegrees`). `OverlayLineId`'s four values
  (`'equator' | 'axis' | 'marker-a' | 'marker-b'`, Task 5) are used consistently across
  `overlayLineRenderables`, `OVERLAY_COLORS`, `OVERLAY_GLOW_PARAMS`, and the per-frame update/draw
  loops (Tasks 4/6). `seasonalPoleDirection`'s signature (Task 3) matches its one call site added in
  Task 4 Step 3 (`seasonalPoleDirection(currentSeasonPhase)`) and its two call sites in Task 3 Step
  9. `SeasonPhaseTween`'s `retarget`/`update`/`isAnimating` (Task 3) are used consistently at both
  call sites (Task 3 Step 7's `refreshChapterUI`, Task 3 Step 8's per-frame update).
