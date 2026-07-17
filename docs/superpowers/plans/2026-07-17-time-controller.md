# Time Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `main.ts`'s hardcoded `new Date()` (always "now") with a real simulation clock that
can be paused, sped up via presets or a continuous jog/shuttle slider, and reversed — making Earth's
orbital motion around the Sun actually visible instead of frozen at the current moment.

**Architecture:** A `SimulationClock` (pure, GPU/DOM-free, fully unit-testable) tracks simulated time
independently of wall-clock time, advanced each frame by `update(realDeltaSeconds)`. A shuttle-slider
value maps to a time scale through a pure, testable exponential curve (fine control near the center,
fast rates at the extremes — the "shuttle" feel), and preset buttons offer quick jumps to named rates.
Both the shuttle and the presets just call `clock.setTimeScale(...)` — there's one source of truth for
the current rate. `TimeControlUI` wires DOM elements to the clock (untested, like `CameraInputController`
— pure glue with no logic surface of its own). `main.ts` calls `clock.update(deltaSeconds)` once per
frame (reusing the same per-frame delta already computed for the camera) and reads
`clock.getCurrentDate()` instead of calling `new Date()`.

**Tech Stack:** No new dependencies. Plain DOM elements (buttons, a `<select>`, an `<input type="range">`
as the shuttle), matching the existing camera-controller UI pattern.

## Context: scope decisions

**The shuttle slider is continuous and rate-based, not a scrub-to-a-specific-date control.** True
video-editor jog/shuttle wheels control *playback rate and direction* from a spring-loaded or
free-floating dial position — they don't let you drag to an arbitrary absolute timestamp. This plan
follows that model: the shuttle sets a rate (positive = forward, negative = reverse, magnitude scales
exponentially with distance from center), and time keeps advancing at that rate once you let go
(no snap-back). Jumping to an arbitrary specific date (a date picker, or "jump to today") is a
different, separate feature, not included here.

**Presets and the shuttle are two independent ways to set the same one rate value**, not
synchronized displays of each other. Touching either one sets `clock.setTimeScale(...)`; the plan
doesn't try to move the shuttle handle to "match" a preset selection, since the shuttle's exponential
mapping makes that inversion more complex than it's worth for a first pass. This is a minor,
acceptable UX rough edge, not a functional gap.

**No new dependencies, no framework** — same constraints as every prior UI-layer plan.

## Global Constraints

(Copied verbatim from the design spec and prior plans; every task below implicitly inherits these.)

- UI layer: plain TypeScript + DOM, no framework.
- Testing: Vitest for pure logic, no automated test for pure DOM-event-wiring code (established
  precedent: `CameraInputController` has none either, for the same reason — verified manually
  instead).
- No new npm dependencies.
- `packages/engine`'s exports are consumed as-is and unaffected by this plan.

---

### Task 1: Simulation Clock

**Files:**
- Create: `packages/app/src/time/simulationClock.ts`
- Test: `packages/app/test/simulationClock.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SimulationClock` class (`update`, `getCurrentDate`, `play`, `pause`, `isPaused`,
  `setTimeScale`, `getTimeScale`), `TIME_SCALE_PRESETS` array, `shuttleValueToTimeScale(value,
  maxSecondsPerSecond)` function. Task 2's `TimeControlUI` and Task 3's `main.ts` both consume these
  directly.

- [ ] **Step 1: Write the failing tests**

