# HUD one bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scattered HUD (welcome card, top tabs, top icons, camera panel, lesson zoom corner, mission bar) with one bottom bar and a start page, as in click-dummy variant A.

**Architecture:** One `<nav id="hud-bar">` holds every control in groups; `body[data-context]` (explore | lesson | mission | tour) decides which groups show. A start page (`#start-page`) hosts the grand tour hero, the tour cards and the lesson library; the existing `TourLibrary` and `LessonLibrary` render into it. Settings become "Mehr" (the existing settings popover, opened from the bar, plus About / controls / hide). Search is the command palette, opened from the bar and Ctrl+K.

**Tech Stack:** TypeScript, plain DOM, CSS (hud.css), Vitest (node), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-hud-one-bar-design.md`

## Global Constraints

- Same glass/dichroic HUD style; no new visual language.
- Nothing flies before a click; the grand tour starts only from a click (sound needs it).
- Keep: fps display, scale switch, follow/stop-following, time shuttle, lesson sort and chapter menus, text collapse, touch flight pad, hide UI (H), ?, Ctrl+K, Esc.
- Start page opens by itself only on the very first visit (localStorage), and never with `?tour=off`.
- en and de texts for everything new; delete keys of removed pieces.
- ESLint: max-statements 15, max-lines 300, max-lines-per-function 40.

## Review Focus

- Leaving a lesson/tour from the bar returns to explore with the explore groups visible and the camera input back on.
- Starting a tour/lesson from the start page while another runs ends the other one first.
- Esc closes the open panel / start page / palette, one at a time, and still stops a mission tour.
- Phone width (390 px): the bar fits (icons only) and nothing overlaps the lesson text.
- Hidden interface (H) hides the bar and the chip; the show button brings them back.

---

### Task 1: First-visit start page and bar context (pure logic)

**Files:**
- Modify: `packages/app/src/app/startupTour.ts` → `startPageWanted(search: string, seen: boolean): boolean`; `markStartPageSeen(storage)` / `startPageSeen(storage)` with key `tbg.startPageSeen`
- Create: `packages/app/src/hud/barContext.ts` → `type BarContext = 'explore' | 'lesson' | 'mission' | 'tour'`; `barContext(state: { lesson: boolean; mission: boolean; tour: boolean }): BarContext` (lesson wins, then mission, then tour); `class BarContextView { constructor(body: HTMLElement); set(part: 'lesson'|'mission'|'tour', on: boolean): void; get current(): BarContext }` writing `body.dataset.context`
- Test: `packages/app/test/startupTour.test.ts`, `packages/app/test/barContext.test.ts`

- [ ] Tests: `startPageWanted('', false)` true; `('?tour=off', false)` false; `('', true)` false; storage round trip (a Map-backed fake); storage throwing → seen=false and mark doesn't throw. `barContext` for all four precedences.
- [ ] Run, see them fail; implement; run green; commit.

### Task 2: The bar, start page and Mehr markup + CSS + i18n

**Files:** `packages/app/index.html`, `packages/app/src/hud/hud.css`, `packages/app/src/i18n/messages/{en,de}/ui.ts`

- Bar `<nav id="hud-bar" class="hud-bar">`: `#start-btn` (⌂ Start) | explore group (`#search-btn` Suchen, `.hud-camera-switch` with `#camera-orbit-btn` / `#camera-fly-btn`, `[data-panel=time]`, `[data-panel=view]`) | lesson group (`#lesson-sort-btn`, `#lesson-prev-chapter`, `#lesson-chapter-btn`, `#lesson-next-chapter`, `#lesson-autoplay`, `#lesson-view-reset`, `[data-panel=view]`) | mission group (`#mission-prev`, `#mission-play`, `#mission-next`, `#mission-timeline`) | `#settings-btn` (Mehr) | `#leave-btn` (Verlassen / Tour beenden).
- Groups show by `body[data-context]`; `#leave-btn` hidden in explore.
- Start page `#start-page` (role dialog): hero with `#start-language`, `#start-voice`, `#start-grand` (primary), hint; "Weitere Touren" `#tour-library-list`; "Lektionen" `#library-search` + `#library-topics`; `#start-explore`; close `#start-close`.
- Mehr: existing `#settings-panel` re-anchored bottom-right above the bar; append buttons `#controls-help`, `#about-btn`, `#hide-ui-btn`.
- Chip `#beta-chip` top left ("Beta · kompakter Maßstab" while compact, "Beta" otherwise) inside `.hud-beta-note` with `#voice-status`.
- Follow chip `#follow-indicator` (with label + `#follow-stop-button`) moves above the bar.
- Remove: welcome card + pill, `.hud-modes`, `.hud-top-actions` (except `#show-ui-btn`), explore + lesson docks, camera and find sheet panels, `#lesson-view-controls`, `#tour-library` / `#lesson-library` dialogs, `#mission-close`, `.hud-mission-bar`.
- Phone (≤ 600px): bar labels hidden, bar scrolls horizontally.

