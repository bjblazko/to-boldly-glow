# Apollo 11 route lesson (schematic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A schematic lesson "Apollo 11: to the Moon and back", launch to splashdown.
**Architecture:** A new staged lesson scene (`learn/apolloRoute/`) like the Moon phases lesson:
staged Earth and Moon as `SceneLayout` bodies, a pure route geometry, overlay lines and HTML labels,
per-chapter camera shots.
**Tech Stack:** TypeScript, WebGPU, gl-matrix, Vitest.
**Spec:** `docs/superpowers/specs/2026-11-22-apollo11-route-lesson-design.md`

## Global Constraints

- ESLint: max-lines 300, max-statements 15, complexity 8, max-params 4.
- Texts in en and de; every chapter narrated or listed in `UNRECORDED_LESSONS`.
- No new third-party assets (photos already in the app).

## Review Focus

- Route continuity at every leg join and at progress values between chapters.
- Path never inside Earth or Moon (except launch and splashdown ends).
- Direction: prograde around Earth, retrograde around the Moon, arrival behind the Moon.
- A chapter entered by jumping (chapters menu) shows the right final stage without the travel.
- Labels hidden when leaving the lesson or switching chapters to another kind.

### Task 1: Route geometry
- Create `packages/app/src/learn/apolloRoute/routeGeometry.ts`, test `test/apolloRouteGeometry.test.ts`.
- Produces: `ROUTE_EARTH`, `ROUTE_MOON`, `ROUTE_EARTH_RADIUS`, `ROUTE_MOON_RADIUS`, `LEGS`,
  `routePoint(progress: number): Vec3` (progress 0–5 over the legs), `routePoints(from, to, n)`,
  `eaglePoint(progress: number): Vec3` (0 orbit, 1 landed, 2 orbit), `freeReturnPoints(n)`,
  `LANDING_SITE`.
- Tests: joins continuous; parking radius; prograde/retrograde by cross product sign; outbound
  arrival point on the Moon's far side; no sample inside a globe; homebound ends on Earth's surface;
  landing site on the near side, 23° east.

### Task 2: Scene, overlay, labels, lesson glue
- Create `routeScene.ts` (progress easing, layout), `routeOverlay.ts`, `routeLabels.ts`,
  `apolloRouteLesson.ts` (StagedLessonScene + shots); `lessonTypes.ts` gets kind `'apolloRoute'`
  and `route?: ApolloRouteStage`; register in `app/app.ts`; labels in `index.html`.
- Tests: scene easing reaches the stage's end, a jump shows the end at once; shot per view.

### Task 3: Lesson content
- `learn/lessons/apollo11.ts`, `i18n/messages/{en,de}/apollo11.ts`, catalog, narration listing,
  CHANGELOG, roadmap, CREDITS (photos reused), screenshot entry `lesson-apollo11`.
- Tests: existing lesson/i18n/narration tests pass with the new lesson.

### Task 4: Narration and a real render
- TTS on the AI PC (44 clips), encode, remove from `UNRECORDED_LESSONS`; `npm run screenshots`.
