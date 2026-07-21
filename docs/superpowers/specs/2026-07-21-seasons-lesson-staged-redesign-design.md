# Seasons Lesson Staged-Diagram Redesign — Design Specification

Status: Approved — 2026-07-21

## 1. Motivation

The "Why does Earth have seasons" learning-mode lesson (implemented in
`docs/superpowers/plans/2026-07-21-earth-seasons-learning-mode.md`, shipped this session) had never
been visually verified until this session's manual walkthrough — a black-screen bug was found and
fixed first (a `vec3.slerp` divide-by-zero, commit `c551126`), and once the scene actually rendered,
the user's first real look surfaced several problems the original real-astronomical-position design
didn't anticipate:

- A stray-looking overlay line (the sun-angle ray) that's hard to distinguish from the axis line and
  doesn't obviously connect to anything from most camera angles.
- A visible "slide to the edge, hold, then jump to center" camera artifact on every chapter load — a
  direct consequence of the chapter's camera fly-to targeting Earth's position on the chapter's fixed
  defining date, while Earth's actual rendered position tracks the scrub bar (which opens 7 days
  earlier every time).
- The real-orbital-position camera framing doesn't clearly show day/night as two hemispheres, and
  reads as "a real space scene" rather than a clear teaching diagram.
- Explore-mode clutter (other planets, orbit paths, labels) remains visible by default in learn mode,
  since only the Camera/Time dock panels are hidden — Display toggles are untouched.
- Seven latitude presets (including two named cities) were judged too complex for the pedagogical
  point being made.

Rather than patch these individually, this spec redesigns the lesson's staging fundamentally: a fixed,
non-realistic "studio diagram" of Sun and Earth side by side, with Earth's axial tilt doing all the
explanatory work, instead of a scene trying to also look like real space. This **supersedes** several
mechanisms from the original spec/plan (real per-chapter camera fly-to, calendar-date-driven Earth
position, the 7-preset latitude picker, the sun-angle-ray overlay) — see §8 for exactly what's replaced
vs. kept.

## 2. Scope

**In scope**:
- A fixed "studio" staging: Sun and Earth both visible, side by side with a clear gap, never moving on
  screen — no camera fly-to for this lesson at all.
- Per-chapter Earth axis-tilt orientation (real 23.4° tilt, reoriented per chapter to match the real
  seasonal relationship — toward the Sun at June solstice, away at December solstice, neutral at each
  equinox) instead of a real calendar date driving Earth's position.
- Earth continuously spinning on its tilted axis while a chapter is open (no scrub bar), so the two
  location markers visibly cycle through day and night.
- Two fixed, symmetric location markers (same latitude magnitude, opposite hemispheres — e.g. 45°N /
  45°S) replacing the 7-preset latitude picker entirely. No picker UI; both markers are always shown.
- Redesigned overlay lines: rotation axis (pink/magenta neon) and equator ring (teal neon) only — the
  sun-angle ray is dropped (redundant now that the Sun is directly visible in frame). Thicker, extend
  past the globe's silhouette, no marching-ants dash animation — a soft pulsing glow instead.
- Forced decluttering on learn-mode entry: other planets, orbit paths, and body labels hidden
  regardless of their explore-mode Display-toggle state; that state is restored exactly on exit.
- A brief animated tilt transition (not a camera move) when switching chapters, so the axis
  re-orientation reads as a smooth re-tilt rather than a jump-cut.

**Out of scope** (explicitly deferred):
- Any change to the general learning-mode shell (mode switch, corner controls, Display-panel
  relocation) — that infrastructure from the original plan is unaffected and reused as-is.
- Any change to other future lessons (moon phases, eclipses) — this spec only redesigns the seasons
  lesson's own staging and content.
