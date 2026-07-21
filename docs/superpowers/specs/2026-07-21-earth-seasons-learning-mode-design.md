# Earth Seasons Visualization + Learning Mode — Design Specification

Status: Approved — 2026-07-21

## 1. Motivation

`docs/roadmap.md` names "Earth seasons visualization" as a deferred feature: explain why Earth has
seasons via its 23.4° axial tilt relative to the orbital plane, not (the common misconception)
distance from the Sun. Building it directly into the existing free-roam HUD would either clutter that
HUD with lesson-specific controls it doesn't otherwise need, or force the lesson to compromise on
camera/timeline control it needs to stay legible. The roadmap also lists two more "dedicated view"
features in the same spirit (moon phase / cycle deep-dive, solar & lunar eclipses), so this is not a
one-off need — the app needs a general pattern for guided, explanatory content that coexists with,
but is structurally distinct from, its existing free-roam "look around" experience.

This spec covers both: a general **learning mode** switch (explore ⇄ learn) with just enough
structure to support more than one lesson later, and **Earth seasons** as its first, fully-specified
pilot lesson. The learning-mode mechanism is deliberately not over-built for hypothetical future
lessons — it's scoped to what the seasons lesson actually needs, validated by a real use case rather
than speculative design.

## 2. Scope

**In scope**:
- A top-level `appMode: 'explore' | 'learn'` switch, entered via a new corner "Learn" control
  (separate from the existing bottom dock) that opens a lesson picker.
- A "Why does Earth have seasons" lesson: 5 chapters (Intro, March Equinox, June Solstice, September
  Equinox, December Solstice), each with lesson-authored camera framing, a real-date scrub range, and
  scrub-position-dependent educational text.
- A latitude preset picker (Equator, Tropic of Cancer, Tropic of Capricorn, Arctic Circle, Antarctic
  Circle, 1-2 named cities), available in every chapter, driving a latitude marker and sun-angle
  overlay.
- New globe overlay geometry: equator ring, rotation-axis line, sun-angle ray, latitude marker —
  dashed, labeled, with a subtle animated "marching ants" dash-offset and a pulsing marker.
- A lightweight per-chapter scrub control (visually based on the existing time-shuttle component,
  wired to chapter-local progress instead of global simulation speed).
- Lesson data types (`Lesson`, `Chapter`) general enough that a second lesson (moon phases, eclipses)
  is a new data file, not a rearchitecture.

**Out of scope** (explicitly deferred, not part of this spec):
- Any lesson content beyond Earth seasons (moon phases, eclipses stay on the roadmap as-is).
- Free camera movement during a lesson (locked-per-chapter only, per this session's decision).
- A generalized "lesson authoring" UI/tooling — lessons are authored as TypeScript data, same as
  `bodies.ts`/`moons.ts` today.
- Click-to-place latitude selection or a continuous latitude slider (named presets only).
- Any change to the free-roam experience itself beyond adding the mode-switch entry point and
  relocating the Display toggle.

## 3. Mode switch & app state

A new `appMode` state (`'explore' | 'learn'`), added alongside `main.ts`'s existing per-frame state
— not a rewrite of the render loop, since both modes render into the same WebGPU canvas and reuse the
same body/camera/time infrastructure underneath.

**Entry point**: a new corner control (visually distinct from the bottom dock, confirmed via the
visual companion) opens a small lesson picker. Only "Why does Earth have seasons" exists today; the
picker is a simple list so a second lesson is an added list entry, not new UI.

**On entering learn mode**:
- The **Camera** and **Time** dock panels are hidden. The lesson's own bottom panel (chapter
  nav/text/scrub bar) occupies that same screen real estate — chosen over a side panel or floating
  caption via the visual companion, specifically because it reuses the free-roam dock's exact
  position so switching modes doesn't relocate the user's attention.
- The **Display** toggle (labels, orbit paths, bloom, etc.) stays reachable — moved to sit near the
  corner Learn/Exit control, so its effects remain available regardless of mode, per explicit
  confirmation that "view options should remain."
- Free camera drag/zoom and entity search are disabled. Each chapter authors its own camera framing
  (target, radius, azimuth, up-axis — the same fields `CameraFollowController`'s existing fly-to
  tween already animates for search results), reusing that machinery rather than duplicating it.
  Fly-to tweens today don't touch elevation (it stays at whatever the user last had); if a chapter's
  framing genuinely needs a specific elevation, extending the tween to cover it is a small addition
  at plan time, not a redesign.

**On exit**: the free-roam camera state and simulation clock are restored exactly as they were before
entering, following the same pattern already used when a followed entity's search lock is cleared.

## 4. Chapter animation & scrub control

Each chapter defines a short real date range (e.g. "one week either side of the June solstice"). A
new lightweight scrub bar — visually based on the existing time-shuttle component
(`hud/shuttleVisual.ts`), but wired to **chapter-local progress** (0→1) instead of global simulation
speed — maps scrub position linearly to a date within that range.

That date feeds the *exact same* VSOP87 position/rotation computation the free-roam render loop
already uses for live simulation time — the only difference is the date comes from the chapter's
scrub state instead of the running simulation clock. No new orbital-mechanics code is needed; this is
a different clock source feeding the existing pipeline.

