# Solar System Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render all 8 planets (not just Earth) orbiting the Sun, with antialiasing, a toggleable
orbit-path overlay, and a realistic⇄explorer visual scale slider.

**Architecture:** Replace `main.ts`'s hardcoded Sun+Earth rendering with a generic loop driven by
a small body-registry table (name → VSOP87 functions, color, true radius, hand-picked "explorer"
radius, sidereal period). A new `sceneScale.ts` module supplies the realistic⇄explorer
interpolation used for both body positions/sizes and orbit-path geometry. MSAA is added to the
existing lit/unlit pipelines. Orbit paths are a new unlit line-strip pipeline sampling one full
sidereal orbit per planet.

**Tech Stack:** TypeScript, WebGPU, gl-matrix, Vitest, Playwright — all already in use, no new
dependencies.

## Global Constraints

- WebGPU only, no fallback — matches existing project-wide decision.
- AssemblyScript requires static named exports; the engine package cannot be iterated
  generically. The body registry (Task 1) lists each planet's three functions explicitly by name.
- All new/modified `GPURenderPipeline` creation must use `device.createRenderPipelineAsync`
  (never the sync variant), so shader/pipeline validation errors actually reject instead of
  silently producing an invalid pipeline — established convention from the renderer-core plan.
- Any pipeline drawing the shared UV-sphere mesh (`generateSphereMesh`) must set
  `primitive: { frontFace: 'cw' }` — the mesh's winding is clockwise as viewed from outside,
  opposite WebGPU's default. The new line pipeline (Task 5) does not draw this mesh and does not
  need this.
- No new runtime dependencies — reuse `gl-matrix`, existing WGSL patterns, existing test
  frameworks (Vitest for units, Playwright for e2e).
- Model selection for dispatch: use inexpensive models (Sonnet-tier) for implementer/reviewer
  dispatches this session, per explicit user instruction earlier in this project.

---

### Task 1: Body registry

**Files:**
- Create: `packages/app/src/solarSystem/bodies.ts`
- Test: `packages/app/test/bodies.test.ts`

**Interfaces:**
- Produces: `BodyDefinition` interface, `SUN: BodyDefinition`, `PLANETS: BodyDefinition[]`,
  `AU_KM: number` — all consumed by Tasks 3, 5, 6.

- [ ] **Step 1: Write `packages/app/src/solarSystem/bodies.ts`**

```typescript
import {
  earthHeliocentricB, earthHeliocentricL, earthHeliocentricR,
  jupiterHeliocentricB, jupiterHeliocentricL, jupiterHeliocentricR,
  marsHeliocentricB, marsHeliocentricL, marsHeliocentricR,
  mercuryHeliocentricB, mercuryHeliocentricL, mercuryHeliocentricR,
  neptuneHeliocentricB, neptuneHeliocentricL, neptuneHeliocentricR,
  saturnHeliocentricB, saturnHeliocentricL, saturnHeliocentricR,
  uranusHeliocentricB, uranusHeliocentricL, uranusHeliocentricR,
  venusHeliocentricB, venusHeliocentricL, venusHeliocentricR,
} from '@toboldlyglow/engine'

export interface HeliocentricPosition {
  longitude: (T: number) => number
  latitude: (T: number) => number
  distance: (T: number) => number
}

export interface BodyDefinition {
  id: string
  name: string
  /** Approximate/illustrative color, not photometrically calibrated. */
  color: [number, number, number]
  /** True equatorial radius, kilometers. Source: NASA Planetary Fact Sheet. */
  radiusKm: number
  /** Hand-picked radius (scene units) at the fully-"explorer" end of the scale slider. */
  explorerVisualRadius: number
  /**
   * Sidereal orbital period in days. Source: NASA Planetary Fact Sheet. Used only to sample one
   * full orbit for the orbit-path line (Task 5) — not used for body positioning, which comes
   * from VSOP87 via `position` below.
   */
  siderealPeriodDays: number | null
  position: HeliocentricPosition | null
}

/** 1 astronomical unit, kilometers (IAU-defined exact value). */
export const AU_KM = 149_597_870.7

export const SUN: BodyDefinition = {
  id: 'sun',
  name: 'Sun',
  color: [1.0, 0.9, 0.6],
  radiusKm: 696_000,
  explorerVisualRadius: 3,
  siderealPeriodDays: null,
  position: null,
}

export const PLANETS: BodyDefinition[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    color: [0.65, 0.65, 0.65],
    radiusKm: 2439.7,
    explorerVisualRadius: 0.4,
    siderealPeriodDays: 87.969,
    position: {
      longitude: mercuryHeliocentricL,
      latitude: mercuryHeliocentricB,
      distance: mercuryHeliocentricR,
    },
  },
  {
    id: 'venus',
    name: 'Venus',
    color: [0.9, 0.8, 0.6],
    radiusKm: 6051.8,
    explorerVisualRadius: 0.9,
    siderealPeriodDays: 224.701,
    position: { longitude: venusHeliocentricL, latitude: venusHeliocentricB, distance: venusHeliocentricR },
  },
  {
    id: 'earth',
    name: 'Earth',
    color: [0.25, 0.45, 0.75],
    radiusKm: 6371.0,
    explorerVisualRadius: 1.0,
    siderealPeriodDays: 365.256,
    position: { longitude: earthHeliocentricL, latitude: earthHeliocentricB, distance: earthHeliocentricR },
  },
  {
    id: 'mars',
    name: 'Mars',
    color: [0.75, 0.35, 0.2],
    radiusKm: 3389.5,
    explorerVisualRadius: 0.55,
    siderealPeriodDays: 686.98,
    position: { longitude: marsHeliocentricL, latitude: marsHeliocentricB, distance: marsHeliocentricR },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    color: [0.8, 0.7, 0.55],
    radiusKm: 69_911,
    explorerVisualRadius: 2.2,
    siderealPeriodDays: 4332.59,
    position: {
      longitude: jupiterHeliocentricL,
      latitude: jupiterHeliocentricB,
      distance: jupiterHeliocentricR,
    },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    color: [0.85, 0.75, 0.55],
    radiusKm: 58_232,
    explorerVisualRadius: 1.9,
    siderealPeriodDays: 10_759.22,
    position: { longitude: saturnHeliocentricL, latitude: saturnHeliocentricB, distance: saturnHeliocentricR },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    color: [0.6, 0.85, 0.9],
    radiusKm: 25_362,
    explorerVisualRadius: 1.3,
    siderealPeriodDays: 30_688.5,
    position: { longitude: uranusHeliocentricL, latitude: uranusHeliocentricB, distance: uranusHeliocentricR },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    color: [0.25, 0.4, 0.9],
    radiusKm: 24_622,
    explorerVisualRadius: 1.25,
    siderealPeriodDays: 60_182.0,
    position: {
      longitude: neptuneHeliocentricL,
      latitude: neptuneHeliocentricB,
      distance: neptuneHeliocentricR,
    },
  },
]
```

