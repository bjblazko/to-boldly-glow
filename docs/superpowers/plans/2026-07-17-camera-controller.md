# Camera Controller (Orbit + Free-Fly) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the renderer-core plan's fixed `mat4.lookAt` camera with a real, interactive one:
drag to orbit the solar system (mouse or single-finger touch, both via the Pointer Events API, or
two-finger scroll/pinch on a trackpad), scroll or pinch to zoom, and a toggle button that switches to
a free-fly mode (WASD + mouse-look) for flying through the scene freely. This is the first
interactive feature in the app.

**Architecture:** Two independent, pure, GPU-free camera math modules (`OrbitCamera`, `FlyCamera`),
each producing a view matrix from its own state — no DOM, no WebGPU, fully unit-testable. A single
`CameraInputController` wires raw browser events (pointer/wheel/keyboard) to whichever camera is
currently active and exposes one `getViewMatrix()` call site for the render loop, so `main.ts` never
needs to know which mode is active. Mode switching resets to that camera's own last state (no attempt
to carry the exact eye position across modes — see Context).

**Tech Stack:** `gl-matrix` (already a dependency), Pointer Events API (unifies mouse + single-touch
drag with one code path), Vitest (camera math), Playwright (existing).

## Context: scope decisions

**Touch is in scope for drag-orbit, not yet for pinch-zoom or free-fly.** The Pointer Events API
(`pointerdown`/`pointermove`/`pointerup`) treats mouse and single-finger touch identically, so
drag-to-orbit and mouse-look both work on touch devices for free with the code in this plan. Two
things are deliberately deferred: **pinch-to-zoom** (needs tracking multiple simultaneous pointer IDs
and the distance between them — a distinct, addable-later concern) and **free-fly touch controls**
(WASD has no touch equivalent without a UI element like a virtual joystick, which is a UX design
question, not a rendering one). Both are named follow-ups, not silently dropped.

**Trackpad support in orbit mode uses `wheel` gestures, not click-drag.** Click-and-drag is
uncomfortable on a trackpad. Browsers report trackpad gestures through the same `wheel` event as a
mouse wheel, distinguishable by convention: a two-finger scroll reports both `deltaX` and `deltaY`
(a mouse wheel only ever reports `deltaY`), and a pinch gesture is reported as a `wheel` event with
`ctrlKey: true` set (not an actual Ctrl key press — this is a long-standing, widely-relied-on browser
convention, not a hack). So in orbit mode: plain mouse wheel zooms (as before), two-finger trackpad
scroll orbits, and trackpad pinch zooms. Click-drag still works too (for mouse users, and it still
works with one finger on a trackpad) — the two input paths don't conflict since they're different
event types. Fly mode's mouse-look still requires click-drag either way (no wheel-based equivalent
for "look around" makes sense) — trackpad ergonomics for fly mode is grouped with the
already-deferred fly-mode touch controls below, not solved here.

**Mode switching doesn't try to hand off the exact eye position.** Each camera mode keeps its own
independent state; switching modes jumps to that camera's last position/orientation rather than
computing an equivalent viewpoint in the other mode's parameterization. This keeps both camera
classes simple and independent (no coupling between them). A smooth cross-mode handoff is a
reasonable future polish item, not required for a first interactive milestone.

**Sign conventions for drag/look/zoom direction are a starting point, not gospel.** The exact feel of
"which way the camera moves when you drag right" is a UX judgment call, not a correctness question
like the orbital math or the WebGPU winding order — this plan's code picks a reasonable convention
and the manual verification step explicitly asks the implementer to check it feels natural and flip
a sign if it doesn't, rather than debugging as if it were a bug.

## Global Constraints

(Copied verbatim from the design spec and prior plans; every task below implicitly inherits these.)

- UI layer: plain TypeScript + DOM, no framework — the mode-toggle button is plain HTML/CSS/DOM.
- Renderer: WebGPU only (unaffected by this plan — no rendering code changes, only camera/view-matrix
  supply).
- Testing: Vitest for pure logic, Playwright for browser-level checks.
- No new npm dependencies (this plan only uses `gl-matrix`, already present).
- `packages/engine`'s exports are consumed as-is (Earth's position calculation is unchanged by this
  plan — only the *camera* changes).

---