`packages/app/test/simulationClock.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { SimulationClock, shuttleValueToTimeScale, TIME_SCALE_PRESETS } from '../src/time/simulationClock'

describe('SimulationClock', () => {
  it('starts at the given initial date', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime())
  })

  it('advances simulated time by realDeltaSeconds at timeScale 1', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start, 1)
    clock.update(10)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime() + 10000)
  })

  it('does not advance while paused', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start, 1)
    clock.pause()
    clock.update(100)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime())
  })

  it('resumes advancing after play()', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start, 1)
    clock.pause()
    clock.update(100)
    clock.play()
    clock.update(5)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime() + 5000)
  })

  it('scales elapsed time by the configured timeScale', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start, 1)
    clock.setTimeScale(3600)
    clock.update(2)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime() + 2 * 3600 * 1000)
  })

  it('moves simulated time backward with a negative timeScale', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const clock = new SimulationClock(start, -1)
    clock.update(10)
    expect(clock.getCurrentDate().getTime()).toBe(start.getTime() - 10000)
  })

  it('reports whether it is paused', () => {
    const clock = new SimulationClock()
    expect(clock.isPaused()).toBe(false)
    clock.pause()
    expect(clock.isPaused()).toBe(true)
    clock.play()
    expect(clock.isPaused()).toBe(false)
  })

  it('reports the current time scale', () => {
    const clock = new SimulationClock(new Date(), 1)
    expect(clock.getTimeScale()).toBe(1)
    clock.setTimeScale(86400)
    expect(clock.getTimeScale()).toBe(86400)
  })
})

describe('TIME_SCALE_PRESETS', () => {
  it('is ordered from slowest to fastest and starts at real-time', () => {
    expect(TIME_SCALE_PRESETS[0].secondsPerSecond).toBe(1)
    for (let i = 1; i < TIME_SCALE_PRESETS.length; i++) {
      expect(TIME_SCALE_PRESETS[i].secondsPerSecond).toBeGreaterThan(TIME_SCALE_PRESETS[i - 1].secondsPerSecond)
    }
  })
})

describe('shuttleValueToTimeScale', () => {
  it('maps 0 to a stopped (zero) time scale', () => {
    expect(shuttleValueToTimeScale(0, 1000)).toBe(0)
  })

  it('maps the maximum value to the full configured rate', () => {
    expect(shuttleValueToTimeScale(100, 1000)).toBeCloseTo(1000, 5)
  })

  it('maps the minimum value to the negative full configured rate', () => {
    expect(shuttleValueToTimeScale(-100, 1000)).toBeCloseTo(-1000, 5)
  })

  it('gives small deflections a disproportionately small rate (fine control near center)', () => {
    const halfway = shuttleValueToTimeScale(50, 1000)
    expect(halfway).toBeLessThan(500) // cubic easing: less than half of max at half deflection
    expect(halfway).toBeGreaterThan(0)
  })

  it('preserves sign for negative input', () => {
    expect(shuttleValueToTimeScale(-50, 1000)).toBeLessThan(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: FAIL — `simulationClock` module not found.

- [ ] **Step 3: Implement `packages/app/src/time/simulationClock.ts`**

```typescript
export interface TimeScalePreset {
  label: string
  secondsPerSecond: number
}

// Average Gregorian calendar month/year lengths, used for the "1 month/s" and "1 year/s" presets.
const AVERAGE_YEAR_SECONDS = 365.2425 * 86400
const AVERAGE_MONTH_SECONDS = AVERAGE_YEAR_SECONDS / 12

export const TIME_SCALE_PRESETS: TimeScalePreset[] = [
  { label: 'Real-time', secondsPerSecond: 1 },
  { label: '1 min/s', secondsPerSecond: 60 },
  { label: '1 hr/s', secondsPerSecond: 3600 },
  { label: '1 day/s', secondsPerSecond: 86400 },
  { label: '1 month/s', secondsPerSecond: AVERAGE_MONTH_SECONDS },
  { label: '1 year/s', secondsPerSecond: AVERAGE_YEAR_SECONDS },
]

// Maps a shuttle slider value in [-100, 100] to a time scale (simulated seconds per real second),
// using a cubic curve so fine control near the center (slow rates) coexists with fast rates at the
// extremes — the "shuttle" feel. Sign of the input controls direction; 0 maps to a stopped clock.
export function shuttleValueToTimeScale(value: number, maxSecondsPerSecond: number): number {
  if (value === 0) return 0
  const magnitude = Math.abs(value) / 100
  const scale = Math.pow(magnitude, 3) * maxSecondsPerSecond
  return Math.sign(value) * scale
}