- [ ] **Step 2: Write `packages/app/test/bodies.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { AU_KM, PLANETS, SUN } from '../src/solarSystem/bodies'

describe('body registry', () => {
  it('lists exactly the 8 planets in orbital order', () => {
    expect(PLANETS.map((p) => p.id)).toEqual([
      'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
    ])
  })

  it('every planet has a position lookup and the Sun does not', () => {
    for (const planet of PLANETS) expect(planet.position).not.toBeNull()
    expect(SUN.position).toBeNull()
    expect(SUN.siderealPeriodDays).toBeNull()
  })

  it('radii follow known solar-system size ordering (sanity check against NASA fact sheet)', () => {
    const byId = Object.fromEntries(PLANETS.map((p) => [p.id, p.radiusKm]))
    expect(SUN.radiusKm).toBeGreaterThan(byId.jupiter)
    expect(byId.jupiter).toBeGreaterThan(byId.saturn)
    expect(byId.saturn).toBeGreaterThan(byId.uranus)
    expect(byId.uranus).toBeGreaterThan(byId.neptune * 0.9) // Uranus and Neptune are close in size
    expect(byId.earth).toBeGreaterThan(byId.mars)
    expect(byId.venus).toBeGreaterThan(byId.mercury)
  })

  it("sidereal periods roughly satisfy Kepler's third law given known semi-major axes", () => {
    // T(years) ≈ a(AU)^1.5 — cross-checks the hand-entered period constants independently of
    // their source, catching a transcription error even without redoing the NASA lookup.
    const semiMajorAxisAu: Record<string, number> = {
      mercury: 0.387, venus: 0.723, earth: 1.0, mars: 1.524,
      jupiter: 5.203, saturn: 9.537, uranus: 19.191, neptune: 30.069,
    }
    for (const planet of PLANETS) {
      const expectedDays = Math.pow(semiMajorAxisAu[planet.id], 1.5) * 365.25
      const actualDays = planet.siderealPeriodDays as number
      expect(Math.abs(actualDays - expectedDays) / expectedDays).toBeLessThan(0.03)
    }
  })

  it('AU_KM matches the standard astronomical unit definition', () => {
    expect(AU_KM).toBeCloseTo(149_597_870.7, 1)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: PASS (new `bodies.test.ts` suite green, all pre-existing suites unaffected)

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/solarSystem/bodies.ts packages/app/test/bodies.test.ts
git commit -m "Add solar-system body registry (Sun + 8 planets)"
```

---

### Task 2: Scene scale module (realistic ⇄ explorer)

**Files:**
- Create: `packages/app/src/solarSystem/sceneScale.ts`
- Test: `packages/app/test/sceneScale.test.ts`

**Interfaces:**
- Produces: `AU_TO_SCENE_UNITS`, `explorerDistanceUnits(distanceAu)`,
  `scaledDistanceUnits(distanceAu, blend)`, `scaledBodyRadiusUnits(radiusKm, explorerVisualRadius,
  blend, auKm)`, `scaledPosition(x, y, z, distanceAu, blend): [number, number, number]` — consumed
  by Tasks 3, 5, 6. `blend` is `0` (fully realistic) to `1` (fully explorer).
- Consumes: nothing from other tasks (pure math module).

- [ ] **Step 1: Write `packages/app/src/solarSystem/sceneScale.ts`**

