# Orbit camera: a movable pivot – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The orbit camera turns and zooms around a pivot the user can move: a pan, with zoom
toward the pointer, in Explore and in lessons.

**Architecture:** `OrbitCamera` keeps `target` (what follow, lessons and missions aim at) and adds a
`panOffset` on top of it. The camera turns around `pivot() = target + panOffset`, so following a
moving body keeps working unchanged. Pure helpers turn screen gestures into world moves (pan by
pixels, zoom toward a point on screen) and classify wheel events. The input controller routes
gestures to them. Lessons set the pan limit and clear the offset whenever they frame a shot.

**Tech Stack:** TypeScript, gl-matrix, Vitest (node environment, no DOM), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-camera-controls-design.md`, Part 1 only.

## Global Constraints

- No new dependencies.
- Unsure whether a wheel event is a mouse or a trackpad: it zooms, never pans.
- The pivot never leaves `panLimit` (world units) around `target`.
- Ground shots in lessons stay fixed (input stays off there, as today).
- Tours and mission tours keep the camera locked, and start with no pan offset.
- Texts in en and de; comments in the project's style (say why, plain sentences).
- Keyboard in orbit mode: arrows turn, W/S and +/− zoom; A/D and R/F do nothing in orbit.

## Review Focus

- Zoom at the zoom floor or ceiling: when the radius is clamped, the pivot must not drift
  (only the factor actually applied moves it). → Task 2 test.
- A pan that would cross the limit stops at the limit and keeps sliding along it, rather than
  ignoring the whole move. → Task 1 test.
- Changing the scale (Realistic ↔ Compact) while following a body with a pan offset: the offset
  scales with the framing, or the pivot ends up in empty space. → Task 6 test.
- Leaving a lesson brings back the Explore pan offset from before the lesson. → Task 6 test.
- Touch: two fingers that pinch and move at once both zoom (toward their midpoint) and pan, in
  one gesture. → Task 4 test.

---

### Task 1: OrbitCamera – pan offset, pivot, limit

**Files:**
- Modify: `packages/app/src/camera/orbitCamera.ts`
- Test: `packages/app/test/orbitCamera.test.ts`

**Interfaces:**
- Produces on `OrbitCamera`:
  - `panOffset: vec3` (starts at zero)
  - `panLimit: number` (default `DEFAULT_PAN_LIMIT = 700`, the default maxRadius)
  - `pivot(): vec3` → `target + panOffset`
  - `shiftPivot(delta: Vec3): void` → adds the delta, then clamps `|panOffset| ≤ panLimit` by
    scaling it back onto the sphere
  - `clearPan(): void`
  - `screenAxes(): { right: vec3; up: vec3 }` → the camera's unit right and up vectors in world
    space (rows 0 and 1 of the view matrix)
- `getEyePosition()` and `getViewMatrix()` orbit `pivot()` instead of `target`.

- [ ] **Step 1: Write the failing tests** in `describe('OrbitCamera pan')`:
  - `it('turns around target + panOffset')`: with target `[1,2,3]`, after `shiftPivot([0,0,5])`,
    `pivot()` is `[1,2,8]`, and the eye is `radius` away from `[1,2,8]` (toBeCloseTo, 10).
  - `it('keeps the pivot within panLimit, sliding along the limit')`: with `panLimit = 10`,
    `shiftPivot([8,0,0])` then `shiftPivot([8,6,0])` gives `|panOffset|` = 10 and a positive y
    component (the move was not dropped).
  - `it('clearPan puts the pivot back on target')`.
  - `it('screenAxes are orthonormal and match the view')`: `right·up` ≈ 0, both of length 1,
    and `right` is perpendicular to (pivot − eye).
- [ ] **Step 2: Run** `npx vitest run test/orbitCamera.test.ts` → the new tests FAIL (`shiftPivot` is not a function).
- [ ] **Step 3: Implement** the members above in `orbitCamera.ts`.
- [ ] **Step 4: Run** `npx vitest run test/orbitCamera.test.ts` → PASS, and the old tests still pass.
- [ ] **Step 5: Commit** `Orbit camera: a pan offset on top of the target, within a limit`.

### Task 2: Pan by pixels, zoom toward a point on screen

**Files:**
- Create: `packages/app/src/camera/input/orbitPan.ts`
- Test: `packages/app/test/orbitPan.test.ts`

**Interfaces:**
- Consumes: Task 1 (`pivot`, `shiftPivot`, `screenAxes`, `radius`, `zoomBy`).
- Produces:
  - `export interface ScreenFrame { heightPx: number; aspect: number; lensShiftNdc: number }`
  - `panByPixels(camera: OrbitCamera, dxPx: number, dyPx: number, screen: ScreenFrame): void`
    → the scene moves with the pointer: the pivot moves by
    `−right·dx·k + up·dy·k`, where `k = 2·radius·tan(VERTICAL_FOV_RADIANS/2) / heightPx`.
  - `zoomToward(camera: OrbitCamera, factor: number, ndc: [number, number] | null, screen: ScreenFrame): void`
    → `zoomBy(factor)`. Then, with `applied = newRadius / oldRadius` and the point
    `P = pivot + right·ndc[0]·tanHalf·aspect·oldRadius + up·(ndc[1] − lensShiftNdc)·tanHalf·oldRadius`,
    the pivot is moved so that `pivot' = P + (pivot − P)·applied` (via `shiftPivot`).
    `ndc = null` zooms toward the middle (no shift).
  - `clientToNdc(x: number, y: number, rect: { left: number; top: number; width: number; height: number }): [number, number]`

