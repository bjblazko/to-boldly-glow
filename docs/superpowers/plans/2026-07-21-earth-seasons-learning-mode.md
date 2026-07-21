# Earth Seasons Visualization + Learning Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a general explore/learn mode switch to "To Boldly Glow," and a fully-specified pilot lesson — "Why does Earth have seasons" — that teaches axial-tilt seasons via a locked-camera, chapter-based, scrub-through-real-dates experience with animated dashed overlay geometry (equator, axis, sun-angle ray, latitude marker).

**Architecture:** A new `appMode` ('explore' | 'learn') state gates a corner "Learn"/"Exit" control and hides the free-roam dock's Camera/Time panels while relocating Display to the corner. A `LessonPlayer` holds chapter/scrub/latitude state for the one seasons lesson (5 chapters, each mapping a chapter-local scrub position to a real calendar date that drives Earth's existing VSOP87 position/rotation pipeline). Camera framing per chapter reuses `CameraFollowController`'s tween machinery via a new entity-independent `flyToFraming` method. New globe overlay line geometry is drawn through the *existing* line-rendering pipeline (used today for orbit paths), extended with a per-vertex arc-length attribute and a dash-pattern/animated-offset uniform so overlays can be dashed and orbit paths stay solid.

**Tech Stack:** TypeScript, Vite, gl-matrix, hand-rolled WebGPU (WGSL), Vitest, Playwright — no new dependencies.

## Global Constraints

- This project has no WGSL unit-test framework — "the test" for shader/rendering-integration changes means: `npm run typecheck`, `npm run build`, the existing Vitest suite for pure TypeScript functions, a Playwright e2e smoke test (assert zero `pageerror`s — WebGPU validation errors surface as catchable page errors via the existing `uncapturederror` listener in `renderer/webgpu.ts`), and a manual visual check in a running browser.
- Every uniform-buffer size change must be driven by a single named constant (e.g. `LIT_UNIFORM_FLOAT_COUNT`, and this plan's new `LINE_UNIFORM_FLOAT_COUNT`) — never a bare literal at any allocation or write call site. A mismatch here is silently-wrong rendering, not a compile error.
- Lessons are authored as plain TypeScript data (mirrors `bodies.ts`/`moons.ts`), not a generalized authoring UI/tooling.
- Free camera movement, entity search, and the Realistic/Compact scale toggle are all inaccessible while in learn mode (the Camera and Time dock panels — the only place the scale toggle lives — are hidden). Camera framing is locked per chapter.
- Latitude selection is named presets only (no free slider, no click-to-place).
- Run `cd packages/app && npx playwright test --workers=1` for the full e2e suite — NOT the root `npm run test:e2e -- --workers=1`, which does not forward `--workers=1` into the workspace's Playwright invocation (a repo-specific quirk, confirmed across this project's history).
- Never commit until a task's own verification steps pass.

---

### Task 1: App-mode shell — corner Learn/Exit control, relocated Display toggle, locked free camera

**Files:**
- Modify: `packages/app/index.html`
- Modify: `packages/app/src/hud/hud.css`
- Modify: `packages/app/src/hud/dockUI.ts`
- Modify: `packages/app/src/camera/inputController.ts`
- Create: `packages/app/src/learn/learnModeController.ts`
- Test: `packages/app/e2e/learnMode.spec.ts`
- Modify: `packages/app/src/main.ts`

**Interfaces:**
- Consumes: `DockUI` (existing, `packages/app/src/hud/dockUI.ts`), `CameraInputController` (existing, `packages/app/src/camera/inputController.ts`).
- Produces: `LearnModeController` class with `enter(): void`, `exit(): void`, `get currentMode(): 'explore' | 'learn'` — later tasks call `enter()`/`exit()` and read `currentMode`. `document.body.dataset.appMode` (`'explore' | 'learn'`) and `document.body.dataset.lessonId` (set/cleared alongside mode) are the DOM-visible state e2e tests and later tasks assert against. `DockUI.closeActivePanel(): void` (new public method).

- [ ] **Step 1: Add the corner controls and lesson-picker markup to `index.html`**

Add this block immediately after the closing `</nav>` of the existing `.hud-dock` (i.e. right before `<script type="module" src="/src/main.ts"></script>`):

```html
    <div class="hud-corner-controls">
      <button id="display-corner-btn" class="hud-corner-btn hud-dock-btn" data-panel="display" type="button" aria-label="Display options">
        <svg class="icon" aria-hidden="true"><use href="#icon-layers"></use></svg>
      </button>
      <button id="learn-mode-btn" class="hud-corner-btn hud-corner-btn-learn" type="button">
        <svg class="icon" aria-hidden="true"><use href="#icon-book"></use></svg>
        <span id="learn-mode-btn-label">Learn</span>
      </button>
    </div>

    <div id="lesson-picker" class="hud-lesson-picker" hidden>
      <button class="hud-lesson-picker-item" data-lesson-id="seasons" type="button">
        Why does Earth have seasons?
      </button>
    </div>

    <div id="lesson-panel" class="hud-lesson-panel" hidden></div>
```

Move the existing Display dock button OUT of `.hud-dock` (delete these lines from inside `<nav class="hud-dock" aria-label="Controls">`):

```html
      <button class="hud-dock-btn" data-panel="display" type="button">
        <svg class="icon" aria-hidden="true"><use href="#icon-layers"></use></svg>
        <span class="hud-dock-label">Display</span>
      </button>
```

(It's replaced by the `#display-corner-btn` button added above — same `hud-dock-btn` class and `data-panel="display"` attribute, so `DockUI`'s existing `querySelectorAll('.hud-dock-btn')` wiring picks it up unchanged regardless of which container it lives in.)

Add a new icon symbol to the existing `<svg class="icon-sprite">` block (anywhere among the other `<symbol>` entries):

```html
      <symbol id="icon-book" viewBox="0 0 24 24">
        <path d="M4 5.5c0-1 .8-1.5 2-1.5h5.5v15H6c-1.2 0-2 .5-2 1.5v-15Z" />
        <path d="M20 5.5c0-1-.8-1.5-2-1.5h-5.5v15H18c1.2 0 2 .5 2 1.5v-15Z" />
      </symbol>
```

- [ ] **Step 2: Add corner-control, lesson-picker, and app-mode CSS**

Add to `packages/app/src/hud/hud.css`, after the existing `--hud-accent-display` custom property declaration inside `:root`:

```css
  --hud-accent-learn: #c98af0;
  --hud-accent-learn-tint: rgba(201, 138, 240, 0.16);
```

Add a new section at the end of the file (after the existing `@media (max-width: 480px)` block):

```css
/* -------------------- app mode: learn -------------------- */
.hud-corner-controls {
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 8px;
  z-index: 2;
}
.hud-corner-btn {
  min-width: 0;
  padding: 9px 14px;
}
.hud-corner-btn-learn {
  flex-direction: row;
  background: var(--hud-accent-learn-tint);
  color: #e6c9fb;
  border-radius: 999px;
}
.hud-corner-btn-learn:hover {
  background: rgba(201, 138, 240, 0.26);
}

.hud-lesson-picker {
  position: fixed;
  top: 60px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--hud-panel);
  backdrop-filter: blur(10px);
  border: 1px solid var(--hud-panel-border);
  border-radius: 14px;
  padding: 8px;
  box-shadow: 0 20px 44px -18px rgba(0, 0, 0, 0.65);
  z-index: 2;
  font-family: -apple-system, 'Segoe UI', Roboto, ui-sans-serif, system-ui, sans-serif;
}
.hud-lesson-picker[hidden] {
  display: none;
}
.hud-lesson-picker-item {
  appearance: none;
  border: none;
  cursor: pointer;
  background: transparent;
  color: var(--hud-text);
  text-align: left;
  font: inherit;
  font-size: 13px;
  padding: 9px 12px;
  border-radius: 10px;
  white-space: nowrap;
}
.hud-lesson-picker-item:hover {
  background: var(--hud-accent-learn-tint);
}

.hud-lesson-panel {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  width: min(560px, calc(100vw - 32px));
  background: var(--hud-panel);
  backdrop-filter: blur(10px);
  border: 1px solid var(--hud-panel-border);
  border-radius: 20px;
  padding: 14px 18px;
  box-shadow: 0 16px 32px -16px rgba(0, 0, 0, 0.65);
  z-index: 2;
  font-family: -apple-system, 'Segoe UI', Roboto, ui-sans-serif, system-ui, sans-serif;
  color: var(--hud-text);
}
.hud-lesson-panel[hidden] {
  display: none;
}

/* The free-roam dock/sheet are fully replaced by the lesson panel while in learn mode - Camera and
   Time make no sense here (no free camera, no live simulation clock control), and Display has
   already been relocated to the always-visible corner cluster above. */
body[data-app-mode='learn'] .hud-dock,
body[data-app-mode='learn'] .hud-sheet {
  display: none;
}
body[data-app-mode='learn'] #learn-mode-btn-label::before {
  content: 'Exit ';
}
```

- [ ] **Step 3: Give `DockUI` a public `closeActivePanel` method**

Modify `packages/app/src/hud/dockUI.ts`:

```typescript
type PanelName = 'camera' | 'time' | 'display'

// Wires the bottom dock's buttons to the sheet above it — only one panel open at a time; clicking
// the already-active dock button closes the sheet instead of re-opening the same panel.
export class DockUI {
  private activePanel: PanelName | null = null

  constructor(
    private readonly dockButtons: NodeListOf<HTMLButtonElement>,
    private readonly sheet: HTMLElement,
    private readonly sheetPanels: NodeListOf<HTMLElement>,
  ) {
    this.dockButtons.forEach((button) => {
      button.addEventListener('click', () => this.togglePanel(button.dataset.panel as PanelName))
    })
  }

  // Closes whichever panel is currently open, if any — used when entering learn mode, so a sheet
  // left open from free-roam use (e.g. the Display panel) doesn't linger open behind the lesson
  // panel that now occupies the same screen position.
  closeActivePanel(): void {
    if (this.activePanel === null) return
    this.togglePanel(this.activePanel)
  }

  private togglePanel(panel: PanelName): void {
    const opening = this.activePanel !== panel
    this.activePanel = opening ? panel : null

    this.dockButtons.forEach((button) => {
      button.classList.toggle('is-active', opening && button.dataset.panel === panel)
    })
    this.sheetPanels.forEach((section) => {
      section.classList.toggle('is-active', opening && section.dataset.panel === panel)
    })
    this.sheet.classList.toggle('is-open', opening)
  }
}
```

(Only the doc comment and the new `closeActivePanel` method are added; `togglePanel` itself is unchanged — `closeActivePanel` reuses it exactly as clicking the already-active dock button would.)

- [ ] **Step 4: Add an enable/disable switch to `CameraInputController`**

Modify `packages/app/src/camera/inputController.ts` — add an `enabled` flag and a public setter, and guard every input handler on it:

```typescript
export class CameraInputController {
  mode: CameraMode = 'orbit'

  private isDragging = false
  private lastPointerX = 0
  private lastPointerY = 0
  private pressedKeys = new Set<string>()
  private enabled = true

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly orbitCamera: OrbitCamera,
    private readonly flyCamera: FlyCamera,
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  setMode(mode: CameraMode): void {
    this.mode = mode
  }

  // Learn mode locks the camera to each chapter's authored framing — free drag/zoom/fly-keys must
  // stop responding to input entirely while it's active, not just visually (a lingering drag could
  // still fight the chapter's tween otherwise). Re-enabling on exit restores exactly the previous
  // interactive behavior; no camera state is touched here.
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.isDragging = false
  }

  getViewMatrix() {
    return this.mode === 'orbit' ? this.orbitCamera.getViewMatrix() : this.flyCamera.getViewMatrix()
  }

  update(deltaSeconds: number): void {
    if (!this.enabled || this.mode !== 'fly') return
    const distance = MOVE_SPEED * deltaSeconds
    if (this.pressedKeys.has('KeyW')) this.flyCamera.moveForward(distance)
    if (this.pressedKeys.has('KeyS')) this.flyCamera.moveForward(-distance)
    if (this.pressedKeys.has('KeyD')) this.flyCamera.moveRight(distance)
    if (this.pressedKeys.has('KeyA')) this.flyCamera.moveRight(-distance)
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.enabled) return
    this.isDragging = true
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.canvas.setPointerCapture(event.pointerId)
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.enabled || !this.isDragging) return
    const deltaX = event.clientX - this.lastPointerX
    const deltaY = event.clientY - this.lastPointerY
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY

    if (this.mode === 'orbit') {
      this.orbitCamera.applyDrag(deltaX, deltaY)
    } else {
      this.flyCamera.applyLook(deltaX, deltaY)
    }
  }

  private onPointerUp = (event: PointerEvent) => {
    this.isDragging = false
    this.canvas.releasePointerCapture(event.pointerId)
  }

  private onWheel = (event: WheelEvent) => {
    if (!this.enabled || this.mode !== 'orbit') return
    event.preventDefault()
    this.orbitCamera.applyZoom(event.deltaY)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled) return
    this.pressedKeys.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code)
  }
}
```