```typescript
// "Realistic" endpoint: 1 AU = this many scene units. This is the constant the renderer-core plan
// introduced for Earth alone; kept as the single definition now that more bodies share it.
export const AU_TO_SCENE_UNITS = 20

// "Explorer" endpoint: distances compressed with log1p so all 8 planets (0.39 AU to ~30 AU) fit
// within a comfortable, explorable camera range instead of crowding the inner planets into a few
// pixels or pushing Neptune off the edge of the world. log1p (not log) keeps Mercury away from
// the origin (log1p(0.39) > 0, whereas log(0.39) < 0 would put it "behind" the Sun along this
// axis, which does not correspond to anything physical).
const EXPLORER_DISTANCE_SCALE = 60

export function explorerDistanceUnits(distanceAu: number): number {
  return EXPLORER_DISTANCE_SCALE * Math.log1p(distanceAu)
}

// blend: 0 = fully realistic, 1 = fully explorer, values between interpolate linearly.
export function scaledDistanceUnits(distanceAu: number, blend: number): number {
  const realistic = distanceAu * AU_TO_SCENE_UNITS
  const explorer = explorerDistanceUnits(distanceAu)
  return realistic + (explorer - realistic) * blend
}

export function scaledBodyRadiusUnits(
  radiusKm: number,
  explorerVisualRadius: number,
  blend: number,
  auKm: number,
): number {
  const realistic = (radiusKm / auKm) * AU_TO_SCENE_UNITS
  return realistic + (explorerVisualRadius - realistic) * blend
}

// Rescales an already-computed AU-space position (x, y, z with x²+y²+z² = distanceAu²) to scene
// units for the given blend, preserving direction. Since sphericalToX/Y/Z are all linear in their
// radius argument, a single scalar factor (targetDistance / distanceAu) applied to each axis
// rescales distance while preserving direction exactly.
//
// Returns [0, 0, 0] unscaled for a body at the origin (the Sun): there is no direction to
// preserve, and the factor would divide by zero.
export function scaledPosition(
  x: number,
  y: number,
  z: number,
  distanceAu: number,
  blend: number,
): [number, number, number] {
  if (distanceAu === 0) return [0, 0, 0]
  const factor = scaledDistanceUnits(distanceAu, blend) / distanceAu
  return [x * factor, y * factor, z * factor]
}
```

- [ ] **Step 2: Write `packages/app/test/sceneScale.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import {
  AU_TO_SCENE_UNITS,
  explorerDistanceUnits,
  scaledBodyRadiusUnits,
  scaledDistanceUnits,
  scaledPosition,
} from '../src/solarSystem/sceneScale'

const AU_KM = 149_597_870.7

describe('scaledDistanceUnits', () => {
  it('matches the linear realistic scale at blend 0', () => {
    expect(scaledDistanceUnits(5, 0)).toBeCloseTo(5 * AU_TO_SCENE_UNITS, 10)
  })

  it('matches the log1p explorer scale at blend 1', () => {
    expect(scaledDistanceUnits(5, 1)).toBeCloseTo(explorerDistanceUnits(5), 10)
  })

  it('interpolates linearly between the two endpoints at blend 0.5', () => {
    const realistic = 5 * AU_TO_SCENE_UNITS
    const explorer = explorerDistanceUnits(5)
    expect(scaledDistanceUnits(5, 0.5)).toBeCloseTo((realistic + explorer) / 2, 10)
  })

  it('compresses far distances more than near ones in explorer mode', () => {
    const mercuryAu = 0.39
    const neptuneAu = 30.1
    const ratioRealistic = scaledDistanceUnits(neptuneAu, 0) / scaledDistanceUnits(mercuryAu, 0)
    const ratioExplorer = scaledDistanceUnits(neptuneAu, 1) / scaledDistanceUnits(mercuryAu, 1)
    expect(ratioExplorer).toBeLessThan(ratioRealistic)
  })
})

describe('scaledBodyRadiusUnits', () => {
  it('matches the true-to-scale radius at blend 0', () => {
    const result = scaledBodyRadiusUnits(6371, 1.0, 0, AU_KM)
    expect(result).toBeCloseTo((6371 / AU_KM) * AU_TO_SCENE_UNITS, 10)
  })

  it('matches the hand-picked explorer radius at blend 1', () => {
    expect(scaledBodyRadiusUnits(6371, 1.0, 1, AU_KM)).toBeCloseTo(1.0, 10)
  })
})

describe('scaledPosition', () => {
  it('preserves direction while rescaling magnitude', () => {
    const [x, y, z] = scaledPosition(3, 4, 0, 5, 0)
    const expectedFactor = scaledDistanceUnits(5, 0) / 5
    expect(x).toBeCloseTo(3 * expectedFactor, 10)
    expect(y).toBeCloseTo(4 * expectedFactor, 10)
    expect(z).toBeCloseTo(0, 10)
  })

  it('returns the origin for a body at zero distance (the Sun)', () => {
    expect(scaledPosition(0, 0, 0, 0, 0.7)).toEqual([0, 0, 0])
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: PASS (new `sceneScale.test.ts` suite green)

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/solarSystem/sceneScale.ts packages/app/test/sceneScale.test.ts
git commit -m "Add realistic/explorer scene-scale interpolation module"
```

---

### Task 3: Generic multi-body rendering

**Files:**
- Modify: `packages/app/src/main.ts` (replace hardcoded Sun+Earth rendering)
- Modify: `packages/app/src/camera/orbitCamera.ts:34` (bump default `maxRadius`)