- Naming the two location markers with real place names — they stay generic ("Location A"/"Location
  B") per the locked-in decision.

## 3. Staged scene architecture

**Sun stays exactly where it already is** (world origin, unmoved) — its existing rendering (corona,
flares, lighting-source role for every body's shading) needs zero changes. **Earth is moved to a
fixed, nearby staged coordinate** while in learn mode, reusing the existing `isLearnEarth` position-
override mechanism already in `main.ts`'s render loop (previously driven by a real scrub-derived
date; now driven by a fixed staged position instead). Since Earth's shading already computes its
light direction as "toward the origin" (where the Sun already lives, untouched), moving only Earth
requires no lighting/shadow math changes at all — this is the same pattern already established, just
with a fixed target instead of a computed one.

The **camera is entirely fixed** for the whole lesson (one framing, set once on entering learn mode,
never re-tweened per chapter) — this is what eliminates the slide/jump artifact structurally, not by
patching the fly-to timing. `CameraFollowController.flyToFraming` and the per-frame target-recentering
logic added earlier this session remain in the codebase (harmless, potentially useful for a future
lesson) but are no longer invoked by the seasons lesson.

Distances and sizes for this staged shot are chosen purely for legibility (a clear gap between Sun and
Earth, both easily distinguishable), completely independent of the Realistic/Compact scale toggle
(already hidden in learn mode) — this lesson hardcodes its own staging geometry rather than deriving
it from real AU distances or real relative radii.

## 4. Chapter model

Each of the 5 chapters (Intro, March Equinox, June Solstice, September Equinox, December Solstice)
specifies a **fixed axis-tilt orientation** — the real 23.4° tilt, rotated to match that season's real
relationship between Earth's (fixed-in-space) rotational axis and the Sun direction — instead of a
real calendar date. Intro uses the same staged framing as every other chapter, starting at a neutral
(equinox-like) tilt, with both overlays and both location markers already visible, before the season
chapters change the orientation.

Within a chapter, Earth spins continuously around its tilted axis (driven by elapsed real time, not a
user-controlled scrub position) — there is no chapter-local scrub bar in this design. Switching
chapters (prev/next) smoothly animates the tilt orientation from the old chapter's angle to the new
one over a short duration (a rotation tween on Earth's own transform, not a camera move), so the
re-tilt reads as continuous rather than snapping.

This **supersedes** `dateAtScrubPosition`, `Chapter.dateRange`, and `ChapterCameraFraming`'s date field
from the original data model (§8) — a chapter's defining property is now a tilt angle/orientation, not
a date range.

## 5. Location markers

Two fixed markers at the same latitude magnitude on opposite sides of the equator (e.g. 45°N and
45°S — exact value refined at implementation time for visual clarity against the globe), always both
visible, no selection UI. Labeled generically ("Location A" / "Location B"), with each marker's glow
color distinct from the axis/equator overlay colors so it doesn't blend into the pink/teal lines. As
Earth spins, each marker's own day/night state is visually obvious (in sunlight or in shadow), and
across the 4 season chapters the two markers trade which one currently reads as "long day" vs. "short
day" — the core pedagogical payoff, replacing the original latitude-picker mechanic entirely (§8).

## 6. Overlay lines

Only two overlays remain: the **rotation axis** (pink/magenta neon, `#ff3fa4`-ish) and the **equator
ring** (teal neon, `#2de0c9`-ish). Both are thicker than the original dashed lines, extend visibly past
Earth's silhouette (not clipped tight to the globe's edge), and use a soft pulsing glow (opacity/
intensity oscillating smoothly) instead of the animated dash-offset "marching ants" effect. The
sun-angle ray is dropped entirely — with the Sun directly visible in the same frame, a separate
pointer to it is redundant.

This changes the rendering approach from Task 7's dash-pattern line extension (per-vertex arc-length
attribute + dash-length/speed/duty-cycle uniform) to a glow-pulse approach (e.g., an animated alpha/
emissive-intensity uniform, no per-vertex arc-length needed) — simpler in one sense (no dash-length
tuning) but needs its own small shader treatment for the pulsing glow. Exact technique (uniform-driven
alpha oscillation vs. a bloom-adjacent glow trick) is an implementation-time decision, not a design
constraint here, as long as the visual result matches §6's description.

## 7. Declutter

On entering learn mode, the seasons lesson snapshots the current Display-toggle state (orbit paths,
body labels, other-planet visibility, moons, starfield, bloom, lens flares — whichever of these
Display already controls) and forces the ones relevant to decluttering (orbit paths, other-planet
visibility, body labels at minimum) off, leaving only the Sun, Earth, and the starfield backdrop
visible. On exit, the exact snapshotted state is restored, so a user's explore-mode preferences are
never permanently altered by visiting the lesson.

## 8. What this supersedes vs. keeps from the original plan

**Superseded / removed for the seasons lesson specifically**:
- `Chapter.dateRange`, `Chapter.cameraFraming.date`, `dateAtScrubPosition` — no real calendar date
  drives anything anymore; replaced by a fixed per-chapter tilt orientation.