(Read the actual current file first — `onWheel`'s body beyond the mode guard and `onKeyDown`/`onKeyUp` are shown here from the file structure already inspected during planning; preserve whatever their exact existing bodies are beyond adding the `this.enabled` guards shown.)

- [ ] **Step 5: Create `LearnModeController`**

Create `packages/app/src/learn/learnModeController.ts`:

```typescript
import type { CameraInputController } from '../camera/inputController'
import type { DockUI } from '../hud/dockUI'

export type AppMode = 'explore' | 'learn'

// Owns the top-level explore/learn mode switch: hides/relocates free-roam HUD via a
// `data-app-mode` attribute (see hud.css's `body[data-app-mode='learn']` rules), locks out free
// camera input, and closes any dock panel left open from free-roam use. Deliberately holds no
// lesson-specific state (current chapter, scrub position, latitude) — that's LessonPlayer's job
// (see learn/lessonPlayer.ts) — so this class stays a pure mode switch, reusable unchanged if a
// future lesson picker ever offers more than one lesson.
export class LearnModeController {
  private mode: AppMode = 'explore'

  constructor(
    private readonly body: HTMLElement,
    private readonly cameraInput: CameraInputController,
    private readonly dockUI: DockUI,
  ) {}

  get currentMode(): AppMode {
    return this.mode
  }

  enter(lessonId: string): void {
    this.mode = 'learn'
    this.body.dataset.appMode = 'learn'
    this.body.dataset.lessonId = lessonId
    this.cameraInput.setEnabled(false)
    this.dockUI.closeActivePanel()
  }

  exit(): void {
    this.mode = 'explore'
    this.body.dataset.appMode = 'explore'
    delete this.body.dataset.lessonId
    this.cameraInput.setEnabled(true)
  }
}
```

- [ ] **Step 6: Wire the corner controls and lesson picker into `main.ts`**

Add the import near the other top-of-file imports in `packages/app/src/main.ts`:

```typescript
import { LearnModeController } from './learn/learnModeController'
```

Add this block in `main()`, immediately after the existing `new DockUI(...)` / `initShuttleVisual(...)` lines (which are right after `simulationClock`/`timeControlUI` setup):

```typescript
  const dockUI = new DockUI(
    document.querySelectorAll<HTMLButtonElement>('.hud-dock-btn'),
    requireElement<HTMLElement>('#hud-sheet'),
    document.querySelectorAll<HTMLElement>('.hud-sheet-panel'),
  )
```

(This replaces the existing unassigned `new DockUI(...)` call — capture it in a `dockUI` local so `LearnModeController` can use it.)

Then, further down (after `cameraInput` is constructed, since `LearnModeController` needs it), add:

```typescript
  const learnModeController = new LearnModeController(document.body, cameraInput, dockUI)
  const learnModeBtn = requireElement<HTMLButtonElement>('#learn-mode-btn')
  const lessonPicker = requireElement<HTMLElement>('#lesson-picker')
  learnModeBtn.addEventListener('click', () => {
    if (learnModeController.currentMode === 'learn') {
      learnModeController.exit()
      lessonPicker.hidden = true
      return
    }
    lessonPicker.hidden = !lessonPicker.hidden
  })
  lessonPicker.querySelectorAll<HTMLButtonElement>('.hud-lesson-picker-item').forEach((item) => {
    item.addEventListener('click', () => {
      const lessonId = item.dataset.lessonId
      if (!lessonId) return
      lessonPicker.hidden = true
      learnModeController.enter(lessonId)
    })
  })
```

This task deliberately does NOT wire up the `#lesson-panel` element's content, camera framing, or overlays yet — entering learn mode at this point only flips `data-app-mode`/`data-lesson-id`, hides the dock/sheet, disables free camera input, and shows an (empty) `#lesson-panel` placeholder. Add one line to make that placeholder itself visible/hidden with the mode, right after the `learnModeBtn` click handler above:

```typescript
  const lessonPanel = requireElement<HTMLElement>('#lesson-panel')
  learnModeBtn.addEventListener('click', () => {
    lessonPanel.hidden = learnModeController.currentMode !== 'learn'
  })
```

(This second listener runs after the first; since `addEventListener` calls fire in registration order and the first listener has already flipped `currentMode` by the time this one reads it, `lessonPanel.hidden` ends up correct. Simpler alternative — fold both bodies into the single existing listener from above instead of registering twice; either is fine, but do not leave two competing listeners that both try to own `lessonPicker.hidden`.)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Write the e2e smoke test**

Create `packages/app/e2e/learnMode.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

test('entering and exiting learn mode toggles app-mode state and hides/restores the free-roam dock', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()

  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'seasons')
  await expect(page.locator('.hud-dock')).toBeHidden()
  await expect(page.locator('#display-corner-btn')).toBeVisible()

  await page.locator('#learn-mode-btn').click()

  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  expect(errors).toEqual([])
})
```

- [ ] **Step 9: Run the new e2e test**

Run: `cd packages/app && npx playwright test e2e/learnMode.spec.ts`
Expected: PASS.

- [ ] **Step 10: Run the full test suite**

Run: `npm run typecheck && npm run build && npm run test`
Expected: all succeed.

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all PASS (per this plan's Global Constraints — not the root `npm run test:e2e` script).

- [ ] **Step 11: Manual visual check**

Run: `cd packages/app && npm run dev`. Click "Learn" (top-right) → click the "Why does Earth have seasons?" item. Confirm: the bottom dock disappears, a "Display" button and an "Exit Learn" button remain top-right, dragging the canvas no longer orbits the camera, and clicking "Exit Learn" restores the dock and re-enables dragging. Confirm Display's toggle panel still opens/closes correctly in both modes.

- [ ] **Step 12: Commit**

```bash
git add packages/app/index.html packages/app/src/hud/hud.css packages/app/src/hud/dockUI.ts \
  packages/app/src/camera/inputController.ts packages/app/src/learn/learnModeController.ts \
  packages/app/e2e/learnMode.spec.ts packages/app/src/main.ts
git commit -m "Add the explore/learn app-mode switch (shell only, no lesson content yet)

A new corner Learn/Exit control hides the free-roam dock's Camera/Time
panels and relocates Display to an always-visible corner cluster while
in learn mode, and disables free camera drag/zoom/fly input. No
lesson content is wired up yet - this is the mode-switch shell the
seasons lesson plugs into in later tasks."
```

---

### Task 2: Lesson data types + scrub-to-date pure math

**Files:**
- Create: `packages/app/src/learn/lessonTypes.ts`
- Test: `packages/app/test/lessonTypes.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `LatitudePreset`, `ChapterCameraFraming`, `Chapter`, `Lesson` interfaces; `dateAtScrubPosition(dateRange: readonly [Date, Date], scrubT: number): Date` — Task 3 (lesson data) and Task 4 (scrub UI) both import these.

- [ ] **Step 1: Write the failing tests**

Create `packages/app/test/lessonTypes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { dateAtScrubPosition } from '../src/learn/lessonTypes'

describe('dateAtScrubPosition', () => {
  const range: [Date, Date] = [new Date('2026-06-14T00:00:00Z'), new Date('2026-06-28T00:00:00Z')]

  it('returns the range start at scrubT=0', () => {
    expect(dateAtScrubPosition(range, 0).toISOString()).toBe('2026-06-14T00:00:00.000Z')
  })

  it('returns the range end at scrubT=1', () => {
    expect(dateAtScrubPosition(range, 1).toISOString()).toBe('2026-06-28T00:00:00.000Z')
  })

  it('interpolates linearly at scrubT=0.5', () => {
    expect(dateAtScrubPosition(range, 0.5).toISOString()).toBe('2026-06-21T00:00:00.000Z')
  })

  it('clamps scrubT below 0 to the range start', () => {
    expect(dateAtScrubPosition(range, -0.5).toISOString()).toBe('2026-06-14T00:00:00.000Z')
  })

  it('clamps scrubT above 1 to the range end', () => {
    expect(dateAtScrubPosition(range, 1.5).toISOString()).toBe('2026-06-28T00:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/app && npx vitest run test/lessonTypes.test.ts`
Expected: FAIL — `Cannot find module '../src/learn/lessonTypes'`.

- [ ] **Step 3: Implement `lessonTypes.ts`**

Create `packages/app/src/learn/lessonTypes.ts`:

```typescript
// A named latitude the lesson can frame — e.g. the Arctic Circle. `text`, if present, overrides
// the chapter's own generic text() for this specific latitude (e.g. "the sun never sets here in
// June"); chapters fall back to their own text() when a preset has none.
export interface LatitudePreset {
  id: string
  label: string
  latitudeDegrees: number
  text?: (scrubT: number) => string
}

// The camera framing a chapter is entered with. `date` is used ONLY to compute the framing
// target (Earth's real world position on that date) - it is independent of the chapter's own
// `dateRange` scrub window, and is deliberately re-derived at runtime (via entityWorldPosition,
// see learn/lessonPlayer.ts) rather than baked into a literal scene-unit position. A literal
// [x, y, z] target or a literal scene-unit radius would only be correct for whichever
// Realistic/Compact scale blend was active when the numbers were chosen; deriving both from
// Earth's own real position/radius at the current scale keeps the framing correct regardless of
// which scale the user had selected before entering the lesson (this refines the design spec's
// §8 data model, which sketched a literal target/radius pair before this constraint was worked
// through at plan time).
export interface ChapterCameraFraming {
  date: Date
  radiusMultiplier: number // multiples of Earth's own current scaled radius - mirrors
                            // cameraFollow.ts's FRAMING_RADIUS_MULTIPLIER pattern
  azimuth: number // radians
  elevation: number // radians
  upAxis: readonly [number, number, number]
}

export interface Chapter {
  id: string
  title: string
  dateRange: readonly [Date, Date] // real calendar dates the scrub bar interpolates across
  cameraFraming: ChapterCameraFraming
  text: (scrubT: number, latitude: LatitudePreset) => string
}

export interface Lesson {
  id: string
  title: string
  chapters: Chapter[]
  latitudePresets: LatitudePreset[]
}

// Maps a chapter-local scrub position (clamped to [0, 1]) to a real calendar date within the
// chapter's dateRange, linearly.
export function dateAtScrubPosition(dateRange: readonly [Date, Date], scrubT: number): Date {
  const clamped = Math.min(Math.max(scrubT, 0), 1)
  const startMs = dateRange[0].getTime()
  const endMs = dateRange[1].getTime()
  return new Date(startMs + (endMs - startMs) * clamped)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/app && npx vitest run test/lessonTypes.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/learn/lessonTypes.ts packages/app/test/lessonTypes.test.ts
git commit -m "Add Lesson/Chapter/LatitudePreset data types and scrub-to-date mapping

Camera framing is authored per-chapter as a date + radius multiplier +
azimuth/elevation/up-axis rather than a literal scene-unit position,
so it stays correct across the Realistic/Compact scale toggle instead
of being baked in for whichever scale was active when the numbers
were chosen."
```

---

### Task 3: Seasons lesson data + lesson picker (content only, still no camera/overlay wiring)

**Files:**
- Create: `packages/app/src/learn/lessons/seasons.ts`
- Test: `packages/app/test/seasonsLesson.test.ts`

**Interfaces:**
- Consumes: `Lesson`, `Chapter`, `LatitudePreset`, `ChapterCameraFraming` (Task 2, `../lessonTypes`), `ECLIPTIC_NORTH` (existing, `packages/app/src/solarSystem/poleOrientation.ts`).
- Produces: `SEASONS_LESSON: Lesson` — Task 4 (LessonPlayer) and Task 6 (text/latitude UI) both import this. A `LESSONS_BY_ID: Record<string, Lesson>` lookup map, keyed the same way as the lesson-picker's `data-lesson-id` attributes from Task 1 (`'seasons'`) — Task 4's `LessonPlayer` uses this to resolve the id `LearnModeController.enter()` receives into an actual `Lesson`.

- [ ] **Step 1: Write the failing tests**

Create `packages/app/test/seasonsLesson.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { LESSONS_BY_ID, SEASONS_LESSON } from '../src/learn/lessons/seasons'

describe('SEASONS_LESSON', () => {
  it('has exactly 5 chapters in chronological order', () => {
    expect(SEASONS_LESSON.chapters).toHaveLength(5)
    const ids = SEASONS_LESSON.chapters.map((c) => c.id)
    expect(ids).toEqual(['intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice'])
  })

  it('every non-intro chapter\'s defining date falls strictly inside its own dateRange', () => {
    for (const chapter of SEASONS_LESSON.chapters.filter((c) => c.id !== 'intro')) {
      const [start, end] = chapter.dateRange
      const definingDate = chapter.cameraFraming.date
      expect(definingDate.getTime()).toBeGreaterThan(start.getTime())
      expect(definingDate.getTime()).toBeLessThan(end.getTime())
    }
  })

  it('has at least 5 latitude presets including the Equator', () => {
    expect(SEASONS_LESSON.latitudePresets.length).toBeGreaterThanOrEqual(5)
    expect(SEASONS_LESSON.latitudePresets.some((p) => p.id === 'equator')).toBe(true)
  })

  it('every chapter\'s text() returns a non-empty string for the Equator preset at scrubT=0.5', () => {
    const equator = SEASONS_LESSON.latitudePresets.find((p) => p.id === 'equator')!
    for (const chapter of SEASONS_LESSON.chapters) {
      expect(chapter.text(0.5, equator).length).toBeGreaterThan(0)
    }
  })

  it('is registered in LESSONS_BY_ID under "seasons"', () => {
    expect(LESSONS_BY_ID['seasons']).toBe(SEASONS_LESSON)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/app && npx vitest run test/seasonsLesson.test.ts`
Expected: FAIL — `Cannot find module '../src/learn/lessons/seasons'`.

- [ ] **Step 3: Implement the seasons lesson data**

Create `packages/app/src/learn/lessons/seasons.ts`:

```typescript
import { ECLIPTIC_NORTH } from '../../solarSystem/poleOrientation'
import type { Chapter, LatitudePreset, Lesson } from '../lessonTypes'

// Approximate 2026 UTC equinox/solstice dates - real astronomical events, not tied to any
// particular precision requirement (this is a pedagogical animation, not an ephemeris tool; the
// solar-system-wide VSOP87 position math elsewhere in this app already handles precision where it
// matters). Each non-intro chapter's dateRange spans two weeks centered on its defining date, so
// scrubbing shows the axial-tilt effect ramping in/out rather than a single frozen instant.
const MARCH_EQUINOX_2026 = new Date('2026-03-20T00:00:00Z')
const JUNE_SOLSTICE_2026 = new Date('2026-06-21T00:00:00Z')
const SEPTEMBER_EQUINOX_2026 = new Date('2026-09-23T00:00:00Z')
const DECEMBER_SOLSTICE_2026 = new Date('2026-12-21T00:00:00Z')

function weekWindow(centerDate: Date): [Date, Date] {
  const weekMs = 7 * 24 * 60 * 60 * 1000
  return [new Date(centerDate.getTime() - weekMs), new Date(centerDate.getTime() + weekMs)]
}

export const LATITUDE_PRESETS: LatitudePreset[] = [
  { id: 'equator', label: 'Equator', latitudeDegrees: 0 },
  {
    id: 'tropic-of-cancer',
    label: 'Tropic of Cancer',
    latitudeDegrees: 23.4,
    text: () => 'At the Tropic of Cancer, the June solstice sun passes directly overhead at noon.',
  },
  {
    id: 'tropic-of-capricorn',
    label: 'Tropic of Capricorn',
    latitudeDegrees: -23.4,
    text: () => 'At the Tropic of Capricorn, the December solstice sun passes directly overhead at noon.',
  },
  {
    id: 'arctic-circle',
    label: 'Arctic Circle',
    latitudeDegrees: 66.6,
    text: () => 'At the Arctic Circle, the sun never fully sets around the June solstice, and never fully rises around the December solstice.',
  },
  {
    id: 'antarctic-circle',
    label: 'Antarctic Circle',
    latitudeDegrees: -66.6,
    text: () => 'At the Antarctic Circle, the pattern is reversed from the Arctic - the sun never sets around the December solstice.',
  },
  { id: 'reykjavik', label: 'Reykjavik', latitudeDegrees: 64.1 },
  { id: 'singapore', label: 'Singapore', latitudeDegrees: 1.35 },
]

const introFraming = { date: MARCH_EQUINOX_2026, radiusMultiplier: 14, azimuth: Math.PI / 4, elevation: 0.35, upAxis: ECLIPTIC_NORTH }
const marchFraming = { date: MARCH_EQUINOX_2026, radiusMultiplier: 8, azimuth: 0, elevation: 0.4, upAxis: ECLIPTIC_NORTH }
const juneFraming = { date: JUNE_SOLSTICE_2026, radiusMultiplier: 8, azimuth: Math.PI / 2, elevation: 0.4, upAxis: ECLIPTIC_NORTH }
const septemberFraming = { date: SEPTEMBER_EQUINOX_2026, radiusMultiplier: 8, azimuth: Math.PI, elevation: 0.4, upAxis: ECLIPTIC_NORTH }
const decemberFraming = { date: DECEMBER_SOLSTICE_2026, radiusMultiplier: 8, azimuth: (3 * Math.PI) / 2, elevation: 0.4, upAxis: ECLIPTIC_NORTH }

const CHAPTERS: Chapter[] = [
  {
    id: 'intro',
    title: 'Intro: A Tilted World',
    dateRange: weekWindow(MARCH_EQUINOX_2026),
    cameraFraming: introFraming,
    text: () =>
      "Earth's axis is tilted 23.4° relative to its orbit around the Sun. This tilt - not " +
      "Earth's distance from the Sun, which barely changes over a year - is what causes the " +
      'seasons. Step through the chapters below to see why.',
  },
  {
    id: 'march-equinox',
    title: 'March Equinox',
    dateRange: weekWindow(MARCH_EQUINOX_2026),
    cameraFraming: marchFraming,
    text: (_scrubT, latitude) =>
      latitude.text?.(_scrubT) ??
      `Around the March equinox, the Sun sits directly over the equator. At ${latitude.label}, ` +
        'day and night are close to equal length.',
  },
  {
    id: 'june-solstice',
    title: 'June Solstice',
    dateRange: weekWindow(JUNE_SOLSTICE_2026),
    cameraFraming: juneFraming,
    text: (_scrubT, latitude) =>
      latitude.text?.(_scrubT) ??
      `The June solstice: the north pole tilts toward the Sun. At ${latitude.label}, this means ` +
        (latitude.latitudeDegrees >= 0
          ? 'longer days and more direct sunlight - summer.'
          : 'shorter days and more oblique sunlight - winter.'),
  },
  {
    id: 'september-equinox',
    title: 'September Equinox',
    dateRange: weekWindow(SEPTEMBER_EQUINOX_2026),
    cameraFraming: septemberFraming,
    text: (_scrubT, latitude) =>
      latitude.text?.(_scrubT) ??
      `Around the September equinox, the Sun is back over the equator. At ${latitude.label}, day ` +
        'and night are close to equal again - the reverse trend from March.',
  },
  {
    id: 'december-solstice',
    title: 'December Solstice',
    dateRange: weekWindow(DECEMBER_SOLSTICE_2026),
    cameraFraming: decemberFraming,
    text: (_scrubT, latitude) =>
      latitude.text?.(_scrubT) ??
      `The December solstice: the south pole tilts toward the Sun. At ${latitude.label}, this ` +
        'means ' +
        (latitude.latitudeDegrees >= 0
          ? 'shorter days and more oblique sunlight - winter.'
          : 'longer days and more direct sunlight - summer.'),
  },
]

export const SEASONS_LESSON: Lesson = {
  id: 'seasons',
  title: 'Why does Earth have seasons?',
  chapters: CHAPTERS,
  latitudePresets: LATITUDE_PRESETS,
}

export const LESSONS_BY_ID: Record<string, Lesson> = {
  [SEASONS_LESSON.id]: SEASONS_LESSON,
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/app && npx vitest run test/seasonsLesson.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/learn/lessons/seasons.ts packages/app/test/seasonsLesson.test.ts
git commit -m "Add the Earth-seasons lesson content: 5 chapters, 7 latitude presets"
```

---

### Task 4: LessonPlayer state + chapter nav/scrub bar UI

**Files:**
- Create: `packages/app/src/learn/lessonPlayer.ts`
- Modify: `packages/app/index.html`
- Modify: `packages/app/src/hud/hud.css`
- Modify: `packages/app/src/main.ts`
- Test: `packages/app/e2e/learnMode.spec.ts` (extend)

**Interfaces:**
- Consumes: `Lesson`, `Chapter`, `dateAtScrubPosition` (Task 2), `LESSONS_BY_ID` (Task 3).
- Produces: `LessonPlayer` class with `load(lesson: Lesson): void`, `nextChapter(): void`, `previousChapter(): void`, `setScrubT(t: number): void`, `get currentChapter(): Chapter`, `get currentChapterIndex(): number`, `get scrubT(): number`, `get currentDate(): Date` — Task 5 (camera) and Task 6 (text/latitude) both read these. A `chapter-changed` and `scrub-changed` are NOT implemented as DOM events; callers (main.ts's `frame()`/UI wiring) poll the getters directly each time they act, matching this project's existing polling style (e.g. `scaleBlendTween.isAnimating`) rather than introducing an event-emitter pattern this codebase doesn't otherwise use.

- [ ] **Step 1: Implement `LessonPlayer`**

No failing-test step here — `LessonPlayer` is DOM-wiring/state glue in the same spirit as `DockUI`/`EntitySearchUI`/`TimeControlUI`, none of which have Vitest unit tests in this codebase; its behavior is covered by this task's e2e test (Step 4) instead, matching that established precedent.

Create `packages/app/src/learn/lessonPlayer.ts`:

```typescript
import type { Chapter, Lesson } from './lessonTypes'
import { dateAtScrubPosition } from './lessonTypes'

// Holds which lesson/chapter/scrub-position/latitude-preset is currently active. Pure state - no
// DOM access, no rendering - so main.ts's render loop and UI wiring can both read it each frame
// without this class needing to know about either.
export class LessonPlayer {
  private lesson: Lesson | null = null
  private chapterIndex = 0
  private _scrubT = 0

  load(lesson: Lesson): void {
    this.lesson = lesson
    this.chapterIndex = 0
    this._scrubT = 0
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

  get scrubT(): number {
    return this._scrubT
  }

  get currentDate(): Date {
    return dateAtScrubPosition(this.currentChapter.dateRange, this._scrubT)
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
    this._scrubT = 0
  }

  previousChapter(): void {
    if (!this.hasPreviousChapter) return
    this.chapterIndex -= 1
    this._scrubT = 0
  }

  setScrubT(t: number): void {
    this._scrubT = Math.min(Math.max(t, 0), 1)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Add the lesson-panel markup (chapter nav + scrub bar), reusing the shuttle's visual style**

Replace the placeholder `<div id="lesson-panel" class="hud-lesson-panel" hidden></div>` added in Task 1 with:

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

      <div id="lesson-latitude-row" class="hud-row" role="group" aria-label="Latitude"></div>

      <div class="hud-shuttle">
        <div class="hud-shuttle-track-wrap">
          <div class="hud-shuttle-track">
            <div class="hud-shuttle-fill" id="lesson-scrub-fill"></div>
          </div>
          <input
            id="lesson-scrub"
            class="hud-range hud-shuttle-input"
            type="range"
            min="0"
            max="1"
            step="0.001"
            value="0"
            aria-label="Scrub through this chapter's date range"
          />
        </div>
      </div>
    </div>
```

- [ ] **Step 4: Add CSS for the lesson text and left-anchored scrub fill**

Add to `packages/app/src/hud/hud.css`, inside the `/* -------------------- app mode: learn -------------------- */` section added in Task 1:

```css
.hud-lesson-text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--hud-text);
}

/* The lesson scrub bar represents absolute progress through a date range (0 = start, 1 = end),
   not a signed rate around a center zero like the time shuttle it's visually based on - so its
   fill grows from the left edge, not from a center tick. */
#lesson-scrub-fill {
  left: 0 !important;
}

.hud-latitude-chip {
  appearance: none;
  border: 1px solid var(--hud-control-border);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  color: var(--hud-dim);
  background: var(--hud-control-bg);
  padding: 6px 10px;
  border-radius: 999px;
}
.hud-latitude-chip.is-active {
  color: #e6c9fb;
  background: var(--hud-accent-learn-tint);
  border-color: rgba(201, 138, 240, 0.3);
}
```

- [ ] **Step 5: Wire chapter nav + scrub bar into `main.ts`**

Add the import:

```typescript
import { LessonPlayer } from './learn/lessonPlayer'
import { LESSONS_BY_ID } from './learn/lessons/seasons'
```

Replace this task's earlier placeholder wiring from Task 1 (the two `learnModeBtn.addEventListener` calls and the lesson-picker item loop) with the following, which folds in `LessonPlayer` and refreshes the chapter/scrub UI on every relevant change:

```typescript
  const lessonPlayer = new LessonPlayer()
  const learnModeController = new LearnModeController(document.body, cameraInput, dockUI)
  const learnModeBtn = requireElement<HTMLButtonElement>('#learn-mode-btn')
  const lessonPicker = requireElement<HTMLElement>('#lesson-picker')
  const lessonPanel = requireElement<HTMLElement>('#lesson-panel')
  const lessonChapterTitle = requireElement<HTMLElement>('#lesson-chapter-title')
  const lessonPrevBtn = requireElement<HTMLButtonElement>('#lesson-prev-chapter')
  const lessonNextBtn = requireElement<HTMLButtonElement>('#lesson-next-chapter')
  const lessonScrub = requireElement<HTMLInputElement>('#lesson-scrub')

  function refreshChapterUI(): void {
    const chapter = lessonPlayer.currentChapter
    lessonChapterTitle.textContent = `${lessonPlayer.currentChapterIndex + 1} / ${lessonPlayer.currentLesson.chapters.length}: ${chapter.title}`
    lessonPrevBtn.disabled = !lessonPlayer.hasPreviousChapter
    lessonNextBtn.disabled = !lessonPlayer.hasNextChapter
    lessonScrub.value = String(lessonPlayer.scrubT)
    lessonScrub.dispatchEvent(new Event('input')) // refreshes the shuttle-style fill via initShuttleVisual
    lessonPanel.dataset.chapterId = chapter.id
    lessonPanel.dataset.scrubT = String(lessonPlayer.scrubT)
  }

  learnModeBtn.addEventListener('click', () => {
    if (learnModeController.currentMode === 'learn') {
      learnModeController.exit()
      lessonPanel.hidden = true
      lessonPicker.hidden = true
      return
    }
    lessonPicker.hidden = !lessonPicker.hidden
  })
  lessonPicker.querySelectorAll<HTMLButtonElement>('.hud-lesson-picker-item').forEach((item) => {
    item.addEventListener('click', () => {
      const lessonId = item.dataset.lessonId
      const lesson = lessonId ? LESSONS_BY_ID[lessonId] : undefined
      if (!lesson) return
      lessonPicker.hidden = true
      lessonPlayer.load(lesson)
      learnModeController.enter(lesson.id)
      lessonPanel.hidden = false
      refreshChapterUI()
    })
  })
  lessonPrevBtn.addEventListener('click', () => {
    lessonPlayer.previousChapter()
    refreshChapterUI()
  })
  lessonNextBtn.addEventListener('click', () => {
    lessonPlayer.nextChapter()
    refreshChapterUI()
  })
  lessonScrub.addEventListener('input', () => {
    lessonPlayer.setScrubT(Number(lessonScrub.value))
    lessonPanel.dataset.scrubT = String(lessonPlayer.scrubT)
  })
  initShuttleVisual(lessonScrub, requireElement<HTMLElement>('#lesson-scrub-fill'))
```

(This replaces, not duplicates, Task 1's simpler placeholder wiring — the `dockUI`/`LearnModeController` construction lines from Task 1 stay as they are; only the `learnModeBtn`/`lessonPicker` listener bodies change.)

- [ ] **Step 6: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 7: Extend the e2e test for chapter nav and scrubbing**

Add to `packages/app/e2e/learnMode.spec.ts` (a new `test(...)` block, after the existing one):

```typescript
test('chapter navigation and scrubbing update lesson-panel state', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()

  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'intro')
  await expect(page.locator('#lesson-prev-chapter')).toBeDisabled()

  await page.locator('#lesson-next-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'march-equinox')
  await expect(page.locator('#lesson-prev-chapter')).toBeEnabled()

  await page.locator('#lesson-scrub').fill('0.75')
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-scrub-t', '0.75')

  await page.locator('#lesson-prev-chapter').click()
  // Navigating chapters resets scrub back to 0, per LessonPlayer.nextChapter/previousChapter.
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-scrub-t', '0')

  expect(errors).toEqual([])
})
```

- [ ] **Step 8: Run the e2e tests and the full suite**

Run: `cd packages/app && npx playwright test e2e/learnMode.spec.ts`
Expected: PASS (2/2).

Run: `npm run typecheck && npm run build && npm run test`
Expected: all succeed.

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all PASS.

- [ ] **Step 9: Manual visual check**

Run: `cd packages/app && npm run dev`. Enter the seasons lesson. Confirm the chapter title/counter, next/prev buttons (correctly disabled at the first/last chapter), and scrub bar all appear and respond. The scrub fill should grow from the left edge as you drag it, not from a center tick.

- [ ] **Step 10: Commit**

```bash
git add packages/app/src/learn/lessonPlayer.ts packages/app/index.html packages/app/src/hud/hud.css \
  packages/app/src/main.ts packages/app/e2e/learnMode.spec.ts
git commit -m "Wire up chapter navigation and a chapter-local scrub bar for the seasons lesson

LessonPlayer holds chapter index and scrub position as plain state
(no DOM access), matching this codebase's existing UI-wiring classes
(DockUI, EntitySearchUI) rather than introducing an event-emitter
pattern this project doesn't otherwise use."
```

---

### Task 5: Camera framing per chapter (locked, tween-based) + moons hidden in learn mode

**Files:**
- Modify: `packages/app/src/camera/cameraFollow.ts`
- Modify: `packages/app/src/main.ts`
- Test: `packages/app/test/cameraFollow.test.ts` (extend)
- Test: `packages/app/e2e/learnMode.spec.ts` (extend)

**Interfaces:**
- Consumes: `ChapterCameraFraming` (Task 2), `LessonPlayer.currentChapter`/`currentDate` (Task 4), `entityWorldPosition` (existing, `solarSystem/entities.ts`), `scaledBodyRadiusUnits` (existing, `solarSystem/sceneScale.ts`), `currentJulianDay`/`daysSinceJ2000`/`julianMillenniaSinceJ2000` (existing).
- Produces: `CameraFollowController.flyToFraming(target, radius, azimuth, elevation, upAxis, durationSeconds?): void` — a new public method, entity-independent (unlike `selectEntity`). No later task consumes this beyond `main.ts`'s own per-chapter wiring.

- [ ] **Step 1: Write the failing test for `flyToFraming`**

Add to `packages/app/test/cameraFollow.test.ts` (read the existing file first to match its exact setup/import style — it already constructs an `OrbitCamera` and a `CameraFollowController` for the existing `selectEntity`/`stopFollowing` tests; reuse that same construction pattern). Add this new `describe` block:

```typescript
describe('CameraFollowController.flyToFraming', () => {
  it('tweens target/radius/azimuth/elevation/upAxis toward the given fixed framing, not an entity', () => {
    const camera = new OrbitCamera({ target: [0, 0, 0], radius: 10, azimuth: 0, elevation: 0 })
    const controller = new CameraFollowController(camera, { flyToDurationSeconds: 2 })

    controller.flyToFraming([5, 0, 0], 20, Math.PI / 2, 0.5, [0, 0, 1])
    controller.update(1, 0, 0, 1) // halfway through the 2s tween

    expect(camera.target[0]).toBeGreaterThan(0)
    expect(camera.target[0]).toBeLessThan(5)
    expect(camera.radius).toBeGreaterThan(10)
    expect(camera.radius).toBeLessThan(20)

    controller.update(1, 0, 0, 1) // completes the tween
    expect(camera.target[0]).toBeCloseTo(5, 5)
    expect(camera.radius).toBeCloseTo(20, 5)
    expect(camera.azimuth).toBeCloseTo(Math.PI / 2, 5)
    expect(camera.elevation).toBeCloseTo(0.5, 5)
  })

  it('does not set followedEntityId, so live entity-tracking never kicks in afterward', () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    controller.flyToFraming([1, 1, 1], 10, 0, 0, [0, 0, 1])
    expect(controller.followedEntityId).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/app && npx vitest run test/cameraFollow.test.ts`
Expected: FAIL — `controller.flyToFraming is not a function`.

- [ ] **Step 3: Implement `flyToFraming`, extending `FlyToTween` to cover elevation**

Modify `packages/app/src/camera/cameraFollow.ts`. The existing `FlyToTween` interface gains `startElevation`/`endElevation` fields (fly-to tweens today don't touch elevation at all — the design spec explicitly anticipates this as a small, plan-time extension, not a redesign, since a locked per-chapter camera needs full control over all four orbit parameters to be predictable). `selectEntity` is updated to pass the camera's *current* elevation as both start and end (preserving its existing "elevation stays whatever the user had" behavior for search fly-tos), while the new `flyToFraming` supplies an explicit end elevation:

```typescript
interface FlyToTween {
  startTarget: [number, number, number]
  startRadius: number
  startAzimuth: number
  startElevation: number
  startUpAxis: [number, number, number]
  endTarget: [number, number, number]
  endRadius: number
  endAzimuth: number
  endElevation: number
  endUpAxis: [number, number, number]
  elapsedSeconds: number
  durationSeconds: number
}
```

Update `selectEntity` (only the `flyTo = {...}` assignment changes — everything above it in the method is unchanged):

```typescript
    this.flyTo = {
      startTarget,
      startRadius: this.orbitCamera.radius,
      startAzimuth: this.orbitCamera.azimuth,
      startElevation: this.orbitCamera.elevation,
      startUpAxis,
      endTarget,
      endRadius: defaultFramingRadius(entity, scaleBlend, this.orbitCamera),
      endAzimuth: defaultFramingAzimuth(endTarget, this.orbitCamera.azimuth, basis),
      endElevation: this.orbitCamera.elevation,
      endUpAxis: entityPoleDirection(entity),
      elapsedSeconds: 0,
      durationSeconds: this.flyToDurationSeconds,
    }
```

Add the new method (after `selectEntity`, before `stopFollowing`):

```typescript
  // Entity-independent counterpart to selectEntity: flies to a fixed, caller-supplied framing
  // (target/radius/azimuth/elevation/upAxis) instead of one derived from a SolarSystemEntity's
  // live position/pole. Used by learn-mode chapter framing, where the target is Earth's position
  // on a lesson-authored date rather than "whatever a followed entity's live position is right
  // now." Deliberately does NOT set followedEntity/followedEntityId, so update()'s live-tracking
  // branch never engages afterward - the camera holds the tween's end framing exactly, since a
  // chapter's own scrub-driven date changes are applied by re-deriving Earth's world transform
  // directly in main.ts's render loop, not by continuously re-flying the camera.
  flyToFraming(
    endTarget: [number, number, number],
    endRadius: number,
    endAzimuth: number,
    endElevation: number,
    endUpAxis: [number, number, number],
    durationSeconds?: number,
  ): void {
    const startTarget: [number, number, number] = [
      this.orbitCamera.target[0],
      this.orbitCamera.target[1],
      this.orbitCamera.target[2],
    ]
    const startUpAxis: [number, number, number] = [
      this.orbitCamera.upAxis[0],
      this.orbitCamera.upAxis[1],
      this.orbitCamera.upAxis[2],
    ]
    this.flyTo = {
      startTarget,
      startRadius: this.orbitCamera.radius,
      startAzimuth: this.orbitCamera.azimuth,
      startElevation: this.orbitCamera.elevation,
      startUpAxis,
      endTarget,
      endRadius,
      endAzimuth,
      endElevation,
      endUpAxis,
      elapsedSeconds: 0,
      durationSeconds: durationSeconds ?? this.flyToDurationSeconds,
    }
  }
```

Update `update()` to interpolate elevation alongside the existing fields (only the body of the `if (this.flyTo)` branch changes):

```typescript
  update(deltaSeconds: number, T: number, daysSinceEpoch: number, scaleBlend: number): void {
    if (this.flyTo) {
      this.flyTo.elapsedSeconds += deltaSeconds
      const t = Math.min(this.flyTo.elapsedSeconds / this.flyTo.durationSeconds, 1)
      const eased = easeInOutCubic(t)
      vec3.copy(this.orbitCamera.target, lerpVec3(this.flyTo.startTarget, this.flyTo.endTarget, eased))
      this.orbitCamera.radius = lerp(this.flyTo.startRadius, this.flyTo.endRadius, eased)
      this.orbitCamera.azimuth = lerpAngle(this.flyTo.startAzimuth, this.flyTo.endAzimuth, eased)
      this.orbitCamera.elevation = lerp(this.flyTo.startElevation, this.flyTo.endElevation, eased)
      const upAxis = vec3.create()
      vec3.slerp(upAxis, this.flyTo.startUpAxis, this.flyTo.endUpAxis, eased)
      vec3.copy(this.orbitCamera.upAxis, upAxis)
      if (t >= 1) this.flyTo = null
      return
    }

    if (this.followedEntity) {
      const livePosition = entityWorldPosition(this.followedEntity, T, daysSinceEpoch, scaleBlend)
      const currentTarget: [number, number, number] = [
        this.orbitCamera.target[0],
        this.orbitCamera.target[1],
        this.orbitCamera.target[2],
      ]
      vec3.copy(this.orbitCamera.target, lerpVec3(currentTarget, livePosition, followSmoothingFactor(deltaSeconds)))
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/app && npx vitest run test/cameraFollow.test.ts`
Expected: PASS, including the 2 new tests.

- [ ] **Step 5: Drive the camera to each chapter's framing, and hide moons, in `main.ts`**

`AU_KM` is already imported via the existing `import { AU_KM, PLANETS, SUN, ... } from './solarSystem/bodies'` line — no change needed there. Add this new import:

```typescript
import { ALL_ENTITIES, entityWorldPosition } from './solarSystem/entities'
```

In `refreshChapterUI()` (Task 4), after the existing body, add a call to a new `flyToCurrentChapterFraming()` function (defined next) so entering a chapter (via the lesson picker or next/prev) re-flies the camera:

```typescript
  function flyToCurrentChapterFraming(): void {
    const chapter = lessonPlayer.currentChapter
    const earthEntity = ALL_ENTITIES.find((e) => e.id === 'earth')!
    const julianDay = currentJulianDay(chapter.cameraFraming.date)
    const T = julianMillenniaSinceJ2000(julianDay)
    const daysSinceEpoch = daysSinceJ2000(julianDay)
    const target = entityWorldPosition(earthEntity, T, daysSinceEpoch, scaleBlend)
    const earthRadius = scaledBodyRadiusUnits(6371.0, 1.0, scaleBlend, AU_KM) // matches bodies.ts's Earth entry (radiusKm 6371.0, compactVisualRadius 1.0)
    const radius = Math.min(Math.max(earthRadius * chapter.cameraFraming.radiusMultiplier, orbitCamera.minRadius), orbitCamera.maxRadius)
    cameraFollow.flyToFraming(
      target,
      radius,
      chapter.cameraFraming.azimuth,
      chapter.cameraFraming.elevation,
      [...chapter.cameraFraming.upAxis],
    )
  }
```

Update `refreshChapterUI()` to call it — add `flyToCurrentChapterFraming()` as the first line inside the function body.

Hide moons while in learn mode: change the existing `if (showMoons) {` line in `frame()`'s moon-rendering block to:

```typescript
    if (showMoons && learnModeController.currentMode !== 'learn') {
```

(Moons are skipped entirely in learn mode because a moon's position is computed relative to its *parent's real simulation-clock position* — see the existing moon loop's `parentPosition = planetPositionsById.get(moon.parentId)` — while Earth's own rendered position during a lesson comes from the lesson's separate scrub-driven date. Rendering the Moon against Earth's real-time position while Earth itself is drawn at a different, lesson-driven position would visibly desync it from the planet it's supposed to orbit. This mirrors the existing `else` branch's own handling for the `!showMoons` case, which already hides moon labels — no changes needed there since that branch is untouched.)

- [ ] **Step 6: Redirect Earth's own per-frame rendering to the lesson's scrub-driven date while in learn mode**

In `frame()`'s planet loop (`for (const { renderable, x: sx, y: sy, z: sz, radius } of planetFrameData) { ... }`), Earth's position/rotation must come from `lessonPlayer.currentDate` while in learn mode, instead of the shared `T`/`daysSinceEpoch` every other planet uses. The cleanest place for this is in `planetFrameData`'s own construction (Phase 1), so Earth's overridden position flows through to shadows/occluders exactly like any other planet's would — replace the existing `planetFrameData` construction with:

```typescript
    const planetPositionsById = new Map<string, [number, number, number]>()
    const planetRadiusById = new Map<string, number>()
    const planetFrameData = planetRenderables.map((renderable) => {
      const isLearnEarth = learnModeController.currentMode === 'learn' && renderable.definition.id === 'earth'
      let x: number, y: number, z: number, distanceAu: number
      if (isLearnEarth) {
        const learnJulianDay = currentJulianDay(lessonPlayer.currentDate)
        const learnT = julianMillenniaSinceJ2000(learnJulianDay)
        ;({ x, y, z, distanceAu } = planetAuPosition(renderable.definition, learnT))
      } else {
        ;({ x, y, z, distanceAu } = planetAuPosition(renderable.definition, T))
      }
      const [sx, sy, sz] = scaledPosition(x, y, z, distanceAu, scaleBlend)
      planetPositionsById.set(renderable.definition.id, [sx, sy, sz])
      const radius = scaledBodyRadiusUnits(
        renderable.definition.radiusKm,
        renderable.definition.compactVisualRadius,
        scaleBlend,
        AU_KM,
      )
      planetRadiusById.set(renderable.definition.id, radius)
      return { renderable, x: sx, y: sy, z: sz, radius }
    })
```

Earth's *rotation* (day/night terminator) is computed later in the same `for (const { renderable, x: sx, ... } of planetFrameData)` loop via `rotationAngleRadians(daysSinceEpoch, renderable.definition.siderealRotationHours)` — this must also use the lesson's own `daysSinceEpoch` for Earth specifically. Change that line to:

```typescript
      const isLearnEarth = learnModeController.currentMode === 'learn' && renderable.definition.id === 'earth'
      const rotationDaysSinceEpoch = isLearnEarth ? daysSinceJ2000(currentJulianDay(lessonPlayer.currentDate)) : daysSinceEpoch
      const rotation = rotationAngleRadians(rotationDaysSinceEpoch, renderable.definition.siderealRotationHours)
```

(This recomputes `currentJulianDay(lessonPlayer.currentDate)` a second time in the same frame for Earth, alongside Phase 1's own computation — a small, harmless duplication of a cheap pure function call, not worth threading an extra value through `planetFrameData`'s shape for.)

- [ ] **Step 7: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 8: Extend the e2e test for camera locking**

Add to `packages/app/e2e/learnMode.spec.ts`:

```typescript
test('the canvas keeps rendering (camera locked, not frozen) across a chapter change', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.waitForTimeout(2000) // let the initial chapter's camera fly-to tween settle

  await page.locator('#lesson-next-chapter').click()
  await page.waitForTimeout(2000) // let the chapter-change fly-to tween settle

  expect(errors).toEqual([])
})
```

- [ ] **Step 9: Run the full test suite**

Run: `npm run typecheck && npm run build && npm run test`
Expected: all succeed.

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all PASS.

- [ ] **Step 10: Manual visual check**

Run: `cd packages/app && npm run dev`. Enter the seasons lesson and step through all 5 chapters. Confirm: the camera smoothly flies to a new framing on each chapter change (not a snap), Earth's day/night terminator visibly differs between the June and December solstice chapters (opposite hemispheres lit), no moons are visible, and dragging the canvas does nothing.

- [ ] **Step 11: Commit**

```bash
git add packages/app/src/camera/cameraFollow.ts packages/app/src/main.ts \
  packages/app/test/cameraFollow.test.ts packages/app/e2e/learnMode.spec.ts
git commit -m "Fly the camera to each chapter's authored framing; drive Earth from the lesson's own date

CameraFollowController.flyToFraming generalizes the existing fly-to
tween to an arbitrary target/radius/azimuth/elevation/up-axis instead
of one derived from a live entity - reusing the tween machinery
rather than duplicating it. Earth's own position/rotation are
recomputed from the lesson's scrub-driven date specifically (every
other body keeps using the live simulation clock); moons are hidden
in learn mode since their position math is relative to their
parent's real-time position, which would desync from a
lesson-repositioned Earth."
```

---

### Task 6: Educational text + latitude preset picker UI

**Files:**
- Modify: `packages/app/src/main.ts`
- Test: `packages/app/e2e/learnMode.spec.ts` (extend)

**Interfaces:**
- Consumes: `LatitudePreset`, `Chapter.text` (Task 2/3), `LessonPlayer` (Task 4).
- Produces: nothing consumed by later tasks — this task only renders text/latitude UI, it doesn't add new state.

- [ ] **Step 1: Track the selected latitude preset and render latitude chips + chapter text**

In `main.ts`, add a `selectedLatitudeId` local variable (declared alongside `lessonPlayer`) and a `refreshChapterUI()` extension. Replace `refreshChapterUI()`'s body (as it stood after Task 5's addition) with:

```typescript
  let selectedLatitudeId = 'equator'
  const lessonLatitudeRow = requireElement<HTMLElement>('#lesson-latitude-row')
  const lessonChapterText = requireElement<HTMLElement>('#lesson-chapter-text')

  function currentLatitudePreset() {
    const preset = lessonPlayer.currentLesson.latitudePresets.find((p) => p.id === selectedLatitudeId)
    return preset ?? lessonPlayer.currentLesson.latitudePresets[0]
  }

  function refreshLatitudeRow(): void {
    lessonLatitudeRow.innerHTML = ''
    for (const preset of lessonPlayer.currentLesson.latitudePresets) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'hud-latitude-chip'
      chip.textContent = preset.label
      chip.classList.toggle('is-active', preset.id === selectedLatitudeId)
      chip.addEventListener('click', () => {
        selectedLatitudeId = preset.id
        refreshChapterUI()
      })
      lessonLatitudeRow.appendChild(chip)
    }
  }

  function refreshChapterUI(): void {
    flyToCurrentChapterFraming()
    const chapter = lessonPlayer.currentChapter
    lessonChapterTitle.textContent = `${lessonPlayer.currentChapterIndex + 1} / ${lessonPlayer.currentLesson.chapters.length}: ${chapter.title}`
    lessonPrevBtn.disabled = !lessonPlayer.hasPreviousChapter
    lessonNextBtn.disabled = !lessonPlayer.hasNextChapter
    lessonScrub.value = String(lessonPlayer.scrubT)
    lessonScrub.dispatchEvent(new Event('input'))
    lessonChapterText.textContent = chapter.text(lessonPlayer.scrubT, currentLatitudePreset())
    refreshLatitudeRow()
    lessonPanel.dataset.chapterId = chapter.id
    lessonPanel.dataset.scrubT = String(lessonPlayer.scrubT)
    lessonPanel.dataset.latitudeId = selectedLatitudeId
  }
```

Update the scrub-input listener (from Task 4) so scrubbing also refreshes the text, since `Chapter.text` is a function of `scrubT`:

```typescript
  lessonScrub.addEventListener('input', () => {
    lessonPlayer.setScrubT(Number(lessonScrub.value))
    lessonChapterText.textContent = lessonPlayer.currentChapter.text(lessonPlayer.scrubT, currentLatitudePreset())
    lessonPanel.dataset.scrubT = String(lessonPlayer.scrubT)
  })
```

Reset `selectedLatitudeId` back to the lesson's first preset whenever a new lesson loads — add this line inside the lesson-picker item's click handler (Task 4), immediately after `lessonPlayer.load(lesson)`:

```typescript
      selectedLatitudeId = lesson.latitudePresets[0].id
```

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 3: Extend the e2e test for latitude selection**

Add to `packages/app/e2e/learnMode.spec.ts`:

```typescript
test('selecting a latitude preset updates the lesson panel and the displayed text', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.locator('#lesson-next-chapter').click() // march-equinox chapter has non-empty text

  const beforeText = await page.locator('#lesson-chapter-text').textContent()

  await page.locator('.hud-latitude-chip', { hasText: 'Arctic Circle' }).click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-latitude-id', 'arctic-circle')

  const afterText = await page.locator('#lesson-chapter-text').textContent()
  expect(afterText).not.toBe(beforeText)

  expect(errors).toEqual([])
})
```

- [ ] **Step 4: Run the e2e tests and the full suite**

Run: `cd packages/app && npx playwright test e2e/learnMode.spec.ts`
Expected: PASS (4/4).

Run: `npm run typecheck && npm run build && npm run test`
Expected: all succeed.

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all PASS.

- [ ] **Step 5: Manual visual check**

Run: `cd packages/app && npm run dev`. Enter the seasons lesson, step to the June Solstice chapter, and click through several latitude chips (Equator, Arctic Circle, Tropic of Capricorn). Confirm the text updates each time and reads sensibly for that latitude/chapter combination.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/main.ts packages/app/e2e/learnMode.spec.ts
git commit -m "Render chapter educational text and a latitude preset picker"
```

---

### Task 7: Dash-pattern + animated line-rendering extension (generalizes the existing orbit-path pipeline)

**Files:**
- Modify: `packages/app/src/renderer/shaders.ts`
- Modify: `packages/app/src/renderer/webgpu.ts`
- Create: `packages/app/src/renderer/lineDistance.ts`
- Modify: `packages/app/src/main.ts`
- Test: `packages/app/test/lineDistance.test.ts`
- Test: `packages/app/e2e/learnMode.spec.ts` (extend)

**Interfaces:**
- Consumes: nothing from earlier tasks — independent of Tasks 1-6.
- Produces: `LINE_UNIFORM_FLOAT_COUNT` (new named constant, `renderer/shaders.ts`), `computeCumulativeLineDistances(points: Float32Array): Float32Array` (`renderer/lineDistance.ts`) — Task 8 (overlay geometry) uses both. `createLineVertexBuffer`/`updateLineVertexBuffer` (renamed from `createOrbitPathBuffer`/`updateOrbitPathBuffer`, `renderer/webgpu.ts`) — Task 8 reuses these for overlay-line buffers too.

- [ ] **Step 1: Write the failing test for the pure distance-computation helper**

Create `packages/app/test/lineDistance.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { computeCumulativeLineDistances } from '../src/renderer/lineDistance'

describe('computeCumulativeLineDistances', () => {
  it('returns [0] for a single point', () => {
    const points = new Float32Array([1, 2, 3])
    expect(Array.from(computeCumulativeLineDistances(points))).toEqual([0])
  })

  it('accumulates Euclidean distance along a right-angle path', () => {
    // (0,0,0) -> (3,0,0) -> (3,4,0): segment lengths 3 and 5.
    const points = new Float32Array([0, 0, 0, 3, 0, 0, 3, 4, 0])
    const distances = Array.from(computeCumulativeLineDistances(points))
    expect(distances[0]).toBeCloseTo(0, 10)
    expect(distances[1]).toBeCloseTo(3, 10)
    expect(distances[2]).toBeCloseTo(8, 10)
  })

  it('produces a monotonically non-decreasing sequence for an arbitrary path', () => {
    const points = new Float32Array([0, 0, 0, 1, 1, 1, 0.5, 0.5, 0.5, 2, 0, 0])
    const distances = Array.from(computeCumulativeLineDistances(points))
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1])
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/app && npx vitest run test/lineDistance.test.ts`
Expected: FAIL — `Cannot find module '../src/renderer/lineDistance'`.

- [ ] **Step 3: Implement the pure helper**

Create `packages/app/src/renderer/lineDistance.ts`:

```typescript
// Computes cumulative Euclidean distance along a line-strip's points (a flat [x0,y0,z0,x1,y1,z1,...]
// array, the same shape generateOrbitPathPositions/overlay-geometry functions produce), starting
// at 0 for the first point. This is the per-vertex "distance traveled" the line shader's dash
// pattern (see lineShaderCode's dashParams) is keyed off of, uploaded as a second, parallel vertex
// buffer alongside the existing position buffer.
export function computeCumulativeLineDistances(points: Float32Array): Float32Array {
  const pointCount = points.length / 3
  const distances = new Float32Array(pointCount)
  for (let i = 1; i < pointCount; i++) {
    const dx = points[i * 3] - points[(i - 1) * 3]
    const dy = points[i * 3 + 1] - points[(i - 1) * 3 + 1]
    const dz = points[i * 3 + 2] - points[(i - 1) * 3 + 2]
    distances[i] = distances[i - 1] + Math.hypot(dx, dy, dz)
  }
  return distances
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/app && npx vitest run test/lineDistance.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Extend the line shader with a dash-pattern uniform and a second vertex attribute**

In `packages/app/src/renderer/shaders.ts`, replace the existing `lineShaderCode` export with:

```typescript
// Uniform layout: [0..16) worldViewProjection : mat4x4f, [16..20) color : vec4f,
// [20..24) dashParams : vec4f (x = dash length in world units, y = animated dash offset in world
// units, z = duty cycle 0..1 - fraction of each dash period that's visible, w = 1.0 to enable
// dashing / 0.0 to render solid).
export const LINE_UNIFORM_FLOAT_COUNT = 24

// Shared by orbit paths (dashParams.w = 0, solid, reproducing the pre-existing appearance exactly)
// and learn-mode globe overlays (dashParams.w = 1, animated dashed "reference geometry" look) -
// one pipeline, one shader, gated by a uniform flag rather than two near-duplicate shaders.
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

- [ ] **Step 6: Extend `createLinePipeline`'s vertex layout, and rename the buffer-upload helpers generically**

In `packages/app/src/renderer/webgpu.ts`, add a second vertex buffer layout right after the existing `LINE_POSITION_BUFFER_LAYOUT`:

```typescript
const LINE_DISTANCE_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 4,
  attributes: [{ shaderLocation: 1, offset: 0, format: 'float32' }],
}
```

Update `createLinePipeline`'s `vertex.buffers` array:

```typescript
export async function createLinePipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'line shader', code: lineShaderCode })
  return await device.createRenderPipelineAsync({
    label: 'line pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [LINE_POSITION_BUFFER_LAYOUT, LINE_DISTANCE_BUFFER_LAYOUT] },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'line-strip' },
    multisample: { count: SAMPLE_COUNT },
    depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' },
  })
}
```

Rename `createOrbitPathBuffer`/`updateOrbitPathBuffer` to `createLineVertexBuffer`/`updateLineVertexBuffer` (the functions themselves are already fully generic — raw `Float32Array` uploaders with no orbit-path-specific logic — only their names were scoped to their one prior use case):

```typescript
export function createLineVertexBuffer(device: GPUDevice, initialValues: Float32Array): GPUBuffer {
  const buffer = device.createBuffer({
    label: 'line vertex buffer',
    size: initialValues.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(buffer, 0, initialValues as BufferSource)
  return buffer
}

export function updateLineVertexBuffer(device: GPUDevice, buffer: GPUBuffer, values: Float32Array): void {
  device.queue.writeBuffer(buffer, 0, values as BufferSource)
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: FAIL at this point — `main.ts` still calls the old `createOrbitPathBuffer`/`updateOrbitPathBuffer` names and allocates orbit-path uniform buffers/arrays sized `20`, not `LINE_UNIFORM_FLOAT_COUNT` (24). This is expected; fixed in the next step.

- [ ] **Step 8: Update every orbit-path call site in `main.ts` to the renamed functions, the new uniform size, and a distance buffer**

Update the import line:

```typescript
import {
  createBodySampler,
  createCloudShellPipeline,
  createFlarePipeline,
  createLinePipeline,
  createLineVertexBuffer,
  createLitPipeline,
  createMeshBuffers,
  createRenderTargets,
  createRingBuffers,
  createRingPipeline,
  createStarBuffer,
  createStarPipeline,
  createUnlitPipeline,
  initWebGpu,
  updateLineVertexBuffer,
  type MeshBuffers,
} from './renderer/webgpu'
```

Update the shaders import to also bring in `LINE_UNIFORM_FLOAT_COUNT`:

```typescript
import { CLOUD_SHELL_UNIFORM_FLOAT_COUNT, LINE_UNIFORM_FLOAT_COUNT, LIT_UNIFORM_FLOAT_COUNT } from './renderer/shaders'
```

Add the import:

```typescript
import { computeCumulativeLineDistances } from './renderer/lineDistance'
```

Replace the `OrbitPathRenderable` interface and its construction:

```typescript
  interface OrbitPathRenderable {
    definition: BodyDefinition
    vertexBuffer: GPUBuffer
    distanceBuffer: GPUBuffer
    uniformBuffer: GPUBuffer
    bindGroup: GPUBindGroup
  }

  const orbitPathRenderables: OrbitPathRenderable[] = PLANETS.map((planet) => {
    const positions = generateOrbitPathPositions(planet, scaleBlend)
    const vertexBuffer = createLineVertexBuffer(device, positions)
    const distanceBuffer = createLineVertexBuffer(device, computeCumulativeLineDistances(positions))
    const uniformBuffer = device.createBuffer({
      label: `${planet.id} orbit path uniforms`,
      size: LINE_UNIFORM_FLOAT_COUNT * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const bindGroup = device.createBindGroup({
      layout: linePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })
    return { definition: planet, vertexBuffer, distanceBuffer, uniformBuffer, bindGroup }
  })
```

Update `refreshOrbitPaths()`:

```typescript
  function refreshOrbitPaths(): void {
    for (const path of orbitPathRenderables) {
      const positions = generateOrbitPathPositions(path.definition, scaleBlend)
      updateLineVertexBuffer(device, path.vertexBuffer, positions)
      updateLineVertexBuffer(device, path.distanceBuffer, computeCumulativeLineDistances(positions))
    }
  }
```

Update the orbit-path uniform write in `frame()` (`if (showOrbitPaths) { for (const path of orbitPathRenderables) { ... } }`) to the new float count, with `dashParams` left at all-zero (`w = 0` disables dashing, exactly reproducing today's solid appearance):

```typescript
    if (showOrbitPaths) {
      for (const path of orbitPathRenderables) {
        const uniforms = new Float32Array(LINE_UNIFORM_FLOAT_COUNT)
        uniforms.set(viewProjection, 0)
        uniforms.set([...path.definition.color, 0.5], 16)
        uniforms.set([0, 0, 0, 0], 20)
        device.queue.writeBuffer(path.uniformBuffer, 0, uniforms)
      }
    }
```

Update the orbit-path draw call to bind the new second vertex buffer:

```typescript
    if (showOrbitPaths) {
      pass.setPipeline(linePipeline)
      for (const path of orbitPathRenderables) {
        pass.setVertexBuffer(0, path.vertexBuffer)
        pass.setVertexBuffer(1, path.distanceBuffer)
        pass.setBindGroup(0, path.bindGroup)
        pass.draw(129) // ORBIT_PATH_SEGMENTS + 1 points, see orbitPath.ts
      }
    }
```

**Do not touch** the star uniform buffer (`starUniformBuffer`, `size: 20 * 4`) — it's a coincidentally-same-sized but structurally unrelated struct (mat4 + vec2, for `starShaderCode`, not `lineShaderCode`); only the orbit-path-specific `20`s above are affected by this task.

- [ ] **Step 9: Typecheck, build, and run the full test suite**

Run: `npm run typecheck && npm run build && npm run test`
Expected: all succeed.

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all PASS (orbit paths must render identically to before this task — no dashing visible on them).

- [ ] **Step 10: Manual visual check**

Run: `cd packages/app && npm run dev`. Confirm orbit paths still render as solid lines, unchanged from before this task.

- [ ] **Step 11: Commit**

```bash
git add packages/app/src/renderer/shaders.ts packages/app/src/renderer/webgpu.ts \
  packages/app/src/renderer/lineDistance.ts packages/app/src/main.ts \
  packages/app/test/lineDistance.test.ts
git commit -m "Extend the line-rendering pipeline with an optional dash pattern

Generalizes the pipeline orbit paths already use (renamed from
createOrbitPathBuffer/updateOrbitPathBuffer to the now-accurate
createLineVertexBuffer/updateLineVertexBuffer) with a per-vertex
arc-length attribute and a dashParams uniform, gated by a flag so
orbit paths render exactly as before (dashParams.w = 0) while a later
task's globe overlays can opt into an animated dashed look."
```

---

### Task 8: Globe overlay geometry (equator ring, axis line, sun-angle ray, latitude marker)

**Files:**
- Create: `packages/app/src/learn/overlayGeometry.ts`
- Modify: `packages/app/src/main.ts`
- Test: `packages/app/test/overlayGeometry.test.ts`
- Test: `packages/app/e2e/learnMode.spec.ts` (extend)

**Interfaces:**
- Consumes: `computeCumulativeLineDistances`, `LINE_UNIFORM_FLOAT_COUNT`, `createLineVertexBuffer`/`updateLineVertexBuffer`, `createLinePipeline` (Task 7); `LessonPlayer` (Task 4); `axisAlignmentRotation`, `equatorialToEclipticPoleDirection` (existing, `solarSystem/poleOrientation.ts`).
- Produces: `equatorRingPoints`, `rotationAxisPoints`, `latitudeMarkerPoints`, `sunAngleRayPoints` (all `(earthWorld: mat4, earthRadius: number, ...) => Float32Array`, `learn/overlayGeometry.ts`) — consumed only by this task's own `main.ts` wiring; no later task depends on them.

- [ ] **Step 1: Write the failing tests for the pure geometry functions**

Create `packages/app/test/overlayGeometry.test.ts`:

```typescript
import { mat4 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import {
  equatorRingPoints,
  latitudeMarkerPoints,
  rotationAxisPoints,
  sunAngleRayPoints,
} from '../src/learn/overlayGeometry'

describe('overlay geometry (identity world transform, radius 1)', () => {
  const identity = mat4.create()

  it('equatorRingPoints traces a closed loop of radius `radius` in the local XY plane', () => {
    const points = equatorRingPoints(identity, 1, 32)
    expect(points.length).toBe((32 + 1) * 3) // closed loop: first point repeated at the end
    for (let i = 0; i <= 32; i++) {
      const x = points[i * 3]
      const y = points[i * 3 + 1]
      const z = points[i * 3 + 2]
      expect(Math.hypot(x, y)).toBeCloseTo(1, 5)
      expect(z).toBeCloseTo(0, 5)
    }
    // First and last point coincide (closed loop).
    expect(points[0]).toBeCloseTo(points[32 * 3], 5)
    expect(points[1]).toBeCloseTo(points[32 * 3 + 1], 5)
  })

  it('rotationAxisPoints returns two points along local +Z, extending past the poles', () => {
    const points = rotationAxisPoints(identity, 1, 1.3)
    expect(points.length).toBe(6)
    expect(points[0]).toBeCloseTo(0, 5)
    expect(points[1]).toBeCloseTo(0, 5)
    expect(points[2]).toBeCloseTo(-1.3, 5)
    expect(points[3]).toBeCloseTo(0, 5)
    expect(points[4]).toBeCloseTo(0, 5)
    expect(points[5]).toBeCloseTo(1.3, 5)
  })

  it('latitudeMarkerPoints places a small closed loop centered on the surface point for the given latitude', () => {
    // Equator (0 degrees): surface point should lie in the local XY plane (z ~ 0).
    const points = latitudeMarkerPoints(identity, 1, 0, 0.05, 16)
    expect(points.length).toBe((16 + 1) * 3)
    // The loop's average position should be close to the equator surface point (1, 0, 0) at
    // longitude 0 - not exact, since it's a ring around that point, but within markerRadius.
    let sumX = 0, sumY = 0, sumZ = 0
    for (let i = 0; i < 16; i++) {
      sumX += points[i * 3]
      sumY += points[i * 3 + 1]
      sumZ += points[i * 3 + 2]
    }
    expect(sumX / 16).toBeCloseTo(0, 1)
    expect(sumY / 16).toBeGreaterThan(0.9) // clusters near y=1 (the equator surface point at longitude 0)
    expect(sumZ / 16).toBeCloseTo(0, 1)
  })

  it('sunAngleRayPoints returns two points: the marker position, and a point toward the origin (Sun)', () => {
    const markerWorldPos: [number, number, number] = [1, 0, 0]
    const points = sunAngleRayPoints(markerWorldPos, 1.5)
    expect(points.length).toBe(6)
    expect(points[0]).toBeCloseTo(1, 5)
    expect(points[1]).toBeCloseTo(0, 5)
    expect(points[2]).toBeCloseTo(0, 5)
    // Second point is 1.5 units from the marker, toward the origin: (1 - 1.5, 0, 0) = (-0.5, 0, 0).
    expect(points[3]).toBeCloseTo(-0.5, 5)
    expect(points[4]).toBeCloseTo(0, 5)
    expect(points[5]).toBeCloseTo(0, 5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/app && npx vitest run test/overlayGeometry.test.ts`
Expected: FAIL — `Cannot find module '../src/learn/overlayGeometry'`.

- [ ] **Step 3: Implement the overlay geometry functions**

Create `packages/app/src/learn/overlayGeometry.ts`:

```typescript
import { mat4, vec3 } from 'gl-matrix'

// All four functions here take `earthWorld` (Earth's own world matrix - translation * tilt, no
// scale, since these already work in real-radius units) and return a flat [x0,y0,z0,x1,y1,z1,...]
// Float32Array in WORLD space, ready for createLineVertexBuffer/computeCumulativeLineDistances
// (see renderer/lineDistance.ts). Local-space points follow this project's established sphere
// convention: polar axis = local +Z (see geometry/sphere.ts's doc comment), matching
// axisAlignmentRotation's own contract.

function transformPoint(world: mat4, local: readonly [number, number, number]): [number, number, number] {
  const out = vec3.transformMat4(vec3.create(), local, world)
  return [out[0], out[1], out[2]]
}

// A closed loop of `segments` points tracing Earth's equatorial plane (local XY) at `radius`.
export function equatorRingPoints(earthWorld: mat4, radius: number, segments: number): Float32Array {
  const points = new Float32Array((segments + 1) * 3)
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    const local: [number, number, number] = [radius * Math.cos(angle), radius * Math.sin(angle), 0]
    const [x, y, z] = transformPoint(earthWorld, local)
    points[i * 3] = x
    points[i * 3 + 1] = y
    points[i * 3 + 2] = z
  }
  return points
}

// Two points along Earth's local +Z (its real rotation axis), extending `overshootFactor` times
// past each pole so the line is visibly longer than the globe itself.
export function rotationAxisPoints(earthWorld: mat4, radius: number, overshootFactor: number): Float32Array {
  const south = transformPoint(earthWorld, [0, 0, -radius * overshootFactor])
  const north = transformPoint(earthWorld, [0, 0, radius * overshootFactor])
  return new Float32Array([...south, ...north])
}

// A small closed loop centered on Earth's surface at `latitudeDegrees` (longitude fixed at the
// local +Y meridian, matching this project's sphere UV convention where phi=0 sits along +Y - see
// geometry/sphere.ts). Built from an orthonormal (tangent1, tangent2) basis perpendicular to the
// surface normal at that point, so the loop lies flat against the surface rather than being an
// arbitrary 3D circle.
export function latitudeMarkerPoints(
  earthWorld: mat4,
  radius: number,
  latitudeDegrees: number,
  markerRadius: number,
  segments: number,
): Float32Array {
  const colatitude = ((90 - latitudeDegrees) * Math.PI) / 180 // 0 at north pole, PI at south pole
  const localNormal: [number, number, number] = [0, Math.sin(colatitude), Math.cos(colatitude)]
  const localSurfacePoint: [number, number, number] = [
    localNormal[0] * radius,
    localNormal[1] * radius,
    localNormal[2] * radius,
  ]
  // Gram-Schmidt against local +X, falling back to local +Y only at the poles (where normal is
  // parallel to +Z, making +X a valid, non-degenerate reference at every other latitude).
  const reference: [number, number, number] = Math.abs(localNormal[2]) > 0.999 ? [0, 1, 0] : [1, 0, 0]
  const dot = reference[0] * localNormal[0] + reference[1] * localNormal[1] + reference[2] * localNormal[2]
  const t1Unnormalized: [number, number, number] = [
    reference[0] - dot * localNormal[0],
    reference[1] - dot * localNormal[1],
    reference[2] - dot * localNormal[2],
  ]
  const t1Length = Math.hypot(...t1Unnormalized)
  const tangent1: [number, number, number] = [t1Unnormalized[0] / t1Length, t1Unnormalized[1] / t1Length, t1Unnormalized[2] / t1Length]
  const tangent2: [number, number, number] = [
    localNormal[1] * tangent1[2] - localNormal[2] * tangent1[1],
    localNormal[2] * tangent1[0] - localNormal[0] * tangent1[2],
    localNormal[0] * tangent1[1] - localNormal[1] * tangent1[0],
  ]

  const points = new Float32Array((segments + 1) * 3)
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    const local: [number, number, number] = [
      localSurfacePoint[0] + markerRadius * (Math.cos(angle) * tangent1[0] + Math.sin(angle) * tangent2[0]),
      localSurfacePoint[1] + markerRadius * (Math.cos(angle) * tangent1[1] + Math.sin(angle) * tangent2[1]),
      localSurfacePoint[2] + markerRadius * (Math.cos(angle) * tangent1[2] + Math.sin(angle) * tangent2[2]),
    ]
    const [x, y, z] = transformPoint(earthWorld, local)
    points[i * 3] = x
    points[i * 3 + 1] = y
    points[i * 3 + 2] = z
  }
  return points
}

// Two points: the latitude marker's own world position, and a point `length` world units toward
// the Sun (always at the world origin in this app - see main.ts's sunWorld comment).
export function sunAngleRayPoints(markerWorldPos: readonly [number, number, number], length: number): Float32Array {
  const distanceToSun = Math.hypot(markerWorldPos[0], markerWorldPos[1], markerWorldPos[2])
  const direction: [number, number, number] =
    distanceToSun < 1e-9
      ? [0, 0, 1] // degenerate (marker at the origin) - arbitrary direction, never hit in practice
      : [-markerWorldPos[0] / distanceToSun, -markerWorldPos[1] / distanceToSun, -markerWorldPos[2] / distanceToSun]
  const end: [number, number, number] = [
    markerWorldPos[0] + direction[0] * length,
    markerWorldPos[1] + direction[1] * length,
    markerWorldPos[2] + direction[2] * length,
  ]
  return new Float32Array([...markerWorldPos, ...end])
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/app && npx vitest run test/overlayGeometry.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Set up overlay-line GPU resources and wire them into the render pass in `main.ts`**

Add the import:

```typescript
import { equatorRingPoints, latitudeMarkerPoints, rotationAxisPoints, sunAngleRayPoints } from './learn/overlayGeometry'
```

Add, after the `orbitPathRenderables` construction:

```typescript
  // Four overlay lines for learn mode's seasons lesson: equator, rotation axis, latitude marker,
  // sun-angle ray. All four share one dashed-line uniform buffer shape/bind-group-layout, so they
  // reuse the same small helper for setup.
  const OVERLAY_LINE_IDS = ['equator', 'axis', 'latitude-marker', 'sun-ray'] as const
  type OverlayLineId = (typeof OVERLAY_LINE_IDS)[number]
  interface OverlayLineRenderable {
    id: OverlayLineId
    vertexBuffer: GPUBuffer
    distanceBuffer: GPUBuffer
    uniformBuffer: GPUBuffer
    bindGroup: GPUBindGroup
    pointCount: number
  }
  function createOverlayLineRenderable(id: OverlayLineId, initialPoints: Float32Array): OverlayLineRenderable {
    const vertexBuffer = createLineVertexBuffer(device, initialPoints)
    const distanceBuffer = createLineVertexBuffer(device, computeCumulativeLineDistances(initialPoints))
    const uniformBuffer = device.createBuffer({
      label: `${id} overlay uniforms`,
      size: LINE_UNIFORM_FLOAT_COUNT * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const bindGroup = device.createBindGroup({
      layout: linePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })
    return { id, vertexBuffer, distanceBuffer, uniformBuffer, bindGroup, pointCount: initialPoints.length / 3 }
  }
  function updateOverlayLineRenderable(renderable: OverlayLineRenderable, points: Float32Array): void {
    updateLineVertexBuffer(device, renderable.vertexBuffer, points)
    updateLineVertexBuffer(device, renderable.distanceBuffer, computeCumulativeLineDistances(points))
    renderable.pointCount = points.length / 3
  }
  const overlayLineRenderables: Record<OverlayLineId, OverlayLineRenderable> = {
    equator: createOverlayLineRenderable('equator', new Float32Array(3)),
    axis: createOverlayLineRenderable('axis', new Float32Array(6)),
    'latitude-marker': createOverlayLineRenderable('latitude-marker', new Float32Array(3)),
    'sun-ray': createOverlayLineRenderable('sun-ray', new Float32Array(6)),
  }
  const OVERLAY_DASH_LENGTH = 0.15 // world units per dash+gap period, tuned visually at Compact scale
  const OVERLAY_DASH_SPEED = 0.4 // world units per second the dash pattern travels ("marching ants")
  const OVERLAY_DASH_DUTY_CYCLE = 0.6
  const OVERLAY_COLORS: Record<OverlayLineId, [number, number, number, number]> = {
    equator: [0.88, 0.37, 0.63, 0.85],
    axis: [0.88, 0.75, 0.37, 0.85],
    'latitude-marker': [0.37, 0.88, 0.63, 0.9],
    'sun-ray': [0.88, 0.75, 0.37, 0.55],
  }
```

Add the per-frame update, inside `frame()`, right after the existing planet loop (`for (const { renderable, x: sx, y: sy, z: sz, radius } of planetFrameData) { ... }` block) and before the `if (showOrbitPaths) { ... }` block:

```typescript
    if (learnModeController.currentMode === 'learn') {
      const earthEntry = planetFrameData.find((entry) => entry.renderable.definition.id === 'earth')
      if (earthEntry) {
        const earthPoleDirection = equatorialToEclipticPoleDirection(
          earthEntry.renderable.definition.poleRightAscensionDegrees,
          earthEntry.renderable.definition.poleDeclinationDegrees,
        )
        const earthTilt = axisAlignmentRotation(earthPoleDirection)
        const earthWorld = mat4.multiply(mat4.create(), mat4.fromTranslation(mat4.create(), [earthEntry.x, earthEntry.y, earthEntry.z]), earthTilt)
        const latitude = currentLatitudePreset()
        const ringRadius = earthEntry.radius * 1.02
        const markerWorld = latitudeMarkerPoints(earthWorld, ringRadius, latitude.latitudeDegrees, earthEntry.radius * 0.04, 16)
        const markerCenterWorld: [number, number, number] = [
          (markerWorld[0] + markerWorld[3]) / 2,
          (markerWorld[1] + markerWorld[4]) / 2,
          (markerWorld[2] + markerWorld[5]) / 2,
        ]
        const now = performance.now() / 1000
        const pulse = 1 + 0.15 * Math.sin(now * 3)
        const geometryById: Record<OverlayLineId, Float32Array> = {
          equator: equatorRingPoints(earthWorld, ringRadius, 64),
          axis: rotationAxisPoints(earthWorld, earthEntry.radius, 1.3),
          'latitude-marker': latitudeMarkerPoints(earthWorld, ringRadius, latitude.latitudeDegrees, earthEntry.radius * 0.04 * pulse, 16),
          'sun-ray': sunAngleRayPoints(markerCenterWorld, earthEntry.radius * 1.5),
        }
        // Unlike every other worldViewProjection in this file, no separate world matrix multiply
        // is needed here: overlayGeometry.ts's functions already compute their points directly in
        // world space (they take `earthWorld` themselves), so `worldViewProjection` for these
        // uniforms really is just `viewProjection`, not `projection * view * world`.
        for (const id of OVERLAY_LINE_IDS) {
          const renderable = overlayLineRenderables[id]
          updateOverlayLineRenderable(renderable, geometryById[id])
          const uniforms = new Float32Array(LINE_UNIFORM_FLOAT_COUNT)
          uniforms.set(viewProjection, 0)
          uniforms.set(OVERLAY_COLORS[id], 16)
          uniforms.set([OVERLAY_DASH_LENGTH, (now * OVERLAY_DASH_SPEED) % OVERLAY_DASH_LENGTH, OVERLAY_DASH_DUTY_CYCLE, 1.0], 20)
          device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
        }
      }
    }
```

Add the draw calls, in the render-pass section, immediately after the existing orbit-path draw block and before `if (sunFlareVisible) { ... }`:

```typescript
    if (learnModeController.currentMode === 'learn') {
      pass.setPipeline(linePipeline)
      for (const id of OVERLAY_LINE_IDS) {
        const renderable = overlayLineRenderables[id]
        pass.setVertexBuffer(0, renderable.vertexBuffer)
        pass.setVertexBuffer(1, renderable.distanceBuffer)
        pass.setBindGroup(0, renderable.bindGroup)
        pass.draw(renderable.pointCount)
      }
    }
```

- [ ] **Step 7: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 8: Run the full test suite**

Run: `npm run test`
Expected: all succeed.

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all PASS (zero `pageerror`s in particular, confirming the overlay uniform/vertex-buffer wiring is valid — a mismatch here surfaces as a WebGPU validation error).

- [ ] **Step 9: Extend the e2e test for overlay rendering**

Add to `packages/app/e2e/learnMode.spec.ts`:

```typescript
test('globe overlays render without WebGPU errors across a chapter and latitude change', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.waitForTimeout(1500)

  await page.locator('#lesson-next-chapter').click()
  await page.locator('.hud-latitude-chip', { hasText: 'Arctic Circle' }).click()
  await page.locator('#lesson-scrub').fill('0.9')
  await page.waitForTimeout(1500)

  expect(errors).toEqual([])
})
```

- [ ] **Step 10: Run the new e2e test**

Run: `cd packages/app && npx playwright test e2e/learnMode.spec.ts`
Expected: PASS (5/5).

- [ ] **Step 11: Manual visual check**

Run: `cd packages/app && npm run dev`. Enter the seasons lesson. Confirm: a dashed pink equator ring, a dashed amber axis line through both poles, a small green pulsing marker at the selected latitude, and a faint dashed amber ray from the marker toward the Sun, all animating with a "marching ants" motion. Switch latitude presets and scrub within a chapter — the marker and ray should move accordingly. Confirm the dashes are readable, not distractingly fast or slow (tune `OVERLAY_DASH_SPEED`/`OVERLAY_DASH_LENGTH` if needed — this is expected visual tuning, not a correctness issue).

- [ ] **Step 12: Commit**

```bash
git add packages/app/src/learn/overlayGeometry.ts packages/app/src/main.ts \
  packages/app/test/overlayGeometry.test.ts packages/app/e2e/learnMode.spec.ts
git commit -m "Add animated dashed globe overlays: equator, rotation axis, latitude marker, sun-angle ray

All four reuse Task 7's extended line pipeline (dashParams.w = 1),
computed each frame in world space from Earth's own lesson-driven
transform so they never drift out of sync with the rendered globe."
```

---

### Task 9: Full lesson-flow e2e test + roadmap cleanup

**Files:**
- Create: `packages/app/e2e/seasonsLessonFlow.spec.ts`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: everything from Tasks 1-8.
- Produces: nothing consumed by later tasks — this is a coverage/documentation task.

- [ ] **Step 1: Write a single end-to-end test covering the full lesson flow**

Create `packages/app/e2e/seasonsLessonFlow.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

test('full seasons lesson flow: enter, all 5 chapters, latitude change, scrub, exit', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')

  const expectedChapterIds = ['intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice']
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', expectedChapterIds[0])

  for (let i = 1; i < expectedChapterIds.length; i++) {
    await page.locator('#lesson-next-chapter').click()
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', expectedChapterIds[i])
    await page.waitForTimeout(300) // let each chapter's camera fly-to tween start without piling up
  }
  await expect(page.locator('#lesson-next-chapter')).toBeDisabled()

  await page.locator('.hud-latitude-chip', { hasText: 'Tropic of Capricorn' }).click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-latitude-id', 'tropic-of-capricorn')

  await page.locator('#lesson-scrub').fill('0.3')
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-scrub-t', '0.3')

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  expect(errors).toEqual([])
})
```

- [ ] **Step 2: Run the new e2e test**

Run: `cd packages/app && npx playwright test e2e/seasonsLessonFlow.spec.ts`
Expected: PASS.

- [ ] **Step 3: Remove the roadmap's "Earth seasons visualization" entry**

In `docs/roadmap.md`, delete the entire `## Earth seasons visualization` section (its `**What**`/`**Approach**`/`**Data needed**` block) — it's now implemented.

- [ ] **Step 4: Commit**

```bash
git add packages/app/e2e/seasonsLessonFlow.spec.ts docs/roadmap.md
git commit -m "Add a full seasons-lesson-flow e2e test; remove the now-implemented roadmap entry"
```

---

### Task 10: Final verification pass

**Files:** none — verification only.

- [ ] **Step 1: Full clean build from scratch**

Run: `rm -rf packages/app/dist packages/engine/build && npm run build`
Expected: succeeds with no errors.

- [ ] **Step 2: Full unit test suite**

Run: `npm run test`
Expected: all pass (engine, app, data-pipeline workspaces).

- [ ] **Step 3: Full e2e suite, serially**

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all pass, including every spec added in Tasks 1-9.

- [ ] **Step 4: Manual walkthrough of the full lesson**

Run: `cd packages/app && npm run dev`. From a fresh page load:
1. Confirm free-roam mode looks and behaves exactly as before this plan (dock, Display panel, drag-to-orbit, search).
2. Click "Learn" → "Why does Earth have seasons?" and step through all 5 chapters, reading the text at each. Confirm the camera framing is legible for each (Earth's tilt visible against a wide backdrop in Intro; the day/night terminator and axis tilt clearly visible relative to the Sun direction in each equinox/solstice chapter).
3. Try every latitude preset on at least one solstice chapter; confirm text and marker position both update sensibly (e.g. the Arctic Circle marker should sit near the top of the globe, the Antarctic Circle marker near the bottom).
4. Scrub within a chapter; confirm Earth's rendered day/night terminator visibly shifts as the date moves through the chapter's range.
5. Exit the lesson; confirm the dock, camera drag, and search are all fully restored, and the simulation clock/scale are exactly as they were before entering (unaffected by the lesson, since only Earth's own rendering was ever redirected).
6. Confirm the browser console shows no errors at any point in this walkthrough.

- [ ] **Step 5: No commit** — this task is verification-only. If Step 4 surfaces a problem, fix it as a new small commit on top of the relevant earlier task, re-run this task's steps, and only consider the plan complete once they pass clean.

---

## Self-Review Notes

- **Spec coverage:** §2 scope items → Tasks 1 (mode switch), 2-3 (lesson/chapter types + content), 4 (chapter nav/scrub UI), 5 (locked camera), 6 (text/latitude UI), 7-8 (dashed overlays). §3 (mode switch/state, Display relocation, camera lock) → Task 1 + Task 5. §4 (chapter animation/scrub) → Tasks 2, 4, 5 (Earth's date-driven rendering). §5 (overlays) → Tasks 7-8. §6 (latitude picker) → Task 6. §7 (content structure) → Task 3. §8 (data model) → Task 2, with the documented target/radius runtime-derivation refinement. §9 (testing) → every task's own Vitest/Playwright/manual-check steps, consolidated in Task 9-10. §10 (files touched) → matches the files actually listed per task above.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code. The one explicit judgment call flagged inline (Task 8's dead `wvp` variable) is resolved with an explicit instruction to delete it, not left as an open question.
- **Type consistency:** `LessonPlayer`'s getters (`currentChapter`, `currentChapterIndex`, `scrubT`, `currentDate`, `hasPreviousChapter`, `hasNextChapter`) are defined once in Task 4 and used identically in Tasks 5-6. `ChapterCameraFraming`'s fields (`date`, `radiusMultiplier`, `azimuth`, `elevation`, `upAxis`) are defined in Task 2 and consumed with the same names in Task 5's `flyToCurrentChapterFraming`. `LINE_UNIFORM_FLOAT_COUNT` (Task 7) is used identically at every allocation/write site added in Tasks 7-8. `OverlayLineId`'s four values (`'equator' | 'axis' | 'latitude-marker' | 'sun-ray'`) are used consistently across `overlayLineRenderables`, `OVERLAY_COLORS`, and the per-frame update/draw loops, all within Task 8.