**Interfaces:**
- Consumes: `SUN`, `PLANETS`, `BodyDefinition`, `AU_KM` from Task 1; `scaledPosition`,
  `scaledBodyRadiusUnits` from Task 2.
- Produces: module-scope `let scaleBlend = 1` in `main.ts` (temporary hardcoded value — Task 6
  wires this to a UI slider; do not remove it, just stop hardcoding it).

- [ ] **Step 1: Bump `OrbitCamera`'s default `maxRadius`**

In `packages/app/src/camera/orbitCamera.ts`, at the line `this.maxRadius = options.maxRadius ?? 500`,
change `500` to `700`. Realistic-scale Neptune sits at `30.1 AU * 20 units/AU ≈ 602` scene units;
`700` gives headroom to zoom out past it. (The existing test at
`packages/app/test/orbitCamera.test.ts:35` explicitly passes `maxRadius: 500` as a constructor
option, so it is unaffected by this default change.)

- [ ] **Step 2: Rewrite `packages/app/src/main.ts`**

Replace the file's contents with:

```typescript
import { mat4, vec3 } from 'gl-matrix'
import {
  calendarToJulianDay,
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
import { AU_KM, PLANETS, SUN, type BodyDefinition } from './solarSystem/bodies'
import { scaledBodyRadiusUnits, scaledPosition } from './solarSystem/sceneScale'
import {
  createLitPipeline,
  createMeshBuffers,
  createUnlitPipeline,
  initWebGpu,
  type MeshBuffers,
} from './renderer/webgpu'

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Required element ${selector} not found.`)
  return element
}

function currentJulianMillennia(date: Date): number {
  const julianDay = calendarToJulianDay(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate() + date.getUTCHours() / 24,
  )
  return julianMillenniaSinceJ2000(julianDay)
}

// Returns a planet's true AU-space position (unscaled) and its true distance from the Sun.
function planetAuPosition(
  planet: BodyDefinition,
  T: number,
): { x: number; y: number; z: number; distanceAu: number } {
  const position = planet.position
  if (!position) throw new Error(`${planet.id} has no position data.`)
  const longitude = position.longitude(T)
  const latitude = position.latitude(T)
  const distanceAu = position.distance(T)
  return {
    x: sphericalToX(longitude, latitude, distanceAu),
    y: sphericalToY(longitude, latitude, distanceAu),
    z: sphericalToZ(longitude, latitude, distanceAu),
    distanceAu,
  }
}

interface BodyRenderable {
  definition: BodyDefinition
  uniformBuffer: GPUBuffer
  bindGroup: GPUBindGroup
}

function createBodyRenderable(
  device: GPUDevice,
  pipeline: GPURenderPipeline,
  definition: BodyDefinition,
  uniformFloatCount: number,
): BodyRenderable {
  const uniformBuffer = device.createBuffer({
    label: `${definition.id} uniforms`,
    size: uniformFloatCount * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  })
  return { definition, uniformBuffer, bindGroup }
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

  const sunRenderable = createBodyRenderable(device, unlitPipeline, SUN, 20)
  const planetRenderables = PLANETS.map((planet) => createBodyRenderable(device, litPipeline, planet, 40))

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

  // Temporary hardcoded value — Task 6 wires this to a UI slider (0 = realistic, 1 = explorer).
  const scaleBlend = 1

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
    const T = currentJulianMillennia(simulationClock.getCurrentDate())

    const sunRadius = scaledBodyRadiusUnits(SUN.radiusKm, SUN.explorerVisualRadius, scaleBlend, AU_KM)
    const sunWorld = mat4.fromScaling(mat4.create(), [sunRadius, sunRadius, sunRadius])
    const sunWVP = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, sunWorld))
    const sunUniforms = new Float32Array(20)
    sunUniforms.set(sunWVP, 0)
    sunUniforms.set([...SUN.color, 1.0], 16)
    device.queue.writeBuffer(sunRenderable.uniformBuffer, 0, sunUniforms)

    for (const renderable of planetRenderables) {
      const { x, y, z, distanceAu } = planetAuPosition(renderable.definition, T)
      const [sx, sy, sz] = scaledPosition(x, y, z, distanceAu, scaleBlend)
      const radius = scaledBodyRadiusUnits(
        renderable.definition.radiusKm,
        renderable.definition.explorerVisualRadius,
        scaleBlend,
        AU_KM,
      )
      const world = mat4.multiply(
        mat4.create(),
        mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
        mat4.fromScaling(mat4.create(), [radius, radius, radius]),
      )
      const wvp = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, world))
      const lightDirection = vec3.normalize(vec3.create(), vec3.fromValues(sx, sy, sz))
      const uniforms = new Float32Array(40)
      uniforms.set(wvp, 0)
      uniforms.set(world, 16)
      uniforms.set([...renderable.definition.color, 1.0], 32)
      uniforms.set([...lightDirection, 0], 36)
      device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
    }

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
    drawBody(pass, unlitPipeline, meshBuffers, sunRenderable.bindGroup)
    for (const renderable of planetRenderables) {
      drawBody(pass, litPipeline, meshBuffers, renderable.bindGroup)
    }
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

Note: this step deliberately removes the file's previous `earthPositionInSceneUnits` helper,
`AU_TO_SCENE_UNITS`/`SUN_VISUAL_RADIUS`/`EARTH_VISUAL_RADIUS` constants (superseded by the body
registry and `sceneScale.ts`), and the `earthHeliocentric*` imports (Earth is now just another
entry in `PLANETS`, rendered by the same generic loop).