- [ ] **Step 1: Write the failing tests:**
  - `it('pans so the scene follows the pointer')`: dragging +100 px right moves the pivot by
    `−right · 100·k`; +100 px down moves it by `+up · 100·k`.
  - `it('keeps the point under the pointer fixed while zooming')`: project `P` to screen before
    and after `zoomToward(camera, 0.5, [0.4, -0.3], screen)` with `viewpoint.ts`'s projection.
    The NDC coordinates are equal to 1e-6.
  - `it('does not move the pivot when the radius is already at its floor')`: `radius = minRadius`;
    `zoomToward(…, 0.5, [0.9, 0.9], …)` leaves `pivot()` unchanged.
  - `it('zooms toward the middle when there is no pointer')`: `ndc = null` leaves the pivot unchanged.
- [ ] **Step 2: Run** `npx vitest run test/orbitPan.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `orbitPan.ts`. Use `VERTICAL_FOV_RADIANS` from `../viewpoint`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Orbit camera: pan by pixels and zoom toward the pointer`.

### Task 3: Telling a mouse wheel from a trackpad

**Files:**
- Create: `packages/app/src/camera/input/wheelKind.ts`
- Test: `packages/app/test/wheelKind.test.ts`

**Interfaces:**
- Produces:
  - `export type WheelAction = 'pinch' | 'zoom' | 'pan'`
  - `export class WheelClassifier { classify(event: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean; timeStamp: number }): WheelAction }`

**Rule:**
- `ctrlKey` → `'pinch'`.
- A gesture is a run of wheel events less than `GESTURE_GAP_MS = 150` apart. Its first event
  decides for the whole run:
  - `'pan'` (trackpad) if `deltaMode === 0` and (`deltaX !== 0`, or `deltaY` is not an
    integer, or `|deltaY| < TRACKPAD_MAX_FIRST_DELTA = 20`);
  - otherwise `'zoom'` (mouse wheel).
- Within a `'pan'` run, an event with `deltaX !== 0` or a fractional delta stays `'pan'`.

- [ ] **Step 1: Write the failing tests:**
  - `'pinch'` for `ctrlKey`.
  - A notch `{deltaY: 100, deltaMode: 0}` → `'zoom'`; `{deltaY: 3, deltaMode: 1}` → `'zoom'`.
  - A trackpad start `{deltaY: 2.5}` → `'pan'`; `{deltaX: 4, deltaY: 0}` → `'pan'`;
    `{deltaY: 6}` (small integer) → `'pan'`.
  - A run: a trackpad start followed 16 ms later by `{deltaY: 60}` stays `'pan'`.
  - After a 200 ms gap, `{deltaY: 100}` → `'zoom'`.