// Drives a simulated clock forward or backward at a configurable rate, fully decoupled from
// wall-clock time. Call update(realDeltaSeconds) once per animation frame.
export class SimulationClock {
  private simulatedMs: number
  private timeScale: number
  private paused: boolean

  constructor(initialDate: Date = new Date(), initialTimeScale = 1) {
    this.simulatedMs = initialDate.getTime()
    this.timeScale = initialTimeScale
    this.paused = false
  }

  update(realDeltaSeconds: number): void {
    if (this.paused) return
    this.simulatedMs += realDeltaSeconds * 1000 * this.timeScale
  }

  getCurrentDate(): Date {
    return new Date(this.simulatedMs)
  }

  play(): void {
    this.paused = false
  }

  pause(): void {
    this.paused = true
  }

  isPaused(): boolean {
    return this.paused
  }

  setTimeScale(scale: number): void {
    this.timeScale = scale
  }

  getTimeScale(): number {
    return this.timeScale
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: PASS — all 14 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/time/simulationClock.ts packages/app/test/simulationClock.test.ts
git commit -m "feat(app): add simulation clock with presets and shuttle mapping"
```

---

### Task 2: Time Control UI

**Files:**
- Create: `packages/app/src/time/timeControlUI.ts`

**Interfaces:**
- Consumes: `SimulationClock`, `TIME_SCALE_PRESETS`, `shuttleValueToTimeScale` (Task 1).
- Produces: `TimeControlUI` class with a constructor taking a `SimulationClock` and the five DOM
  elements it wires up, plus a `refreshDisplay()` method Task 3's render loop calls once per frame.

No automated test for this task — like `CameraInputController`, it's DOM event wiring with no pure
logic of its own (the logic it calls is already tested in Task 1). Verified manually in Task 3.

- [ ] **Step 1: Implement `packages/app/src/time/timeControlUI.ts`**

```typescript
import { SimulationClock, shuttleValueToTimeScale, TIME_SCALE_PRESETS } from './simulationClock'

const MAX_SHUTTLE_SECONDS_PER_SECOND = TIME_SCALE_PRESETS[TIME_SCALE_PRESETS.length - 1].secondsPerSecond

// Wires the play/pause button, reverse button, preset dropdown, and shuttle slider to a
// SimulationClock. The shuttle and the presets are two independent ways to set the same rate —
// touching either one calls clock.setTimeScale() directly; they aren't kept visually in sync with
// each other (see plan Context).
export class TimeControlUI {
  constructor(
    private readonly clock: SimulationClock,
    private readonly playPauseButton: HTMLButtonElement,
    private readonly reverseButton: HTMLButtonElement,
    private readonly presetSelect: HTMLSelectElement,
    private readonly shuttleSlider: HTMLInputElement,
    private readonly dateDisplay: HTMLElement,
  ) {
    this.playPauseButton.addEventListener('click', this.onPlayPauseClick)
    this.reverseButton.addEventListener('click', this.onReverseClick)
    this.presetSelect.addEventListener('change', this.onPresetChange)
    this.shuttleSlider.addEventListener('input', this.onShuttleInput)
    this.updatePlayPauseLabel()
  }

  // Call once per frame (after clock.update()) to keep the displayed date current.
  refreshDisplay(): void {
    const iso = this.clock.getCurrentDate().toISOString()
    this.dateDisplay.textContent = `${iso.replace('T', ' ').slice(0, 16)} UTC`
  }

  private onPlayPauseClick = () => {
    if (this.clock.isPaused()) {
      this.clock.play()
    } else {
      this.clock.pause()
    }
    this.updatePlayPauseLabel()
  }

  private onReverseClick = () => {
    this.clock.setTimeScale(-this.clock.getTimeScale())
  }

  private onPresetChange = () => {
    const preset = TIME_SCALE_PRESETS[Number(this.presetSelect.value)]
    if (!preset) return
    this.clock.setTimeScale(preset.secondsPerSecond)
  }

  private onShuttleInput = () => {
    const value = Number(this.shuttleSlider.value)
    this.clock.setTimeScale(shuttleValueToTimeScale(value, MAX_SHUTTLE_SECONDS_PER_SECOND))
  }

  private updatePlayPauseLabel(): void {
    this.playPauseButton.textContent = this.clock.isPaused() ? 'Play' : 'Pause'
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck --workspace=@toboldlyglow/app`
Expected: PASS (not wired into `main.ts` yet — that's Task 3).

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/time/timeControlUI.ts
git commit -m "feat(app): add time control UI wiring (play/pause, reverse, presets, shuttle)"
```

---

### Task 3: Wire the Clock Into `main.ts`

**Files:**
- Modify: `packages/app/index.html`
- Modify: `packages/app/src/main.ts`

**Interfaces:**
- Consumes: `SimulationClock`, `TimeControlUI` (Tasks 1-2).
- Produces: nothing new exported — this is the integration point.

- [ ] **Step 1: Add the time-control HTML to `packages/app/index.html`**

Add this block just before the closing `</body>` tag, alongside the existing canvas and
camera-mode-toggle button (leave those untouched):

```html
<div
  id="time-controls"
  style="position: fixed; bottom: 12px; left: 12px; padding: 8px 12px; font: 14px sans-serif; background: rgba(0,0,0,0.6); color: white; border-radius: 4px; display: flex; align-items: center; gap: 8px;"
>
  <button id="time-play-pause">Pause</button>
  <button id="time-reverse">Reverse Direction</button>
  <select id="time-preset-select">
    <option value="0">Real-time</option>
    <option value="1">1 min/s</option>
    <option value="2">1 hr/s</option>
    <option value="3">1 day/s</option>
    <option value="4">1 month/s</option>
    <option value="5">1 year/s</option>
  </select>
  <input id="time-shuttle" type="range" min="-100" max="100" value="0" style="width: 150px;" />
  <span id="time-display">—</span>
</div>
```

- [ ] **Step 2: Replace `packages/app/src/main.ts`**

```typescript
import { mat4, vec3 } from 'gl-matrix'
import {
  calendarToJulianDay,
  earthHeliocentricB,
  earthHeliocentricL,
  earthHeliocentricR,
  julianMillenniaSinceJ2000,
  sphericalToX,
  sphericalToY,
  sphericalToZ,
} from '@toboldlyglow/engine'
import { generateSphereMesh } from './geometry/sphere'
import { OrbitCamera } from './camera/orbitCamera'
import { FlyCamera } from './camera/flyCamera'
import { CameraInputController } from './camera/inputController'
import { SimulationClock } from './time/simulationClock'
import { TimeControlUI } from './time/timeControlUI'
import {
  createLitPipeline,
  createMeshBuffers,
  createUnlitPipeline,
  initWebGpu,
  type MeshBuffers,
} from './renderer/webgpu'

// TEMPORARY visual scale, not physically accurate — see the orbital-mechanics/renderer-core plans.
const AU_TO_SCENE_UNITS = 20
const SUN_VISUAL_RADIUS = 3
const EARTH_VISUAL_RADIUS = 1

function earthPositionInSceneUnits(date: Date): [number, number, number] {
  const julianDay = calendarToJulianDay(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate() + date.getUTCHours() / 24,
  )
  const T = julianMillenniaSinceJ2000(julianDay)
  const L = earthHeliocentricL(T)
  const B = earthHeliocentricB(T)
  const R = earthHeliocentricR(T)
  return [
    sphericalToX(L, B, R) * AU_TO_SCENE_UNITS,
    sphericalToY(L, B, R) * AU_TO_SCENE_UNITS,
    sphericalToZ(L, B, R) * AU_TO_SCENE_UNITS,
  ]
}

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Required element ${selector} not found.`)
  return element
}

async function main() {
  const canvasElement = document.querySelector<HTMLCanvasElement>('#scene')
  if (!canvasElement) throw new Error('Canvas element #scene not found.')
  const canvas: HTMLCanvasElement = canvasElement
  canvas.width = 800
  canvas.height = 600

  const { device, context, format, depthTexture } = await initWebGpu(canvas)
  const litPipeline = await createLitPipeline(device, format)
  const unlitPipeline = await createUnlitPipeline(device, format)

  const sphereMesh = generateSphereMesh(1, 32, 32)
  const meshBuffers = createMeshBuffers(device, sphereMesh)

  const sunUniformBuffer = device.createBuffer({
    label: 'sun uniforms',
    size: 20 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const sunBindGroup = device.createBindGroup({
    layout: unlitPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: sunUniformBuffer } }],
  })

  const earthUniformBuffer = device.createBuffer({
    label: 'earth uniforms',
    size: 40 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const earthBindGroup = device.createBindGroup({
    layout: litPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: earthUniformBuffer } }],
  })

