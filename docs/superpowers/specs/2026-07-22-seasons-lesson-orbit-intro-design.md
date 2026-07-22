# Seasons Lesson Orbit-Intro Design

## 1. Motivation

The shipped "Why does Earth have seasons?" lesson (`docs/superpowers/specs/2026-07-21-seasons-lesson-staged-redesign-design.md`) deliberately inverts the real mechanism for pedagogical clarity: Earth's position is fixed and its axis *appears* to rotate between chapters, instead of the real "axis fixed in space, orbital position changes" relationship. That simplification was the right call for teaching "what does each season look like" - but it never explains *why* the simplification is valid. A user who already understands real orbital mechanics may find the staged version's rotating axis actively confusing rather than clarifying.

This spec adds a short "real mechanism" prelude - four new chapters, prepended to the existing five - that shows Earth actually orbiting the Sun with its axis held in a single, constant direction, and reveals that the same 23.4/0-degree angle readout the existing chapters use emerges naturally from that fixed axis plus a changing position. Only then does the lesson move into the existing staged chapters, now understood as a deliberate simplification rather than an unexplained one.

## 2. Chapter data model

`Chapter` (`packages/app/src/learn/lessonTypes.ts`) gains one new field:

```ts
export interface Chapter {
  id: string
  title: string
  kind: 'orbit' | 'staged'
  seasonPhaseDegrees: number
  text: string
}
```