### Task 1: Orbit Camera

**Files:**
- Create: `packages/app/src/camera/orbitCamera.ts`
- Test: `packages/app/test/orbitCamera.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `OrbitCamera` class with `getEyePosition(): vec3`, `getViewMatrix(): mat4`,
  `applyDrag(deltaX, deltaY, sensitivity?)`, `applyZoom(deltaY, sensitivity?)`. Task 3's
  `CameraInputController` calls these directly.

- [ ] **Step 1: Write the failing tests**

`packages/app/test/orbitCamera.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { OrbitCamera } from '../src/camera/orbitCamera'

describe('OrbitCamera', () => {
  it('places the eye directly on the +Z axis at azimuth 0, elevation 0', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: 0, elevation: 0 })
    const eye = camera.getEyePosition()
    expect(eye[0]).toBeCloseTo(0, 10)
    expect(eye[1]).toBeCloseTo(0, 10)
    expect(eye[2]).toBeCloseTo(10, 10)
  })

  it('places the eye on the +X axis at azimuth PI/2, elevation 0', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: Math.PI / 2, elevation: 0 })
    const eye = camera.getEyePosition()
    expect(eye[0]).toBeCloseTo(10, 5)
    expect(eye[1]).toBeCloseTo(0, 10)
    expect(eye[2]).toBeCloseTo(0, 5)
  })

  it('raises the eye above the target as elevation increases', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: 0, elevation: Math.PI / 4 })
    const eye = camera.getEyePosition()
    expect(eye[1]).toBeCloseTo(10 * Math.sin(Math.PI / 4), 5)
  })

  it('clamps elevation to avoid flipping past the poles', () => {
    const camera = new OrbitCamera({ elevation: 0 })
    camera.applyDrag(0, 100000, 1)
    expect(camera.elevation).toBeLessThanOrEqual(Math.PI / 2)
    expect(camera.elevation).toBeGreaterThan(0)
  })

  it('clamps radius to the configured min/max on zoom', () => {
    const camera = new OrbitCamera({ radius: 65, minRadius: 5, maxRadius: 500 })
    camera.applyZoom(-1000000, 1)
    expect(camera.radius).toBeGreaterThanOrEqual(5)
    camera.applyZoom(1000000, 1)
    expect(camera.radius).toBeLessThanOrEqual(500)
  })

  it('produces a view matrix with 16 finite entries', () => {
    const camera = new OrbitCamera()
    const view = camera.getViewMatrix()
    expect(view.length).toBe(16)
    for (const value of view) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: FAIL — `OrbitCamera` module not found.

- [ ] **Step 3: Implement `packages/app/src/camera/orbitCamera.ts`**

```typescript
import { mat4, vec3 } from 'gl-matrix'

export interface OrbitCameraOptions {
  target?: [number, number, number]
  radius?: number
  azimuth?: number
  elevation?: number
  minRadius?: number
  maxRadius?: number
}

const MAX_ELEVATION = Math.PI / 2 - 0.01

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Orbits around `target` at a fixed distance (`radius`), parameterized by azimuth (rotation
// around the Y axis) and elevation (angle above the horizontal plane). Default values roughly
// match the renderer-core plan's fixed camera framing (eye ~[0, 25, 60]).
export class OrbitCamera {
  target: vec3
  radius: number
  azimuth: number
  elevation: number
  minRadius: number
  maxRadius: number

  constructor(options: OrbitCameraOptions = {}) {
    this.target = vec3.fromValues(...(options.target ?? [0, 0, 0]))
    this.radius = options.radius ?? 65
    this.azimuth = options.azimuth ?? 0
    this.elevation = options.elevation ?? 0.4
    this.minRadius = options.minRadius ?? 5
    this.maxRadius = options.maxRadius ?? 500
  }

  getEyePosition(): vec3 {
    const cosEl = Math.cos(this.elevation)
    const x = this.target[0] + this.radius * cosEl * Math.sin(this.azimuth)
    const y = this.target[1] + this.radius * Math.sin(this.elevation)
    const z = this.target[2] + this.radius * cosEl * Math.cos(this.azimuth)
    return vec3.fromValues(x, y, z)
  }

  getViewMatrix(): mat4 {
    return mat4.lookAt(mat4.create(), this.getEyePosition(), this.target, [0, 1, 0])
  }

  applyDrag(deltaX: number, deltaY: number, sensitivity = 0.005): void {
    this.azimuth -= deltaX * sensitivity
    this.elevation = clamp(this.elevation + deltaY * sensitivity, -MAX_ELEVATION, MAX_ELEVATION)
  }

  applyZoom(deltaY: number, sensitivity = 0.001): void {
    this.radius = clamp(this.radius * (1 + deltaY * sensitivity), this.minRadius, this.maxRadius)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/camera/orbitCamera.ts packages/app/test/orbitCamera.test.ts
git commit -m "feat(app): add orbit camera math"
```

---

### Task 2: Free-Fly Camera

**Files:**
- Create: `packages/app/src/camera/flyCamera.ts`
- Test: `packages/app/test/flyCamera.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FlyCamera` class with `getForward(): vec3`, `getRight(): vec3`, `getViewMatrix(): mat4`,
  `applyLook(deltaX, deltaY, sensitivity?)`, `moveForward(distance)`, `moveRight(distance)`. Task 3's
  `CameraInputController` calls these directly.

- [ ] **Step 1: Write the failing tests**

`packages/app/test/flyCamera.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { FlyCamera } from '../src/camera/flyCamera'

describe('FlyCamera', () => {
  it('faces -Z at yaw PI, pitch 0', () => {
    const camera = new FlyCamera({ yaw: Math.PI, pitch: 0 })
    const forward = camera.getForward()
    expect(forward[0]).toBeCloseTo(0, 5)
    expect(forward[1]).toBeCloseTo(0, 5)
    expect(forward[2]).toBeCloseTo(-1, 5)
  })

  it('faces +X at yaw PI/2, pitch 0', () => {
    const camera = new FlyCamera({ yaw: Math.PI / 2, pitch: 0 })
    const forward = camera.getForward()
    expect(forward[0]).toBeCloseTo(1, 5)
    expect(forward[2]).toBeCloseTo(0, 5)
  })

  it('computes a right vector perpendicular to forward, pointing +X when facing -Z', () => {
    const camera = new FlyCamera({ yaw: Math.PI, pitch: 0 })
    const right = camera.getRight()
    expect(right[0]).toBeCloseTo(1, 5)
    expect(right[1]).toBeCloseTo(0, 5)
    expect(right[2]).toBeCloseTo(0, 5)
  })

  it('clamps pitch to avoid flipping past straight up/down', () => {
    const camera = new FlyCamera({ pitch: 0 })
    camera.applyLook(0, -1000000, 1)
    expect(camera.pitch).toBeLessThanOrEqual(Math.PI / 2)
  })

  it('moves position forward along the forward vector', () => {
    const camera = new FlyCamera({ position: [0, 0, 0], yaw: Math.PI, pitch: 0 })
    camera.moveForward(5)
    expect(camera.position[2]).toBeCloseTo(-5, 5)
  })

  it('moves position sideways along the right vector', () => {
    const camera = new FlyCamera({ position: [0, 0, 0], yaw: Math.PI, pitch: 0 })
    camera.moveRight(5)
    expect(camera.position[0]).toBeCloseTo(5, 5)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: FAIL — `FlyCamera` module not found.

- [ ] **Step 3: Implement `packages/app/src/camera/flyCamera.ts`**

```typescript
import { mat4, vec3 } from 'gl-matrix'

export interface FlyCameraOptions {
  position?: [number, number, number]
  yaw?: number
  pitch?: number
}

const MAX_PITCH = Math.PI / 2 - 0.01

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// First-person free-fly camera: `position` in world space, `yaw` (rotation around Y) and `pitch`
// (rotation around the local right axis, clamped to avoid flipping past straight up/down).
// Default yaw of PI faces -Z, matching the renderer-core plan's fixed camera (which looked from
// +Z toward the origin).
export class FlyCamera {
  position: vec3
  yaw: number
  pitch: number

  constructor(options: FlyCameraOptions = {}) {
    this.position = vec3.fromValues(...(options.position ?? [0, 25, 60]))
    this.yaw = options.yaw ?? Math.PI
    this.pitch = options.pitch ?? 0
  }

  getForward(): vec3 {
    const cosPitch = Math.cos(this.pitch)
    return vec3.fromValues(
      cosPitch * Math.sin(this.yaw),
      Math.sin(this.pitch),
      cosPitch * Math.cos(this.yaw),
    )
  }

  getRight(): vec3 {
    const forward = this.getForward()
    const right = vec3.cross(vec3.create(), forward, [0, 1, 0])
    return vec3.normalize(right, right)
  }

  getViewMatrix(): mat4 {
    const forward = this.getForward()
    const target = vec3.add(vec3.create(), this.position, forward)
    return mat4.lookAt(mat4.create(), this.position, target, [0, 1, 0])
  }

  applyLook(deltaX: number, deltaY: number, sensitivity = 0.003): void {
    this.yaw -= deltaX * sensitivity
    this.pitch = clamp(this.pitch - deltaY * sensitivity, -MAX_PITCH, MAX_PITCH)
  }

  moveForward(distance: number): void {
    const forward = this.getForward()
    vec3.scaleAndAdd(this.position, this.position, forward, distance)
  }

  moveRight(distance: number): void {
    const right = this.getRight()
    vec3.scaleAndAdd(this.position, this.position, right, distance)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/camera/flyCamera.ts packages/app/test/flyCamera.test.ts
git commit -m "feat(app): add free-fly camera math"
```

---

### Task 3: Input Controller

**Files:**
- Create: `packages/app/src/camera/inputController.ts`

**Interfaces:**
- Consumes: `OrbitCamera` (Task 1), `FlyCamera` (Task 2).
- Produces: `CameraInputController` class with `mode: 'orbit' | 'fly'`, `setMode(mode)`,
  `getViewMatrix(): mat4`, `update(deltaSeconds)` (drives continuous WASD movement in fly mode; no-op
  in orbit mode, which is purely event-driven). Task 4's `main.ts` holds one instance and calls
  `update()` + `getViewMatrix()` once per frame.

No automated test for this task — it's DOM event wiring with no pure-logic surface to unit test in
isolation (the camera math it calls is already tested in Tasks 1-2). Verified manually in Task 4,
where it's actually wired into the running app.

- [ ] **Step 1: Implement `packages/app/src/camera/inputController.ts`**

```typescript
import type { OrbitCamera } from './orbitCamera'
import type { FlyCamera } from './flyCamera'

export type CameraMode = 'orbit' | 'fly'

const MOVE_SPEED = 20 // scene units per second

// Wires pointer (mouse + single-finger touch, unified via the Pointer Events API), wheel, and
// keyboard events to whichever camera is active, and exposes one getViewMatrix()/update() pair
// so the render loop doesn't need to know which mode is active.
//
// Deliberately out of scope for this plan (see plan Context): pinch-to-zoom via touch, and touch
// controls for fly mode (WASD has no touch equivalent without a dedicated UI widget).
export class CameraInputController {
  mode: CameraMode = 'orbit'

  private isDragging = false
  private lastPointerX = 0
  private lastPointerY = 0
  private pressedKeys = new Set<string>()

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

  getViewMatrix() {
    return this.mode === 'orbit' ? this.orbitCamera.getViewMatrix() : this.flyCamera.getViewMatrix()
  }

  update(deltaSeconds: number): void {
    if (this.mode !== 'fly') return
    const distance = MOVE_SPEED * deltaSeconds
    if (this.pressedKeys.has('KeyW')) this.flyCamera.moveForward(distance)
    if (this.pressedKeys.has('KeyS')) this.flyCamera.moveForward(-distance)
    if (this.pressedKeys.has('KeyD')) this.flyCamera.moveRight(distance)
    if (this.pressedKeys.has('KeyA')) this.flyCamera.moveRight(-distance)
  }

  private onPointerDown = (event: PointerEvent) => {
    this.isDragging = true
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.canvas.setPointerCapture(event.pointerId)
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.isDragging) return
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
    if (this.mode !== 'orbit') return
    event.preventDefault()

    // Trackpad pinch gesture: browsers report this as a wheel event with ctrlKey set (a
    // long-standing convention — not an actual Ctrl key press) and deltaY carrying the pinch
    // amount. Pinch deltas are small, so scale up to feel comparable to mouse-wheel zoom.
    if (event.ctrlKey) {
      this.orbitCamera.applyZoom(event.deltaY * 5)
      return
    }

    // Trackpad two-finger scroll: reports both deltaX and deltaY (a plain mouse wheel only ever
    // reports deltaY). Treat this as an orbit drag, since click-and-drag is uncomfortable on a
    // trackpad. Sensitivity here is a feel parameter, not a correctness one — see plan Context.
    if (event.deltaX !== 0) {
      this.orbitCamera.applyDrag(-event.deltaX, -event.deltaY, 1)
      return
    }

    // Plain mouse wheel: zoom.
    this.orbitCamera.applyZoom(event.deltaY)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    this.pressedKeys.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code)
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck --workspace=@toboldlyglow/app`
Expected: PASS (this file isn't wired into `main.ts` yet, but should compile standalone).

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/camera/inputController.ts
git commit -m "feat(app): add camera input controller (pointer, wheel, keyboard)"
```

---

### Task 4: Wire the Camera Into `main.ts`

**Files:**
- Modify: `packages/app/src/main.ts`
- Modify: `packages/app/index.html`

**Interfaces:**
- Consumes: `OrbitCamera`, `FlyCamera`, `CameraInputController` (Tasks 1-3).
- Produces: nothing new exported — this is the integration point.

- [ ] **Step 1: Add the mode-toggle button to `packages/app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>To Boldly Glow</title>
  </head>
  <body>
    <canvas id="scene"></canvas>
    <button
      id="camera-mode-toggle"
      style="position: fixed; top: 12px; left: 12px; padding: 8px 12px; font: 14px sans-serif;"
    >
      Switch to Free-fly Camera
    </button>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
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

    const view = cameraInput.getViewMatrix()
    const sunPosition: [number, number, number] = [0, 0, 0]
    const earthPosition = earthPositionInSceneUnits(new Date())

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
Expected: all pass (the existing E2E test still just checks that a frame renders — it doesn't drive
camera input, so it's unaffected by this change).

- [ ] **Step 4: Manually verify the controls feel right**

Run: `npm run dev --workspace=@toboldlyglow/app`, open the printed URL.
Expected, in the default **orbit** mode: click-and-drag rotates the view around the solar system;
mouse-wheel scrolling zooms in/out, clamped so you can't zoom inside the Sun or out to nothing. If
testing on a trackpad (e.g. a MacBook): two-finger scroll should orbit the view (no click needed),
and a pinch gesture should zoom. Click "Switch to Free-fly Camera": click-and-drag now looks around
(mouse-look) instead of orbiting, and W/A/S/D move you through the scene (trackpad two-finger/pinch
gestures don't do anything special in this mode — that's expected, see plan Context). Click the
button again to switch back to orbit mode.

If drag direction feels backwards (e.g. dragging right rotates the view left when you expected the
opposite, or mouse-look feels inverted), that's a sign convention choice, not a bug — flip the sign
on the corresponding line in `orbitCamera.ts`'s `applyDrag` or `flyCamera.ts`'s `applyLook` and
re-check. Do not spend time "debugging" a feel preference as if it were a logic error.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/main.ts packages/app/index.html
git commit -m "feat(app): wire the interactive camera into the render loop"
```

---

## Verification (whole plan)

After all 4 tasks: `npm run lint && npm run typecheck && npm run build && npm test && npm run test:e2e`
from the repo root should all pass. `npm run dev --workspace=@toboldlyglow/app` should let you orbit,
zoom, and switch to a free-fly mode with WASD + mouse-look — the first interactive feature in the app.

## What's next

- **Pinch-to-zoom on touch screens** (phones/tablets) — distinct from trackpad pinch (solved in this
  plan via the `wheel`+`ctrlKey` convention); a touch-screen pinch needs tracking two simultaneous
  Pointer Events by ID and the changing distance between them, a different mechanism.
- **Touch controls for fly mode**, and **trackpad ergonomics for fly mode** (needs a UI design
  decision — virtual joystick or similar for touch; fly mode's mouse-look still needs click-drag on
  a trackpad, unlike orbit mode).
- **Time controller** (play/pause, jog/shuttle, speed presets) — makes Earth's motion around the Sun
  actually visible instead of only reflecting "now."
- **Remaining 7 planets** — same orbital-mechanics pattern, now with a camera good enough to actually
  go look at them.