- [ ] **Step 2: Run** `npx vitest run test/wheelKind.test.ts` → FAIL.
- [ ] **Step 3: Implement** `WheelClassifier`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Camera input: tell a mouse wheel from a trackpad`.

### Task 4: Pointer gestures – pan with right or Shift drag, two fingers pan and pinch

**Files:**
- Modify: `packages/app/src/camera/input/pointerGestures.ts`
- Create: `packages/app/src/camera/input/twoFingers.ts` (pure)
- Test: `packages/app/test/twoFingers.test.ts`

**Interfaces:**
- Produces in `GestureHandlers`:
  - `pan(deltaX: number, deltaY: number): void` (CSS px; the scene follows)
  - `pinch(factor: number, centerX: number, centerY: number): void` (client coordinates of the
    fingers' midpoint)
- Produces in `twoFingers.ts`:
  - `twoFingerMove(before: [Point, Point], after: [Point, Point]): { pan: [number, number]; factor: number; center: Point }`
    with `type Point = { x: number; y: number }`: `pan` is the midpoint's move, `factor` is the
    spread ratio (1 if the spread before was 0), `center` is the midpoint after.
- Behaviour:
  - A mouse or pen press with `button === 2` or `shiftKey` drags as `pan`; any other press drags
    as before.
  - The canvas suppresses `contextmenu`.
  - With two touches, each move calls `pan` and `pinch` from `twoFingerMove`.

- [ ] **Step 1: Write the failing tests** for `twoFingerMove`:
  - Both fingers moved by (+10, −4): `pan` is `[10, −4]` and `factor` is 1.
  - Fingers moved apart from 100 to 150 px about a fixed midpoint: `pan` is `[0, 0]`, `factor`
    is 1.5, and `center` is that midpoint.
  - Both at once: `pan` and `factor` are both set.
- [ ] **Step 2: Run** `npx vitest run test/twoFingers.test.ts` → FAIL.
- [ ] **Step 3: Implement** `twoFingers.ts` and use it in `PointerGestures.onMove`. Track the
  press's mode (`'turn' | 'pan'`) per pointer in `TrackedPointer`.
- [ ] **Step 4: Run** `npx vitest run` → all PASS. `npm run typecheck` fails until Task 5 wires
  the new handlers; that is expected here, and the commit waits for Task 5.

### Task 5: Input controller – routing, eased zoom toward the pointer, keys, hint text

**Files:**
- Modify: `packages/app/src/camera/inputController.ts`, `packages/app/src/camera/input/orbitMotion.ts`,
  `packages/app/src/camera/input/flightInput.ts`, `packages/app/src/camera/cameraDirector.ts`,
  `packages/app/src/app/explorer.ts`, `packages/app/src/i18n/messages/{en,de}/ui.ts`
- Test: `packages/app/test/flightControls.test.ts` (orbit keys), `packages/app/test/orbitMotion.test.ts` (create)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `OrbitMotion.zoom(logFactor: number, anchorNdc?: [number, number] | null)` keeps the last
    anchor with the pending zoom.
  - `OrbitMotion.update(dt)` applies each eased share through `zoomToward` with that anchor.
    The anchor is cleared once the pending zoom has run out.
  - `OrbitMotion` takes `screen: () => ScreenFrame` in its constructor.
  - `CameraInputController` options gain `lensShiftNdc?: () => number` (default `() => 0`).
  - `CameraDirector.setLensShiftSource(source: () => number): void`, wired in `explorer.ts`
    to `() => lens.lensShiftNdc`.
  - `keyboardOrbitTurn` uses: turn = arrows only; zoom = `KeyW`/`Equal`/`NumpadAdd` (in) and
    `KeyS`/`Minus`/`NumpadSubtract` (out).
- Routing in orbit mode:
  - Wheel: `'pinch'` → zoom toward the pointer (×5, as today); `'zoom'` → zoom toward the
    pointer; `'pan'` → `panByPixels(−deltaX, −deltaY)`. The old "trackpad scroll turns the view"
    branch goes.
  - Gesture `pan` → `panByPixels`.
  - `pinch(factor, cx, cy)` → zoom toward `(cx, cy)`.
- Fly mode is unchanged.
- New hint texts:
  - de `orbitPointer`: `'Ziehen dreht · Zwei Finger, Rechts- oder Shift-Ziehen verschiebt · Scrollen oder Pinch zoomt zum Zeiger · Pfeile drehen, W/S zoomen · Doppelklick auf einen Körper fliegt hin'`
  - de `orbitTouch`: `'Ziehen dreht · Zwei Finger verschieben und zoomen · Doppeltippen auf einen Körper fliegt hin'`
  - en, likewise: `'Drag to turn · Two fingers, right- or Shift-drag to move · Scroll or pinch zooms toward the pointer · Arrows turn, W/S zoom · Double-click a body to fly there'`
    and `'Drag to turn · Two fingers move and zoom · Double-tap a body to fly there'`.

- [ ] **Step 1: Write the failing tests:**
  - `flightControls.test.ts`: in orbit, `KeyW` gives zoom −1 (in) and `KeyA` gives turn `[0, 0]`.
  - `orbitMotion.test.ts`: `it('eases a zoom toward its anchor')`. After `zoom(−0.7, [0.5, 0])`
    and `update` for 1 s in 16 ms steps, the radius is ≈ e^−0.7 of before, and the pivot moved
    toward +right.
- [ ] **Step 2: Run** `npx vitest run test/flightControls.test.ts test/orbitMotion.test.ts` → FAIL.
- [ ] **Step 3: Implement** the routing, eased anchored zoom, keys, lens shift source and texts. Under `prefers-reduced-motion`, `ZOOM_SECONDS` becomes 0.04 (spec: zoom eases shortened).
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test` from the repo root → all green.
- [ ] **Step 5: Commit** `Camera input: two fingers move the pivot, scroll and pinch zoom toward the pointer` (includes Task 4).