- [ ] Write markup, CSS, i18n; typecheck after Task 3 (wiring breaks until then); commit together with Task 3.

### Task 3: Wiring

**Files:** `app/app.ts`, `app/explorer.ts`, `app/tours.ts`, delete `app/welcomeCard.ts`, `hud/modeButtons.ts`; create `hud/startPage.ts`; modify `hud/cameraControls.ts`, `hud/dockUI.ts` (`PanelName = 'time' | 'view'`), `learn/learnUi.ts`, `learn/lessonViewControls.ts` (reset only), `tours/tourUi.ts`, `tours/tourLibrary.ts` (no grand card), `missions/missionTourUi.ts` (no close button), `app/paletteItems.ts` (+ tours), `hud/commandPalette.ts` (match detail too; group 'Tours').

- `StartPage`: `open()`, `close()`, `isOpen`, `toggle()`; Esc / close / scene press close it; opening closes the dock panel and settings. Picks: grand → narrated tour; voyager → mission; lesson → `learnUi.openLesson`; explore → close (+ orbit paths and labels on, as the welcome card did).
- `CameraControls`: orbit/fly buttons set the mode, `aria-pressed` follows `showMode`; no tour button; any manual input still stops the narrated tour.
- Explorer: no silent flyby (`startTour` without route removed from the surface).
- `#leave-btn`: lesson → `learnUi.explore()`; mission → `missions.session.stop()`; tour → `camera.stopTour()`.
- `BarContextView` fed by lesson session start/end, `missions.activeChanged`, `narratedTourChanged`.
- First visit: on first frame, if `startPageWanted(search, startPageSeen(localStorage))` open the start page and mark seen.
- Palette: `#search-btn` opens it; items gain 'Tours' (grand, voyager1, voyager2); filter also matches `detail` (moons by planet name).
- Test: `test/commandPalette.test.ts` — detail match ("Jupiter" finds a moon whose detail is "Moon of Jupiter"); Tours group ordered after Lessons.

- [ ] Unit tests red → implement → green; lint, typecheck, full unit suite; commit.

### Task 4: End-to-end tests follow the new HUD; run locally

**Files:** `e2e/support/hud.ts` (openLesson via `#start-btn`; exitLesson via `#leave-btn`), every spec listed by `grep` on the removed IDs; delete `e2e/cameraTour.spec.ts` flyby cases (keep stop-on-input for the narrated tour if covered elsewhere).

- [ ] Update specs; run the HUD specs (modeSwitch, learnMode, narratedTour, about, interfaceVisibility, scaleNote, entitySearch, freeFlight, controlsOverlay, i18n, dockSheet) and compare failures against the known headless-WebGPU ones.
- [ ] Screenshots at 1440×900 and 390×844 (explore, start page, lesson, mission tour, Mehr); fix what looks wrong; commit.
- [ ] Preview on http://localhost:5199/.