- [ ] **Step 3: Run unit tests**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: PASS (no unit tests reference the removed Earth-specific helpers/constants)

- [ ] **Step 4: Run the existing e2e test**

Run: `npm run test:e2e --workspace=@toboldlyglow/app`
Expected: PASS — `scaffold.spec.ts`'s `data-rendered` assertion now exercises 9 bind
groups/uniform buffers (Sun + 8 planets) instead of 2, so this also functions as an integration
check that every planet's pipeline/bind-group setup is valid.

- [ ] **Step 5: Manual visual check**

Run `npm run dev --workspace=@toboldlyglow/app`, open the dev server URL, and confirm all 8
planets are visible orbiting the Sun (at `scaleBlend = 1`, the "explorer" endpoint, distances are
log-compressed so all 8 should fit on screen at the default camera radius of 65 — if the outer
planets are cut off, that's fine, the user can zoom out with the orbit camera's scroll/pinch).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/main.ts packages/app/src/camera/orbitCamera.ts
git commit -m "Render all 8 planets generically via the body registry"
```

---

### Task 4: Antialiasing (MSAA)

**Files:**
- Modify: `packages/app/src/renderer/webgpu.ts`
- Modify: `packages/app/src/main.ts`

**Interfaces:**
- Produces: `SAMPLE_COUNT` exported constant; `GpuContext.multisampleColorTexture: GPUTexture`.
- Consumes: existing `GpuContext`, `createLitPipeline`, `createUnlitPipeline` from this same file.

- [ ] **Step 1: Modify `packages/app/src/renderer/webgpu.ts`**

Add near the top of the file, after the imports:

```typescript
export const SAMPLE_COUNT = 4
```

Change the `GpuContext` interface to:

```typescript
export interface GpuContext {
  device: GPUDevice
  context: GPUCanvasContext
  format: GPUTextureFormat
  depthTexture: GPUTexture
  multisampleColorTexture: GPUTexture
}
```

Change `initWebGpu`'s texture creation (replacing the existing `depthTexture` creation and
`return` statement) to:

```typescript
  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    sampleCount: SAMPLE_COUNT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })

  const multisampleColorTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format,
    sampleCount: SAMPLE_COUNT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })

  return { device, context, format, depthTexture, multisampleColorTexture }
```

In both `createLitPipeline` and `createUnlitPipeline`, add a `multisample` field to the
`createRenderPipelineAsync` descriptor (alongside the existing `primitive` and `depthStencil`
fields):

```typescript
    multisample: { count: SAMPLE_COUNT },
```

- [ ] **Step 2: Modify `packages/app/src/main.ts`**

In `main()`, change the destructuring of `initWebGpu`'s result to include the new texture:

```typescript
  const { device, context, format, depthTexture, multisampleColorTexture } = await initWebGpu(canvas)
```

In `frame()`, change the render pass's `colorAttachments` entry to render into the multisampled
texture and resolve into the canvas's current texture:

```typescript
      colorAttachments: [
        {
          view: multisampleColorTexture.createView(),
          resolveTarget: context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
          loadOp: 'clear',
          storeOp: 'discard',
        },
      ],
```

(`storeOp: 'discard'` is correct here — the multisampled texture's own contents don't need to
persist once resolved into `resolveTarget`.)

- [ ] **Step 3: Run the e2e test**

Run: `npm run test:e2e --workspace=@toboldlyglow/app`
Expected: PASS. WebGPU validates that a pipeline's `multisample.count` matches its render pass
attachments' `sampleCount` at draw time — if the counts were mismatched, `pass.drawIndexed` would
raise a validation error, `data-rendered` would never be set, and this test would fail. Passing
here is a real correctness check, not just a smoke test.

- [ ] **Step 4: Deliberate-breakage check (established project convention)**

Temporarily hardcode `multisample: { count: 1 }` directly in `createLitPipeline`'s
`createRenderPipelineAsync` call (in `webgpu.ts`), while leaving everything else — including
`multisampleColorTexture`'s and `depthTexture`'s `sampleCount: SAMPLE_COUNT` (4) in `initWebGpu`,
and `createUnlitPipeline`'s `multisample.count` — untouched. This creates a genuine mismatch: the
render pass's attachments are 4x multisampled but this one pipeline claims to be single-sampled.
Run the e2e test again and confirm it now **fails** (WebGPU raises a validation error when
`pass.drawIndexed` is called with a pipeline whose `multisample.count` doesn't match the pass's
attachments, so `data-rendered` is never set). Then revert the hardcoded `count: 1` back to
`SAMPLE_COUNT` and re-run to confirm the test **passes** again. Report both results in the task's
self-review.

- [ ] **Step 5: Manual visual check**

Run `npm run dev --workspace=@toboldlyglow/app` and confirm sphere edges look smoother
(anti-aliased) than a jagged/stair-stepped edge.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/renderer/webgpu.ts packages/app/src/main.ts
git commit -m "Add 4x MSAA antialiasing to the sphere render pipelines"
```

---

### Task 5: Orbit path rendering + toggle plumbing