Educational text is a function of scrub position within the chapter, not a single static blurb per
chapter — e.g. text can swap the moment the scrubbed date crosses the solstice/equinox itself ("now
it's summer in the Northern Hemisphere...").

Chapter navigation (prev/next) moves between the 5 fixed chapters; the scrub bar moves within a
chapter's own date range. There is no continuous single-timeline mode across the whole lesson.

## 5. Globe overlays

New line geometry, recomputed every frame from Earth's current world transform (the same transform
already driving the rendered mesh, so overlays never drift out of sync with the visible globe):

- **Equator ring** — Earth's equatorial plane, traced as a great circle.
- **Rotation-axis line** — through both poles, along Earth's real tilt.
- **Latitude marker** — a point at the selected preset latitude, with an inline label.
- **Sun-angle ray** — from the latitude marker toward the Sun's current direction, visualizing the
  angle of incidence that actually drives day length/season intensity at that latitude.

Rendered via the existing generic line-rendering pipeline already used for orbit paths — no new
shader infrastructure, just new per-frame vertex data. Visual treatment (confirmed via the visual
companion): **dashed lines with inline labels**, not solid lines with a legend — reads as "reference
geometry" rather than physical structure. Per explicit request, dashes get a subtle animated
"marching ants" offset (a time-based uniform shifting the dash pattern along each line), and the
latitude marker gets a soft pulse — small, continuous motion cues that these are live/active
indicators, not static decals.

## 6. Latitude picker

Named presets only (no free slider, no click-to-place): Equator, Tropic of Cancer, Tropic of
Capricorn, Arctic Circle, Antarctic Circle, and 1-2 well-known cities. Available in every chapter, not
gated to a specific one — lets a user compare, say, "June solstice at the equator vs. the Arctic
Circle" within the same chapter. Each preset can carry tailored educational-text hooks (e.g. "at the
Arctic Circle, the sun never sets in June") rather than relying on generic latitude-independent text.

## 7. Content structure (Earth seasons lesson)

1. **Intro** — wide framing showing Earth's 23.4° tilt against its orbital plane. Establishes the
   core idea: it's the tilt, not distance from the Sun, that causes seasons.
2. **March Equinox** — Sun over the equator; both hemispheres receive roughly equal daylight.
3. **June Solstice** — north pole tilts toward the Sun; Northern Hemisphere summer, Southern
   Hemisphere winter.
4. **September Equinox** — equal again, opposite trend from March.
5. **December Solstice** — south pole tilts toward the Sun; Northern Hemisphere winter, Southern
   Hemisphere summer.

Each chapter's scrub range spans roughly a week or two around its defining date, so scrubbing shows
the tilt's effect ramping in/out rather than a single frozen instant.

## 8. Data model

New `Lesson`/`Chapter` TypeScript types, general enough for a future second lesson without rework:

```ts
interface LatitudePreset {
  id: string
  label: string                    // e.g. "Arctic Circle"
  latitudeDegrees: number
  text?: (scrubT: number) => string  // optional latitude-specific text override, e.g. "the sun
                                      // never sets here in June" — falls back to the chapter's
                                      // own generic text() when omitted
}

interface Chapter {
  id: string
  title: string
  dateRange: [Date, Date]          // real calendar dates the scrub bar interpolates across
  cameraFraming: { target: [number, number, number]; radius: number; azimuth: number; upAxis: [number, number, number] }
  text: (scrubT: number, latitude: LatitudePreset) => string
}

interface Lesson {
  id: string
  title: string
  chapters: Chapter[]
  latitudePresets: LatitudePreset[]
}
```

The seasons lesson is one such data file (mirrors how `bodies.ts`/`moons.ts` are plain data today), a
small `LearnModeController` drives mode state/chapter navigation/scrub position, and rendering reuses
existing body-position, camera, and line-rendering code paths rather than introducing parallel ones.

## 9. Testing

Consistent with this project's established pattern (no WGSL unit-test framework; see prior specs'
Global Constraints):
- `npm run typecheck` / `npm run build`.
- Vitest coverage for pure logic: chapter date-range → scrub-progress mapping, lesson/chapter data
  shape, latitude-preset → overlay-position math.
- Playwright e2e smoke test: enter learn mode, step through all 5 chapters, change latitude preset,
  scrub within a chapter, exit — asserting zero `pageerror`s and correct `data-*` state attributes
  (mirroring existing e2e conventions), not pixel-level assertions.
- Manual visual check in a running browser: confirm camera framing per chapter reads clearly, overlay
  lines/labels are legible, text updates correctly across scrub/chapter transitions, and exiting
  restores the prior free-roam view exactly.

## 10. Files touched (expected, refined further at plan time)

- New: `packages/app/src/learn/` — `LearnModeController`, `Lesson`/`Chapter` types, the seasons
  lesson data file, chapter scrub-bar UI, globe overlay geometry/rendering.
- `packages/app/index.html` / `hud/hud.css` — new corner Learn control, relocated Display toggle,
  lesson bottom-panel markup.
- `packages/app/src/main.ts` — `appMode` state, mode-switch wiring, overlay draw calls added to the
  existing render pass.
- `packages/app/src/renderer/shaders.ts` — dash-pattern/animation support added to the existing line
  shader (reused, not duplicated, for orbit paths and overlays alike).
- `docs/roadmap.md` — remove the "Earth seasons visualization" entry once implemented.