  const projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, 0.1, 1000)

  const orbitCamera = new OrbitCamera({ radius: 65, azimuth: 0, elevation: 0.4 })
  const flyCamera = new FlyCamera({ position: [0, 25, 60], yaw: Math.PI, pitch: 0 })
  const cameraInput = new CameraInputController(canvas, orbitCamera, flyCamera)

  const modeToggleButton = document.querySelector<HTMLButtonElement>('#camera-mode-toggle')
  modeToggleButton?.addEventListener('click', () => {
    const nextMode = cameraInput.mode === 'orbit' ? 'fly' : 'orbit'
    cameraInput.setMode(nextMode)
    modeToggleButton.textContent =
      nextMode === 'orbit' ? 'Switch to Free-fly Camera' : 'Switch to Orbit Camera'
  })

  const simulationClock = new SimulationClock()
  const timeControlUI = new TimeControlUI(
    simulationClock,
    requireElement<HTMLButtonElement>('#time-play-pause'),
    requireElement<HTMLButtonElement>('#time-reverse'),
    requireElement<HTMLSelectElement>('#time-preset-select'),
    requireElement<HTMLInputElement>('#time-shuttle'),
    requireElement<HTMLElement>('#time-display'),
  )

  function drawBody(
    pass: GPURenderPassEncoder,
    pipeline: GPURenderPipeline,
    buffers: MeshBuffers,
    bindGroup: GPUBindGroup,
  ) {
    pass.setPipeline(pipeline)
    pass.setVertexBuffer(0, buffers.positionBuffer)
    pass.setVertexBuffer(1, buffers.normalBuffer)
    pass.setIndexBuffer(buffers.indexBuffer, 'uint32')
    pass.setBindGroup(0, bindGroup)
    pass.drawIndexed(buffers.indexCount)
  }

  let lastFrameTime = performance.now()

  function frame() {
    const now = performance.now()
    const deltaSeconds = (now - lastFrameTime) / 1000
    lastFrameTime = now
    cameraInput.update(deltaSeconds)
    simulationClock.update(deltaSeconds)
    timeControlUI.refreshDisplay()

    const view = cameraInput.getViewMatrix()
    const sunPosition: [number, number, number] = [0, 0, 0]
    const earthPosition = earthPositionInSceneUnits(simulationClock.getCurrentDate())

    const sunWorld = mat4.fromScaling(mat4.create(), [SUN_VISUAL_RADIUS, SUN_VISUAL_RADIUS, SUN_VISUAL_RADIUS])
    const sunWVP = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, sunWorld))
    const sunUniforms = new Float32Array(20)
    sunUniforms.set(sunWVP, 0)
    sunUniforms.set([1.0, 0.9, 0.6, 1.0], 16)
    device.queue.writeBuffer(sunUniformBuffer, 0, sunUniforms)

    const earthWorld = mat4.multiply(
      mat4.create(),
      mat4.fromTranslation(mat4.create(), earthPosition),
      mat4.fromScaling(mat4.create(), [EARTH_VISUAL_RADIUS, EARTH_VISUAL_RADIUS, EARTH_VISUAL_RADIUS]),
    )
    const earthWVP = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, earthWorld))
    const lightDirection = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), earthPosition, sunPosition))
    const earthUniforms = new Float32Array(40)
    earthUniforms.set(earthWVP, 0)
    earthUniforms.set(earthWorld, 16)
    earthUniforms.set([0.25, 0.45, 0.75, 1.0], 32)
    earthUniforms.set([...lightDirection, 0], 36)
    device.queue.writeBuffer(earthUniformBuffer, 0, earthUniforms)

    const encoder = device.createCommandEncoder({ label: 'frame encoder' })
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })
    drawBody(pass, unlitPipeline, meshBuffers, sunBindGroup)
    drawBody(pass, litPipeline, meshBuffers, earthBindGroup)
    pass.end()
    device.queue.submit([encoder.finish()])
    canvas.dataset.rendered = 'true'
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