**Files:**
- Modify: `packages/app/src/renderer/shaders.ts` (add line shader)
- Modify: `packages/app/src/renderer/webgpu.ts` (add line pipeline + buffer helpers)
- Create: `packages/app/src/solarSystem/orbitPath.ts`
- Test: `packages/app/test/orbitPath.test.ts`
- Modify: `packages/app/src/main.ts` (wire up orbit-path rendering; UI toggle comes in Task 6)

**Interfaces:**
- Consumes: `BodyDefinition`, `PLANETS` from Task 1; `scaledPosition` from Task 2.
- Produces: `generateOrbitPathPositions(planet, blend): Float32Array`, `createLinePipeline`,
  `createOrbitPathBuffer`, `updateOrbitPathBuffer` — the last two consumed by Task 6's slider
  handler (to regenerate paths when the scale blend changes).

- [ ] **Step 1: Add the line shader to `packages/app/src/renderer/shaders.ts`**

Append to the end of the file:

```typescript
// Uniform layout: [0..16) worldViewProjection : mat4x4f, [16..20) color : vec4f
// Positions supplied to this pipeline are already in world space (see orbitPath.ts), so
// worldViewProjection here is really just projection * view — no separate world matrix needed.
export const lineShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  color: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return uni.worldViewProjection * vec4f(position, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
  return uni.color;
}
`
```

- [ ] **Step 2: Add the line pipeline and buffer helpers to `packages/app/src/renderer/webgpu.ts`**

Add the import:

```typescript
import { lineShaderCode, litSphereShaderCode, unlitSphereShaderCode } from './shaders'
```

(replacing the existing `import { litSphereShaderCode, unlitSphereShaderCode } from './shaders'`)

Append to the end of the file:

```typescript
const LINE_POSITION_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 3 * 4,
  attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
}

export async function createLinePipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'orbit line shader', code: lineShaderCode })
  return await device.createRenderPipelineAsync({
    label: 'orbit line pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [LINE_POSITION_BUFFER_LAYOUT] },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'line-strip' },
    multisample: { count: SAMPLE_COUNT },
    // depthWriteEnabled: false — orbit lines shouldn't occlude each other or leave depth marks
    // that could z-fight against the sphere meshes; depthCompare 'less' still hides line segments
    // that pass behind a planet or the Sun.
    depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' },
  })
}