### Task 6: Explore – the offset follows the body, survives lessons, scales with the scene

**Files:**
- Modify: `packages/app/src/camera/cameraFollow.ts`, `packages/app/src/camera/cameraDirector.ts`
- Test: `packages/app/test/cameraFollow.test.ts`, `packages/app/test/cameraDirectorSnapshot.test.ts` (create, if `CameraDirector` can be built without a DOM; otherwise put the snapshot test on a pure `snapshotOf(orbit)`/`restoreSnapshot(orbit, s)` pair moved into `orbitCamera.ts`)

**Interfaces:**
- `CameraSnapshot` gains `panOffset: vec3` and `panLimit: number`.
- `takeOverForLesson()` snapshots them, then calls `orbit.clearPan()`.
- `restoreAfterLesson()` restores them.
- `CameraFollowController.selectEntity` → `clearPan()`, and sets
  `panLimit = EXPLORE_PAN_LIMIT_FRAMINGS (3) × framing radius`.
- `stopFollowing` → `panLimit = DEFAULT_PAN_LIMIT`, keeping the offset.
- `track()` scales `panOffset` by the same `framingRadius / lastFramingRadius` ratio as `radius`.
- The switch to free flight (`cameraDirector.ts:68`) looks at `orbit.pivot()`, not `orbit.target`.

- [ ] **Step 1: Write the failing tests:**
  - `cameraFollow.test.ts`:
    - selecting an entity clears a pan offset and sets the limit to 3× its framing radius;
    - with a pan offset of `[2,0,0]`, a scale change that doubles the framing radius doubles the
      offset.
  - Snapshot: an offset of `[1,2,3]` before `takeOverForLesson` is zero during the lesson and
    `[1,2,3]` after `restoreAfterLesson`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `Explore: the moved pivot stays with the followed body, and comes back after a lesson`.

### Task 7: Lessons – look all around models, wider elsewhere, pan within the shot