- The chapter-local scrub bar UI and `LessonPlayer.scrubT`/`setScrubT` — replaced by continuous
  axis-spin animation with no user scrub control.
- The 7-entry `LATITUDE_PRESETS` array and the latitude-chip picker UI (`refreshLatitudeRow`,
  `.hud-latitude-chip`) — replaced by two always-visible fixed markers.
- `sunAngleRayPoints` and the `'sun-ray'` overlay line entirely.
- Per-chapter camera fly-to (`flyToCurrentChapterFraming`, the call into
  `CameraFollowController.flyToFraming` for chapter changes) and the per-frame target-recentering
  block added earlier this session — the camera is simply fixed for this lesson.
- The dash-pattern/animated-offset line rendering from Task 7 (`LINE_UNIFORM_FLOAT_COUNT`'s
  `dashParams`, `computeCumulativeLineDistances`'s per-vertex arc-length use for overlays) — replaced
  by a pulsing-glow treatment for the two remaining overlay lines. `computeCumulativeLineDistances`
  and the renamed `createLineVertexBuffer`/`updateLineVertexBuffer` stay in place for orbit-path
  rendering (unaffected, still solid/non-pulsing in explore mode) and remain available if a future
  lesson wants dashed lines.

**Kept, reused as-is**:
- The general learning-mode shell: `LearnModeController`, the corner Learn/Exit control, Camera/Time
  panel hiding, Display-toggle relocation, disabled free camera input and entity search.
- `Lesson`/`Chapter` as the top-level data shape (fields change per §4, but lessons are still plain
  TypeScript data, still keyed via `LESSONS_BY_ID`).
- `equatorRingPoints`, `rotationAxisPoints`, `latitudeMarkerPoints`/`latitudeMarkerCenter` (geometry
  math is unaffected by the staging change — still computed from Earth's current world transform and
  a latitude value; only which values get passed in, and how many markers, changes).
- `CameraFollowController.flyToFraming`/`isFlying` (unused by this lesson now, but harmless,
  general-purpose infra for any future lesson that does want a real camera fly-to).

## 9. Testing

Consistent with this project's established pattern (no WGSL unit-test framework):
- `npm run typecheck` / `npm run build`.
- Vitest coverage for pure logic: per-chapter tilt-orientation data, the two-marker symmetric-latitude
  computation, any new pure geometry/animation-timing helpers.
- Playwright e2e smoke tests: enter learn mode, step through all 5 chapters, confirm both location
  markers and both overlay lines are present with zero `pageerror`s, confirm other planets/orbit-
  paths/labels are hidden while in learn mode and restored on exit with their prior toggle states
  intact.
- Manual visual check in a running browser (now finally possible, since the browser-extension
  connectivity issue that blocked every visual check earlier in this session has been resolved) —
  confirm the staged framing, tilt read, marker day/night cycling, and overlay glow/pulse all look
  right, since none of the automated tests can judge visual quality.

## 10. Files touched (expected, refined further at plan time)

- `packages/app/src/learn/lessonTypes.ts` — `Chapter`/`ChapterCameraFraming` shape changes (tilt
  orientation replaces date/dateRange); `LatitudePreset` likely removed or replaced by a simpler
  two-marker shape.
- `packages/app/src/learn/lessons/seasons.ts` — full rewrite of chapter data (tilt orientations, no
  dates), two fixed markers instead of 7 presets.
- `packages/app/src/learn/lessonPlayer.ts` — scrub-related methods removed; chapter-nav-only surface.
- `packages/app/src/learn/overlayGeometry.ts` — drop `sunAngleRayPoints`; keep the equator/axis/
  marker functions.
- `packages/app/src/main.ts` — remove `flyToCurrentChapterFraming`/target-recentering/scrub-bar
  wiring for this lesson; add fixed staged Earth positioning, Display-toggle snapshot/restore, axis-
  spin animation, chapter-to-chapter tilt tween.
- `packages/app/src/renderer/shaders.ts` — pulsing-glow treatment for the two remaining overlay
  lines, replacing (for this use case) the dash-pattern approach.
- `packages/app/index.html` / `hud/hud.css` — remove the scrub bar and latitude-chip row markup from
  the lesson panel; add the two static marker labels.
- `docs/superpowers/plans/2026-07-21-earth-seasons-learning-mode.md` — not modified (historical
  record of what was originally built), but this spec's own implementation plan will explicitly
  supersede several of its tasks' deliverables.