export function createOrbitPathBuffer(device: GPUDevice, initialPoints: Float32Array): GPUBuffer {
  const buffer = device.createBuffer({
    label: 'orbit path positions',
    size: initialPoints.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(buffer, 0, initialPoints as BufferSource)
  return buffer
}

export function updateOrbitPathBuffer(device: GPUDevice, buffer: GPUBuffer, points: Float32Array): void {
  device.queue.writeBuffer(buffer, 0, points as BufferSource)
}
```

- [ ] **Step 3: Write `packages/app/src/solarSystem/orbitPath.ts`**

```typescript
import { sphericalToX, sphericalToY, sphericalToZ } from '@toboldlyglow/engine'
import type { BodyDefinition } from './bodies'
import { scaledPosition } from './sceneScale'

const ORBIT_PATH_SEGMENTS = 128
const DAYS_PER_JULIAN_MILLENNIUM = 365_250

// Samples one full sidereal orbit at evenly spaced time steps (not evenly spaced angles) and
// returns a closed line-strip: point 0 and the last point are both T=0 through T=period, so
// drawing this with topology 'line-strip' produces a fully closed loop.
export function generateOrbitPathPositions(planet: BodyDefinition, blend: number): Float32Array {
  const position = planet.position
  if (!position || planet.siderealPeriodDays === null) {
    throw new Error(`${planet.id} has no orbital position/period data for an orbit path.`)
  }
  const points = new Float32Array((ORBIT_PATH_SEGMENTS + 1) * 3)
  for (let i = 0; i <= ORBIT_PATH_SEGMENTS; i++) {
    const days = (i / ORBIT_PATH_SEGMENTS) * planet.siderealPeriodDays
    const T = days / DAYS_PER_JULIAN_MILLENNIUM
    const longitude = position.longitude(T)
    const latitude = position.latitude(T)
    const distanceAu = position.distance(T)
    const x = sphericalToX(longitude, latitude, distanceAu)
    const y = sphericalToY(longitude, latitude, distanceAu)
    const z = sphericalToZ(longitude, latitude, distanceAu)
    const [sx, sy, sz] = scaledPosition(x, y, z, distanceAu, blend)
    points[i * 3] = sx
    points[i * 3 + 1] = sy
    points[i * 3 + 2] = sz
  }
  return points
}
```

- [ ] **Step 4: Write `packages/app/test/orbitPath.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { generateOrbitPathPositions } from '../src/solarSystem/orbitPath'
import { PLANETS } from '../src/solarSystem/bodies'
import { AU_TO_SCENE_UNITS } from '../src/solarSystem/sceneScale'

describe('generateOrbitPathPositions', () => {
  const earth = PLANETS.find((p) => p.id === 'earth')!

  it('produces a closed loop: first and last points are the same start-of-orbit position', () => {
    const points = generateOrbitPathPositions(earth, 0)
    const n = points.length
    expect(points[0]).toBeCloseTo(points[n - 3], 6)
    expect(points[1]).toBeCloseTo(points[n - 2], 6)
    expect(points[2]).toBeCloseTo(points[n - 1], 6)
  })

  it("every sampled point sits close to Earth's ~1 AU mean orbital radius at realistic scale", () => {
    const points = generateOrbitPathPositions(earth, 0)
    for (let i = 0; i < points.length; i += 3) {
      const distance = Math.sqrt(points[i] ** 2 + points[i + 1] ** 2 + points[i + 2] ** 2)
      expect(distance).toBeGreaterThan(0.9 * AU_TO_SCENE_UNITS)
      expect(distance).toBeLessThan(1.1 * AU_TO_SCENE_UNITS)
    }
  })

  it('throws for a body with no orbital data (guards against passing the Sun by mistake)', () => {
    const fakeBody = { ...earth, position: null, siderealPeriodDays: null }
    expect(() => generateOrbitPathPositions(fakeBody, 0)).toThrow()
  })
})
```

- [ ] **Step 5: Wire orbit-path rendering into `packages/app/src/main.ts`**

Add imports:

```typescript
import { generateOrbitPathPositions } from './solarSystem/orbitPath'
import {
  createLinePipeline,
  createLitPipeline,
  createMeshBuffers,
  createOrbitPathBuffer,
  createUnlitPipeline,
  initWebGpu,
  updateOrbitPathBuffer,
  type MeshBuffers,
} from './renderer/webgpu'
```

(replacing the existing `renderer/webgpu` import block)

After the `const planetRenderables = ...` line, add:

```typescript
  const linePipeline = await createLinePipeline(device, format)

  interface OrbitPathRenderable {
    definition: BodyDefinition
    vertexBuffer: GPUBuffer
    uniformBuffer: GPUBuffer
    bindGroup: GPUBindGroup
  }

  const orbitPathRenderables: OrbitPathRenderable[] = PLANETS.map((planet) => {
    const vertexBuffer = createOrbitPathBuffer(device, generateOrbitPathPositions(planet, scaleBlend))
    const uniformBuffer = device.createBuffer({
      label: `${planet.id} orbit path uniforms`,
      size: 20 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const bindGroup = device.createBindGroup({
      layout: linePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })
    return { definition: planet, vertexBuffer, uniformBuffer, bindGroup }
  })

  let showOrbitPaths = true
```

(Note: `scaleBlend` is currently `const` from Task 3 — Task 6 changes it to `let`.)

In `frame()`, after the existing planet-uniforms loop (after the `for (const renderable of
planetRenderables) { ... }` block that writes `renderable.uniformBuffer`) and before `const
encoder = ...`, add:

```typescript
    if (showOrbitPaths) {
      const viewProjection = mat4.multiply(mat4.create(), projection, view)
      for (const path of orbitPathRenderables) {
        const uniforms = new Float32Array(20)
        uniforms.set(viewProjection, 0)
        uniforms.set([...path.definition.color, 0.5], 16)
        device.queue.writeBuffer(path.uniformBuffer, 0, uniforms)
      }
    }
```

In the render pass, after the existing `for (const renderable of planetRenderables) { drawBody(...)
}` loop and before `pass.end()`, add:

```typescript
    if (showOrbitPaths) {
      pass.setPipeline(linePipeline)
      for (const path of orbitPathRenderables) {
        pass.setVertexBuffer(0, path.vertexBuffer)
        pass.setBindGroup(0, path.bindGroup)
        pass.draw(129) // ORBIT_PATH_SEGMENTS + 1 points, see orbitPath.ts
      }
    }
```

- [ ] **Step 6: Run unit tests**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: PASS (new `orbitPath.test.ts` suite green)

- [ ] **Step 7: Run e2e test and manual visual check**

Run: `npm run test:e2e --workspace=@toboldlyglow/app` — expect PASS.
Run `npm run dev --workspace=@toboldlyglow/app` and confirm each planet has a visible elliptical
path traced around the Sun.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/renderer/shaders.ts packages/app/src/renderer/webgpu.ts \
  packages/app/src/solarSystem/orbitPath.ts packages/app/test/orbitPath.test.ts packages/app/src/main.ts
git commit -m "Render orbit paths for all planets"
```

---

### Task 6: Scale slider + orbit-path toggle UI

**Files:**
- Modify: `packages/app/index.html`
- Modify: `packages/app/src/main.ts`

**Interfaces:**
- Consumes: `scaleBlend` (changes from `const` to `let`), `showOrbitPaths` (already `let` from
  Task 5), `updateOrbitPathBuffer`, `generateOrbitPathPositions`, `orbitPathRenderables` — all from
  Tasks 3/5.
- Produces: `canvas.dataset.scaleBlend` and `canvas.dataset.orbitPaths` — testable hooks for
  Task 7's e2e test, following the same pattern as the existing `canvas.dataset.rendered` flag.

- [ ] **Step 1: Add controls to `packages/app/index.html`**

Add these two elements right before the closing `</body>` tag's `<script>` line (i.e., after the
existing `#time-controls` div, before `<script type="module" src="/src/main.ts"></script>`):

```html
    <div
      id="scale-controls"
      style="position: fixed; top: 12px; right: 12px; padding: 8px 12px; font: 14px sans-serif; background: rgba(0,0,0,0.6); color: white; border-radius: 4px; display: flex; align-items: center; gap: 8px;"
    >
      <span>Realistic</span>
      <input id="scale-slider" type="range" min="0" max="100" value="100" style="width: 150px;" />
      <span>Explorer</span>
    </div>
    <label
      id="orbit-paths-label"
      style="position: fixed; top: 56px; right: 12px; padding: 8px 12px; font: 14px sans-serif; background: rgba(0,0,0,0.6); color: white; border-radius: 4px; display: flex; align-items: center; gap: 8px; cursor: pointer;"
    >
      <input id="orbit-paths-toggle" type="checkbox" checked />
      Show orbit paths
    </label>
```

- [ ] **Step 2: Wire the controls in `packages/app/src/main.ts`**

Change the `scaleBlend` declaration from:

```typescript
  // Temporary hardcoded value — Task 6 wires this to a UI slider (0 = realistic, 1 = explorer).
  const scaleBlend = 1
```

to:

```typescript
  // Starts fully "Explorer" (1) for a legible initial view — at "Realistic" (0), the inner
  // planets are indistinguishable from the Sun at any reasonable camera distance. The slider
  // lets the user dial toward "Realistic" to see true relative scale/distance.
  let scaleBlend = 1

  function refreshOrbitPaths(): void {
    for (const path of orbitPathRenderables) {
      updateOrbitPathBuffer(device, path.vertexBuffer, generateOrbitPathPositions(path.definition, scaleBlend))
    }
  }

  const scaleSlider = requireElement<HTMLInputElement>('#scale-slider')
  scaleSlider.addEventListener('input', () => {
    scaleBlend = Number(scaleSlider.value) / 100
    canvas.dataset.scaleBlend = String(scaleBlend)
    refreshOrbitPaths()
  })

  const orbitPathsToggle = requireElement<HTMLInputElement>('#orbit-paths-toggle')
  orbitPathsToggle.addEventListener('change', () => {
    showOrbitPaths = orbitPathsToggle.checked
    canvas.dataset.orbitPaths = String(showOrbitPaths)
  })
```

(This replaces the old hardcoded-`const` line; `refreshOrbitPaths` uses `orbitPathRenderables`,
`device`, `updateOrbitPathBuffer`, and `generateOrbitPathPositions`, all already in scope from
Task 5.)

- [ ] **Step 3: Run unit tests**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: PASS

- [ ] **Step 4: Manual visual check**

Run `npm run dev --workspace=@toboldlyglow/app`. Drag the scale slider from Explorer to Realistic
and confirm the planets visibly spread apart and shrink; toggle "Show orbit paths" off and confirm
the path lines disappear.

- [ ] **Step 5: Commit**

```bash
git add packages/app/index.html packages/app/src/main.ts
git commit -m "Wire scale slider and orbit-path toggle to the UI"
```

---

### Task 7: E2E coverage + CHANGELOG

**Files:**
- Create: `packages/app/e2e/solarSystem.spec.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `#scale-slider`, `#orbit-paths-toggle`, `canvas.dataset.scaleBlend`,
  `canvas.dataset.orbitPaths` from Task 6; `#scene`'s `data-rendered` from the pre-existing
  renderer-core work.

- [ ] **Step 1: Write `packages/app/e2e/solarSystem.spec.ts`**

```typescript
import { expect, test } from '@playwright/test'

test('all 8 planets render, and the scale + orbit-path controls affect the scene', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Positive control: dragging the scale slider changes the recorded blend value exposed for
  // testing, proving the control is actually wired to the renderer's state — not merely present
  // in the DOM. (Mirrors the time-controls e2e test's positive-control pattern.)
  const slider = page.locator('#scale-slider')
  await expect(slider).toHaveValue('100')
  await slider.fill('0')
  await slider.dispatchEvent('input')
  await expect(page.locator('#scene')).toHaveAttribute('data-scale-blend', '0')

  const toggle = page.locator('#orbit-paths-toggle')
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-orbit-paths', 'false')

  expect(errors).toEqual([])
})
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e --workspace=@toboldlyglow/app`
Expected: PASS (both `scaffold.spec.ts`, `timeControls.spec.ts`, and the new
`solarSystem.spec.ts` green)

- [ ] **Step 3: Update `CHANGELOG.md`**

Read the existing `[Unreleased]` section first (`cat CHANGELOG.md`) and add these bullets under
its `### Added` heading (create the heading if it doesn't already exist in that section):

```markdown
- Render all 8 planets (Mercury through Neptune), not just Earth, orbiting the Sun.
- 4x MSAA antialiasing on all rendered spheres.
- Toggleable orbit-path overlay showing each planet's full orbit.
- Realistic ⇄ Explorer visual scale slider, blending between true-to-scale distances/sizes and a
  compressed, exaggerated view suited for exploration.
```

- [ ] **Step 4: Run the full verification suite**

Run: `npm run lint && npm run typecheck && npm run build && npm test`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/e2e/solarSystem.spec.ts CHANGELOG.md
git commit -m "Add e2e coverage for solar-system rendering and update changelog"
```

## Verification

- `npm run lint && npm run typecheck && npm run build && npm test` all pass.
- `npm run test:e2e --workspace=@toboldlyglow/app` passes, including the new
  `solarSystem.spec.ts`.
- Manual check via `npm run dev`: all 8 planets visible and orbiting, orbit-path lines visible and
  toggleable, scale slider visibly changes planet spacing/size, sphere edges are antialiased.