main().catch((error) => {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene')
  if (canvas) canvas.replaceWith(document.createTextNode(`Failed to start renderer: ${error.message}`))
  console.error(error)
})
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test --workspace=@toboldlyglow/app && npm run typecheck && npm run lint && npm run build && npm run test:e2e --workspace=@toboldlyglow/app`
Expected: all pass (the existing E2E test only checks that a frame renders — it doesn't drive time
controls, so it's unaffected).

- [ ] **Step 4: Manually verify the time controls**

Run: `npm run dev --workspace=@toboldlyglow/app`, open the printed URL.
Expected: the date display (bottom-left) shows today's date/time and updates every second while
playing (real-time default). Click "Pause" — the display and Earth's position should freeze; button
label changes to "Play." Click "Play" again — it resumes. Select "1 year/s" from the dropdown —
Earth should visibly orbit the Sun within a few seconds. Click "Reverse Direction" — Earth should
now orbit the opposite way. Drag the shuttle slider — small movements near the center should produce
slow motion, larger movements toward either edge should produce much faster motion in that
direction; releasing the slider should NOT reset it or stop the motion (it holds at wherever you
left it, per the plan's Context section).

If the shuttle's speed curve feels off (e.g., too much of the slider's range feels "slow," or full
deflection feels too extreme), that's a feel/tuning matter — the cubic exponent in
`shuttleValueToTimeScale` is the tunable, not a sign of a bug.

- [ ] **Step 5: Commit**

```bash
git add packages/app/index.html packages/app/src/main.ts
git commit -m "feat(app): wire the simulation clock and time controls into the render loop"
```

---

## Verification (whole plan)

After all 3 tasks: `npm run lint && npm run typecheck && npm run build && npm test && npm run test:e2e`
from the repo root should all pass. `npm run dev --workspace=@toboldlyglow/app` should let you
pause, speed up, reverse, and shuttle through time while Earth visibly orbits the Sun — the second
interactive feature in the app, and the first one that makes the underlying orbital mechanics
actually visible in motion.

## What's next

- **"Jump to now" / arbitrary date picker** — a different feature from the shuttle (see plan
  Context), for jumping straight to a specific date rather than scrubbing rate.
- **Remaining 7 planets** — now genuinely rewarding to add, since you can watch them all orbit at
  once with time control.
- **Scale toggle** (realistic ⇄ explorer) — pairs naturally with time control once more bodies exist.
- **Eclipses, seasons, Moon phases** (named in the original roadmap) all depend on exactly this kind
  of time-driven simulation and are now unblocked.