**Files:**
- Modify: `packages/app/src/learn/lessonShot.ts`, `packages/app/src/learn/lessonCamera.ts`,
  `packages/app/src/learn/voyager/voyagerShots.ts`
- Test: `packages/app/test/lessonCamera.test.ts` (create; `LessonCamera` takes an `OrbitCamera`,
  a `CameraLens` and a canvas – pass `{ width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 }`
  cast to `HTMLCanvasElement` if it reads nothing else; otherwise test `lookAroundLimits(...)` as a
  pure function extracted for this)

**Interfaces:**
- `LessonShot` gains `freeLook?: boolean`.
- In `voyagerShots.ts`, `PROBE_SHOT`, `EXPLODED_SHOT` (spreads `PROBE_SHOT`) and `RECORD_SHOT`
  set `freeLook: true`.
- `LOOK_AROUND_RADIANS` becomes `Math.PI / 2`.
- `allowLookingAround(sceneFloor, bounds, freeLook)`:
  - `freeLook` → `viewLimits = null`, and the zoom-in floor is `sceneFloor` alone;
  - otherwise as today, with the new angle.
  - In both cases `panLimit = max(bounds.halfWidth, bounds.top, −bounds.bottom)`.
- `frame()` passes its `CONTENT_BOUNDS` entry (or the focus bounds for `sizes`) and
  `freeLook = false`; `frameShot()` passes `shot.bounds` and `shot.freeLook ?? false`.
- `applyPreset()` and `showView()` call `orbit.clearPan()`.
- `currentView()` records `orbit.pivot()` as its `target`, so a glide starts where the user
  was looking.
- `release()` restores the pan limit from before the lesson (kept like `freeMaxRadius`).

- [ ] **Step 1: Write the failing tests:**
  - A `freeLook` shot leaves `viewLimits` null and `minRadius` at the shot's zoom floor.
  - A shot without it sets limits of ±π/2 around its azimuth.
  - Framing a shot clears a pan offset and sets `panLimit` from its bounds (e.g. `PROBE_SHOT` → 9.5).
  - After a pan, `frameShot(shot, true)` starts the glide at the panned pivot.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test` → green.
- [ ] **Step 5: Look at it in the preview** (http://localhost:5199/, Chrome). Turn every
  non-model lesson's scenes 90° (seasons, Moon phases, solar eclipse, planet sizes, Voyager
  route). If a staged scene shows its edges or empty backstage, give that lesson's frame a
  smaller limit (a `lookAroundRadians` on its preset or shot) and note which one in the commit.
- [ ] **Step 6: Commit** `Lessons: look all around the Voyager and its record, further around the rest, and move within the shot`.

### Task 8: End-to-end check and hand-over

**Files:**
- Modify: e2e specs that relied on trackpad scroll turning the view, or on R/F zoom (none found
  by grep; re-check `e2e/`).
- Test: `packages/app/e2e/orbitPivot.spec.ts` (create)

- [ ] **Step 1: Write** `orbitPivot.spec.ts`, with `?tour=off`:
  - a `page.mouse.wheel(0, 100)` changes the camera's distance;
  - a right-drag of 200 px moves the scene. Read the state through `data-*` attributes on
    `#scene` if the app exposes them. If not, add `data-orbit-radius` and `data-pivot`, written
    by the frame loop next to `data-rendered`.
- [ ] **Step 2: Run** `npx playwright test e2e/orbitPivot.spec.ts e2e/learnMode.spec.ts e2e/freeFlight.spec.ts`.
  Compare the failures with the same run on `main`: local headless WebGPU is unreliable, so only
  new failures count.
- [ ] **Step 3: Hand the preview to the user** with a short list of what to try: on a trackpad
  (two fingers, pinch), with a mouse (wheel, right-drag), at the Voyager's antenna tip. Tune
  `TRACKPAD_MAX_FIRST_DELTA` and `GESTURE_GAP_MS` from their feedback.
- [ ] **Step 4: Commit** `E2E: the orbit pivot moves and zooms toward the pointer`.
