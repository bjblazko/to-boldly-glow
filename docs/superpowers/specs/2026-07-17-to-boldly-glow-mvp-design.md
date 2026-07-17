# To Boldly Glow — MVP Design Specification

Status: Approved (MVP) — 2026-07-17
Companion document: [Roadmap](../../roadmap.md) (deferred features, lighter detail)

## 1. Purpose & Vision

To Boldly Glow is a free, open-source, browser-based planetarium and solar-system visualizer for
education. It shows the solar system in 3D with historically- and scientifically-accurate
positions, lets the user freely explore in space and time, and explains what they're looking at.
It must run entirely client-side, work offline once installed, and be legally safe to publish
under an open license using only public-domain/openly-licensed data.

This document specifies the MVP (v1) in full implementation-ready detail. Features intentionally
deferred beyond MVP are named (not fully specified) in the companion Roadmap document, so later
work doesn't need to be re-derived from scratch.

## 2. Scope

**In scope for MVP:**
- 3D view of the Sun, the 8 planets, and major moons (Earth's Moon, Jupiter's Galilean moons,
  Saturn's Titan)
- Realistic ⇄ illustrative scale slider
- Free camera (position, rotation, FOV) with mouse/keyboard/touch input and a few preset views
- Time control: play/pause, jog/shuttle scrub, preset acceleration steps, reverse time
- Real star background (Yale Bright Star Catalog) and a toggleable constellation line overlay
  (orientation/historical framing only, no astrology)
- Click-to-explain popups on every visible body
- An About/Credits dialog listing data sources and a thank-you note
- Offline installability (PWA + service worker)
- English + German UI and content

**Explicitly out of scope for MVP** (see `docs/roadmap.md` for details on each):
seasons visualization, Moon phase/cycle deep-dive, solar/lunar eclipses, ISS and notable
satellites, probes (Voyager 1/2 etc.) and comets, speed-of-light/travel-time calculator,
gravitational field visualization, Kuiper Belt/apogee-perigee/TLI explainer content, mobile/touch
*refinement* beyond basic gestures, WebGL2 fallback.

## 3. Architecture

### 3.1 Repository layout (npm workspaces)

- `packages/engine` — AssemblyScript, compiled to WASM. Pure math only: VSOP87 (planetary
  positions) and ELP2000 (lunar position) series evaluation, Julian date/time conversions,
  coordinate frame transforms (heliocentric ecliptic ↔ camera-relative). No rendering, no I/O —
  numbers in, numbers out. This isolation makes it fully unit-testable without a browser or GPU.
- `packages/app` — TypeScript. WebGPU renderer, camera controller, time controller, plain
  DOM-based UI (popups, HUD, jog/shuttle, About dialog), i18n content (EN/DE), PWA/service worker
  shell.
- `packages/data-pipeline` — one-off Node scripts, not shipped and not run at runtime. Converts the
  Yale Bright Star Catalog and a constellation-line dataset into a compact bundled asset checked
  into `packages/app`'s assets folder.

### 3.2 Rendering: WebGPU only

No WebGL2 fallback. Browsers without WebGPU support see a clear "unsupported browser" message
(see §6). This is an accepted, deliberate scope decision to keep the renderer simple and unblock
use of compute shaders later.

### 3.3 Floating-origin rendering (precision)

WebGPU shaders operate in float32, but real solar-system distances (measured in km/AU) exceed
float32's usable precision, causing visible jitter at planetary/interplanetary scale. To avoid
this: all simulation state (positions, time) is stored and evaluated in float64 on the CPU/WASM
side. Each frame, the app computes every body's position *relative to the camera* (a "floating
origin") before converting to float32 for the GPU upload. This is the standard technique used by
space simulators (e.g. Space Engine, Elite Dangerous) and is what makes an accurate "realistic
scale" mode viable.

### 3.4 Build tooling

Vite for `packages/app` (dev server + bundling). The AssemblyScript compiler (`asc`) builds
`packages/engine` to `.wasm`, wired into the Vite dev/build pipeline via a plugin so `npm run dev`
and `npm run build` build both packages together.

## 4. Components

### 4.1 Camera controller
Free-fly camera: position and rotation via mouse-drag + WASD-style keyboard movement on desktop,
and drag/pinch gestures on touch. An FOV slider behaves like a camera lens control. A small set of
preset views (top-down solar system overview, "follow selected body") are provided as convenient
starting points; the user can break into manual control from any preset at any time.

### 4.2 Time controller
A simulation clock fully decoupled from wall-clock time.
- Play/pause.
- Jog/shuttle dial: drag to scrub; the further from center, the faster the simulated time moves
  (mirrors a video editor's J/K/L shuttle control).
- Preset acceleration steps: real-time, 1 min/s, 1 hr/s, 1 day/s, 1 month/s, 1 year/s.
- Time may run in reverse (orbital mechanics are time-symmetric, so this is physically valid).

### 4.3 Scale toggle
Two named endpoints with continuous interpolation between them via a slider (not a hard switch):
- **Realistic** — true-to-scale distances and sizes. Planets render as near-invisible points at
  true separation; this is itself an educational point about the emptiness of space.
- **Explorer** — distances compressed (logarithmically) and body sizes exaggerated so spatial
  relationships are visible at a glance.
The slider lets the user feel the transition and understand what's being distorted, rather than
silently swapping between two disconnected views.

### 4.4 Renderer
- Textured spheres with basic lighting (the Sun is the sole light source; correct day/night
  terminator on each body) for the Sun, planets, and included moons.
- Point-sprite stars rendered from the bundled catalog asset.
- Optional orbit-path lines (toggleable).
- Optional constellation-line overlay with name labels (toggleable), explicitly framed in UI copy
  as historical/navigational reference — not astrology.

### 4.5 Info popups
Clicking any rendered body opens a panel with short, **originally-written** explanatory text (not
copied verbatim from NASA fact sheets, to keep licensing simple and avoid any attribution
ambiguity) plus key stats: distance from Sun, size, orbital period. Content is authored in both
English and German.

### 4.6 About / Credits dialog
Reachable from the HUD. Lists every data/texture/library source used, its license, and a link/
citation, plus a short thank-you note to the projects and maintainers whose public-domain or
openly-licensed work made the project possible. This is the single source of truth for provenance
and doubles as the content backing a root-level `CREDITS.md`.

### 4.7 State management
A single plain `SimulationState` object (current time, scale-blend factor, selected entity, camera
pose) with a minimal observer/pub-sub mechanism so the renderer and UI both react to state changes.
No state-management framework or library — plain objects and callbacks only, consistent with the
project's "simple, explicit code" philosophy.

### 4.8 Internationalization
UI chrome and popup/About content are authored in EN and DE from MVP, with a language switcher in
the HUD. Strings are kept out of logic code (a simple key-based lookup) so more languages can be
added later without restructuring.

## 5. Data & Licensing

- **Planet/moon positions**: computed at runtime from VSOP87 (planets) and ELP2000 (Moon)
  analytical series. These are published scientific algorithms; their coefficients are treated as
  public-domain scientific data. No runtime network fetch is required — cite the source theories
  in the About dialog.
- **Star catalog**: Yale Bright Star Catalog (public domain), converted once by
  `packages/data-pipeline` into a compact bundled asset (~9,000 stars — sufficient for naked-eye
  realism, small enough to ship inline for offline use).
- **Constellation lines**: a public-domain/CC0 constellation-line dataset, bundled alongside the
  star catalog asset.
- **Textures**: public-domain NASA/JPL/USGS planet and Moon imagery, at 2K resolution to keep the
  offline/PWA bundle size reasonable.
- **Attribution**: every data/texture source and its license is listed in `CREDITS.md` and
  surfaced in-app via the About dialog (§4.6) — this is the actual safeguard against data-provenance
  legal risk, independent of the code license.
- **Code license**: MIT (see root `LICENSE`). Chosen because: (a) its liability-disclaimer clause
  protects the author from damages claims exactly as well as Apache-2.0/GPL-3.0 would; (b) the
  project's copyright/patent risk surface is dominated by data provenance, not code licensing, so
  Apache-2.0's patent-retaliation clause adds negligible practical value here; (c) MIT is simplest
  and most widely understood for a hobby/education project.

## 6. Error Handling

- **WebGPU unsupported** (`navigator.gpu` missing, or adapter request fails): detected on load,
  shows a plain full-page message explaining the requirement with a link to browsers that support
  WebGPU. No silent failure, no blank canvas.
- **WASM load failure**: surfaced as a visible error state — without the engine module nothing can
  be positioned, so failing silently would be worse than an explicit error.
- **Asset load failure** (texture or catalog asset missing, e.g. a corrupted PWA cache entry):
  degrades gracefully — falls back to an untextured/flat-shaded sphere, or a solid-color star
  point, rather than blocking the whole app.

## 7. Testing & CI

- **Unit tests (Vitest)**: engine math (VSOP87/ELP2000 position functions, Julian date
  conversions, coordinate transforms), camera math, time-controller logic (scale/pause/seek),
  scale-toggle interpolation. All pure functions, testable in isolation without a browser/GPU.
- **Integration tests (Playwright)**: app boots and renders a non-blank WebGPU canvas; clicking a
  body opens its popup with expected content; time controls change simulated time; the EN/DE
  language switcher swaps visible text; the About dialog opens and lists credits.
- **CI**: a GitHub Actions workflow runs lint, typecheck, and both test suites on every push/PR.

## 8. Project Conventions

- **Changelog**: `CHANGELOG.md` follows the Keep a Changelog format, updated per release.
- **Versioning**: Semantic Versioning.

## 9. Roadmap Pointer

Features deferred beyond this MVP are named (with enough detail to resume without re-deriving) in
`docs/roadmap.md`. Each entry there is expected to become its own full design spec, following this
same brainstorming → spec → plan process, before implementation begins.