- `kind` defaults conceptually to `'staged'` for every existing chapter - the five chapters already shipped are updated to say so explicitly (an explicit tag, not an inferred default, so `main.ts`'s per-frame code can branch on it directly without re-deriving it).
- `seasonPhaseDegrees` is reused as-is for both kinds, but means something different depending on `kind`:
  - `'staged'` (existing behavior, unchanged): Earth's position is fixed at `EARTH_STAGED_POSITION`; `seasonPhaseDegrees` drives `seasonalPoleDirection(phase)`, which tilts Earth's axis.
  - `'orbit'` (new): Earth's axis direction is fixed (see §4); `seasonPhaseDegrees` instead drives Earth's *position* around a compact circular orbit path (see §4).
- No new fields on `Lesson` are needed - `markerLatitudeDegrees` stays as-is (still only consumed by staged chapters, per §6 below).

## 3. Camera: a new fixed wide-shot preset

A second one-time camera preset, applied identically to how `applyLearnCameraFraming` already works:

- `applyOrbitCameraFraming()` sets a wide, mostly top-down view centered near the Sun, framed so the whole compact orbit circle (§4) is comfortably in frame with Earth visible at any point on it.
- Like the existing staged camera, this is set **once** and never moves while an orbit chapter is showing - no fly-to, no per-frame recentering. This preserves the architectural rule this lesson already established (a moving camera caused two real bugs earlier in this project's history).
- **Hard cut, not an animated transition**, when the user steps from the last orbit chapter ("Real December Solstice") into the first staged chapter ("Intro: A Tilted World"), and likewise stepping backward. `applyLearnCameraFraming()` / `applyOrbitCameraFraming()` are called directly from the existing chapter-navigation handler, keyed on the new/old chapter's `kind` - if `kind` differs from the previous chapter, call the appropriate framing function; if it's the same, do nothing (leaving the camera exactly where it is, matching the existing chapters' own behavior of never re-framing between same-kind chapters).

## 4. What's on screen during an orbit chapter

- **Sun**: unchanged, still the real Sun rendering at the world origin.
- **Orbit path**: a new, simple circular path (not the real elliptical orbit-path renderer used in explore mode) at a fixed, compact radius - drawn once per orbit chapter via the same overlay-line pipeline already used for the equator ring/axis/protractor lines (`overlayLineRenderables`, `LINE_UNIFORM_FLOAT_COUNT`), just a new line id scoped to `kind === 'orbit'`.
- **Earth**: rendered at a position on that circle. The position angle uses the exact same `seasonPhaseDegrees` convention as the staged chapters (0 = June, 90 = September, 180 = December, 270 = March), so the four orbit chapters visually sweep around the circle in the same order the staged chapters already use.
- **Earth's axis**: drawn with a single fixed world-space direction, identical across all four orbit chapters - this is the whole point, and needs to visibly *not* move chapter to chapter. See §5 for exactly which vector.
- **The "effective angle" protractor**: the same reference-line + arc + degree-label overlay already built for the staged chapters, reused here but fed different inputs (see §5) - so the same familiar "23.4°" / "0.0°" readouts reappear, tying the two halves of the lesson together visually.
- **Location markers A/B**: intentionally omitted during orbit chapters. At this wide, mostly top-down scale they'd be too small to read, and the point of this section is the axis/position relationship, not the two locations - they're reintroduced once the lesson cuts to the staged close-up.

## 5. The mechanism: reusing the same trig from the other direction

The fixed axis used throughout all four orbit chapters is exactly `seasonalPoleDirection(0)` (the same vector the staged June-solstice chapter already computes) - Earth's real axial tilt direction, anchored once. It is a `const`, computed once, not a function of the orbit chapter's own `seasonPhaseDegrees`.

Earth's orbital position for a given `seasonPhaseDegrees` value is a point on the compact circle, parameterized the same way `EARTH_STAGED_POSITION` implicitly picked "phase = 0" as a fixed spot - i.e. the Sun-Earth radial direction at phase P is the same unit vector shape `seasonalPoleDirection` already uses for its X/Z lean, just applied to a *position* on a circle instead of a *tilt*.

The angle shown in the protractor overlay is NOT the raw angle between the fixed axis and the current radial Sun-Earth direction - that raw angle is 90 degrees at the equinoxes and 90 +/- 23.4 degrees at the solstices (the axis and the Sun-Earth line are never far from perpendicular; a perfectly upright axis is *90 degrees from sunward*, not 0). The displayed number, and the arc that visually represents it, must instead be the axis's *deviation from perpendicular* to that Sun-Earth direction: take the axis's own component perpendicular to the current sunward direction (implemented as `perpendicularComponent` in `overlayGeometry.ts`) as the "zero-tilt" reference, and measure the angle from that reference to the axis itself. Plugging in the four chapter phases this way reproduces the same 23.4/0/23.4/0-degree sequence the staged chapters show - because it is, mathematically, the same relationship viewed from the other side. This equivalence is the entire pedagogical payoff of this addition and should be visually unmistakable: the number on screen doesn't change between the two halves of the lesson, only *which thing is moving* does. The drawn arc must sweep this SAME angle (from the perpendicular-to-sunward reference to the axis) - not the raw axis-to-sunward angle - or the arc's visible span and its printed label will disagree, which is exactly the bug this correction fixes.

## 6. Chapter content

Four new chapters, prepended before the existing "Intro: A Tilted World":

| id | title | seasonPhaseDegrees | kind |
|---|---|---|---|
| `orbit-march` | Real March Equinox | 270 | orbit |
| `orbit-june` | Real June Solstice | 0 | orbit |
| `orbit-september` | Real September Equinox | 90 | orbit |
| `orbit-december` | Real December Solstice | 180 | orbit |

(Ordered to match the existing staged chapters' own order: March, June, September, December - not numeric phase order - for a consistent story across the cut.)

Each chapter's text follows the same shape: state that this is Earth's real position in its orbit, that its axis points the same fixed direction in space it always does, and (for the solstice chapters) name the resulting angle number shown on screen. Exact copy is an implementation-time detail, not a spec-level decision, but must satisfy: no calendar dates (matching the existing lesson's studio-diagram convention), and an explicit call-out that the axis direction is unchanged from the previous orbit chapter.

The existing five chapters (`intro`, `march-equinox`, `june-solstice`, `september-equinox`, `december-solstice`) are unchanged in content and phase values - only gaining the explicit `kind: 'staged'` tag.

## 7. Explicit supersede/keep list

- **New**: `kind` field on `Chapter`; the four `orbit-*` chapters; `applyOrbitCameraFraming()`; the compact circular orbit-path line id; the fixed-axis line id (reusing the overlay-line pipeline); orbit-position math (a small pure function, unit-testable, mirroring `seasonalPoleDirection`'s own style).
- **Changed**: the chapter-navigation handler gains the kind-based camera-framing branch from §3; the five existing chapters get an explicit `kind: 'staged'`.
- **Unchanged, explicitly**: `seasonalPoleDirection` itself (still exactly what the staged chapters use); `EARTH_STAGED_POSITION`/`EARTH_STAGED_RADIUS`; the staged camera preset and its side-on framing (§2-§4 of the prior redesign spec); the location-marker latitude/longitude constants; the declutter (orbit-paths/labels/flares) snapshot-restore behavior, which continues to apply across the whole lesson regardless of chapter kind; the shared overlay-line rendering pipeline and pulsing-glow shader mode (only reused, not modified).

## 8. Testing

- Unit tests (pure functions, no WGSL/GPU involved): the new orbit-position-from-phase function (mirrors `seasonalTilt.test.ts`'s style - unit length / expected positions at the four cardinal phases) and the fixed-axis-vs-radial-direction angle computation (asserting the same 23.4/0-degree pattern §5 describes).
- e2e smoke tests (extending `learnMode.spec.ts` / `seasonsLessonFlow.spec.ts`): chapter count is now 9; stepping through all 9 chapters produces zero `pageerror`s; the camera-framing hard-cut happens exactly at the orbit/staged boundary (asserted indirectly - e.g. a data attribute reflecting current chapter `kind`, or simply that navigation across the boundary doesn't error and lands on the right chapter id); Location A/B labels are hidden during orbit chapters and visible again once the staged chapters begin.
