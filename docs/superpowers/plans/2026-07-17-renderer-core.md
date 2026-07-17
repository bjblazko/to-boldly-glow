# Renderer Core (Sun + Earth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the project's first visible output on screen: a WebGPU scene showing the Sun (as a
bright, unlit body) and Earth (lit by the Sun, showing a visible day/night terminator) positioned
using the real orbital mechanics already built in `packages/engine`, viewed through a fixed camera.
No textures, no interactive camera, no time control yet — those are each their own next plan.

**Architecture:** Three layers, each independently useful later: (1) a pure, framework-free sphere
mesh generator (testable with Vitest, no GPU needed), (2) a small WebGPU bootstrap + pipeline layer
(`packages/app/src/renderer/`), and (3) scene composition in `main.ts` that calls into
`packages/engine`'s `earthHeliocentricL/B/R` + `sphericalToX/Y/Z` for Earth's real position. Camera
and lighting math use `gl-matrix` (MIT licensed, added as a new dependency — hand-rolling 4×4
matrix/perspective/lookAt math is exactly the kind of numerically-tricky code this project has
avoided elsewhere; `gl-matrix` is the standard, heavily-tested choice for WebGPU/WebGL work and
outputs column-major `Float32Array`s matching WGSL's expected layout directly).

**Tech Stack:** WebGPU (native browser API, no library), WGSL shaders, `gl-matrix` (new dependency,
`packages/app` only), Vitest (new to `packages/app`, for the pure mesh-generation logic), Playwright
(existing).

## Context: scope decisions and a real risk this plan works around

**Visual scale is temporary and hardcoded.** The MVP spec's realistic⇄explorer scale slider (§4.3)
is its own future plan. This plan uses fixed placeholder constants — real astronomical units convert
to scene units via a simple distance multiplier, but body *radii* are visually-chosen placeholders,
not physically accurate ratios (the real Sun/Earth radius ratio is ~109:1; rendering that today would
make Earth sub-pixel, defeating the point of a first visible milestone). This is called out
explicitly in code comments and is expected to be replaced when the scale-toggle plan lands.

**WebGPU is genuinely new to this project and has one confirmed operational risk.** This plan's own
research (verified against MDN, the WebGPU spec, and webgpufundamentals.org as of 2026) confirms the
core rendering API patterns below are current and correct. But headless Chromium on Linux (i.e. this
project's GitHub Actions CI, `ubuntu-latest`) is **not confirmed** to support WebGPU out of the box —
it may need `--enable-unsafe-webgpu` plus software rendering (SwiftShader) flags, and Playwright's
bundled Chromium's exact behavior here is unverified. Rather than guess at CI-specific flags and risk
a flaky or silently-skipped CI job, **this plan's E2E test checks only that the page loads without
errors and that `navigator.gpu` exists** — not pixel output. The primary verification for "does it
actually render correctly" in this plan is a manual dev-server check (Step included in each
rendering task). Getting full CI-headless pixel verification working is flagged as a follow-up, not
solved here.

## Global Constraints

(Copied verbatim from the design spec and prior plans; every task below implicitly inherits these.)

- Renderer: WebGPU only, no WebGL2 fallback (spec §3.2).
- UI layer: plain TypeScript + DOM, no framework (still true — this plan adds WebGPU/canvas code,
  not a UI framework).
- `packages/engine`'s existing exports (`earthHeliocentricL/B/R`, `sphericalToX/Y/Z`,
  `calendarToJulianDay`, `julianMillenniaSinceJ2000`) are consumed as-is; this plan does not modify
  `packages/engine`.
- Testing: Vitest for pure logic, Playwright for browser-level checks (spec §7).
- No new runtime network fetch.
- New dependency in this plan: `gl-matrix` (MIT) in `packages/app` only — must be added to
  `CREDITS.md`.

---

### Task 1: Sphere Mesh Generator

**Files:**
- Create: `packages/app/src/geometry/sphere.ts`
- Create: `packages/app/vitest.config.ts`
- Modify: `packages/app/package.json` (add `vitest` devDependency and a `test` script)
- Modify: `package.json` (root; run the app package's new unit tests too)
- Test: `packages/app/test/sphere.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `generateSphereMesh(radius: number, latSegments: number, lonSegments: number): SphereMesh`
  where `SphereMesh = { positions: Float32Array, normals: Float32Array, indices: Uint32Array }` —
  Task 2 and Task 3 both call this to build the geometry buffers they upload to the GPU.

- [ ] **Step 1: Add Vitest to `packages/app`**

Modify `packages/app/package.json` — add to `scripts` and `devDependencies`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test"
},
"devDependencies": {
  "@playwright/test": "^1.47.0",
  "typescript": "^5.6.0",
  "vite": "^5.4.0",
  "vitest": "^2.1.0"
}
```

Create `packages/app/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
```

Modify root `package.json`'s `test` script to also run the app's new unit tests:

```json
"test": "npm run test --workspace=@toboldlyglow/engine && npm run test --workspace=@toboldlyglow/app",
```

- [ ] **Step 2: Write the failing test**

`packages/app/test/sphere.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { generateSphereMesh } from '../src/geometry/sphere'

describe('generateSphereMesh', () => {
  const radius = 2.5
  const latSegments = 8
  const lonSegments = 12
  const mesh = generateSphereMesh(radius, latSegments, lonSegments)

  it('produces the expected vertex and index counts', () => {
    const expectedVertexCount = (latSegments + 1) * (lonSegments + 1)
    expect(mesh.positions.length).toBe(expectedVertexCount * 3)
    expect(mesh.normals.length).toBe(expectedVertexCount * 3)
    expect(mesh.indices.length).toBe(latSegments * lonSegments * 6)
  })

  it('places every vertex at the given radius from the origin', () => {
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i]
      const y = mesh.positions[i + 1]
      const z = mesh.positions[i + 2]
      const distance = Math.sqrt(x * x + y * y + z * z)
      expect(distance).toBeCloseTo(radius, 5)
    }
  })

  it('gives every vertex a unit-length outward normal', () => {
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const x = mesh.normals[i]
      const y = mesh.normals[i + 1]
      const z = mesh.normals[i + 2]
      const length = Math.sqrt(x * x + y * y + z * z)
      expect(length).toBeCloseTo(1, 5)
    }
  })

  it('keeps position and normal proportional (position = radius * normal)', () => {
    for (let i = 0; i < mesh.positions.length; i++) {
      expect(mesh.positions[i]).toBeCloseTo(radius * mesh.normals[i], 5)
    }
  })

  it('references only valid vertex indices', () => {
    const vertexCount = mesh.positions.length / 3
    for (const index of mesh.indices) {
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(vertexCount)
    }
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm install` (from repo root, to pick up the new `vitest` devDependency), then
`npm run test --workspace=@toboldlyglow/app`
Expected: FAIL — `generateSphereMesh` is not defined / module not found.

- [ ] **Step 4: Implement `packages/app/src/geometry/sphere.ts`**

```typescript
export interface SphereMesh {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

// Generates a UV sphere: latSegments bands from pole to pole, lonSegments bands around each
// latitude circle. A unit sphere's outward normal at any point equals that point's position
// divided by its radius, so positions and normals share the same generation loop.
export function generateSphereMesh(radius: number, latSegments: number, lonSegments: number): SphereMesh {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  for (let lat = 0; lat <= latSegments; lat++) {
    const theta = (lat * Math.PI) / latSegments
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)

    for (let lon = 0; lon <= lonSegments; lon++) {
      const phi = (lon * 2 * Math.PI) / lonSegments
      const sinPhi = Math.sin(phi)
      const cosPhi = Math.cos(phi)

      const x = cosPhi * sinTheta
      const y = cosTheta
      const z = sinPhi * sinTheta

      positions.push(radius * x, radius * y, radius * z)
      normals.push(x, y, z)
    }
  }

  for (let lat = 0; lat < latSegments; lat++) {
    for (let lon = 0; lon < lonSegments; lon++) {
      const first = lat * (lonSegments + 1) + lon
      const second = first + lonSegments + 1

      indices.push(first, second, first + 1)
      indices.push(second, second + 1, first + 1)
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: PASS — all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/geometry/sphere.ts packages/app/vitest.config.ts packages/app/package.json packages/app/test/sphere.test.ts package.json package-lock.json
git commit -m "feat(app): add procedural sphere mesh generator"
```

---

### Task 2: WebGPU Pipeline — One Static Lit Sphere

**Files:**
- Create: `packages/app/src/renderer/shaders.ts`
- Create: `packages/app/src/renderer/webgpu.ts`
- Modify: `packages/app/src/main.ts`
- Modify: `packages/app/index.html`
- Modify: `packages/app/package.json` (add `gl-matrix` dependency)
- Modify: `packages/app/e2e/scaffold.spec.ts` → replaced by a WebGPU-aware check (see Step 6)

**Interfaces:**
- Consumes: `generateSphereMesh` (Task 1).
- Produces: `initWebGpu(canvas)`, `createLitPipeline(device, format)`, `createMeshBuffers(device, mesh)`
  — all reused unchanged by Task 3, which adds a second (unlit) pipeline and a second body.

This task's only goal is to prove the WebGPU pipeline works end-to-end: one sphere, fixed camera,
fixed light direction, no orbital data yet.

- [ ] **Step 1: Add `gl-matrix` to `packages/app/package.json`**

```json
"dependencies": {
  "@toboldlyglow/engine": "*",
  "gl-matrix": "^3.4.3"
}
```

Run: `npm install` (from repo root).

- [ ] **Step 2: Create `packages/app/src/renderer/shaders.ts`**

```typescript
// Uniform layout (must match the Float32Array packing in main.ts exactly):
//   [0..16)  worldViewProjection : mat4x4f
//   [16..32) world               : mat4x4f
//   [32..36) color               : vec4f
//   [36..40) lightDirection      : vec4f (xyz used, w unused — vec4 avoids WGSL's vec3
//                                 trailing-padding alignment gotcha in uniform buffers)
export const litSphereShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightDirection: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.normal = (uni.world * vec4f(vert.normal, 0.0)).xyz;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let brightness = max(dot(normal, -uni.lightDirection.xyz), 0.0) * 0.9 + 0.1;
  return vec4f(uni.color.rgb * brightness, uni.color.a);
}
`
```

- [ ] **Step 3: Create `packages/app/src/renderer/webgpu.ts`**

```typescript
import type { SphereMesh } from '../geometry/sphere'
import { litSphereShaderCode } from './shaders'

export interface GpuContext {
  device: GPUDevice
  context: GPUCanvasContext
  format: GPUTextureFormat
  depthTexture: GPUTexture
}

export async function initWebGpu(canvas: HTMLCanvasElement): Promise<GpuContext> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser.')
  }
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new Error('No WebGPU adapter available.')
  }
  const device = await adapter.requestDevice()

  const context = canvas.getContext('webgpu')
  if (!context) {
    throw new Error('Failed to get a WebGPU canvas context.')
  }
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format })

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })

  return { device, context, format, depthTexture }
}

const POSITION_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 3 * 4,
  attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
}

const NORMAL_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 3 * 4,
  attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }],
}

export function createLitPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const module = device.createShaderModule({ label: 'lit sphere shader', code: litSphereShaderCode })
  return device.createRenderPipeline({
    label: 'lit sphere pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [POSITION_BUFFER_LAYOUT, NORMAL_BUFFER_LAYOUT] },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
  })
}

export interface MeshBuffers {
  positionBuffer: GPUBuffer
  normalBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  indexCount: number
}

export function createMeshBuffers(device: GPUDevice, mesh: SphereMesh): MeshBuffers {
  const positionBuffer = device.createBuffer({
    label: 'sphere positions',
    size: mesh.positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(positionBuffer, 0, mesh.positions)

  const normalBuffer = device.createBuffer({
    label: 'sphere normals',
    size: mesh.normals.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(normalBuffer, 0, mesh.normals)

  const indexBuffer = device.createBuffer({
    label: 'sphere indices',
    size: mesh.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(indexBuffer, 0, mesh.indices)

  return { positionBuffer, normalBuffer, indexBuffer, indexCount: mesh.indices.length }
}
```

- [ ] **Step 4: Replace `packages/app/index.html`'s body**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>To Boldly Glow</title>
  </head>
  <body>
    <canvas id="scene"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Replace `packages/app/src/main.ts`**

```typescript
import { mat4 } from 'gl-matrix'
import { generateSphereMesh } from './geometry/sphere'
import { createLitPipeline, createMeshBuffers, initWebGpu } from './renderer/webgpu'

async function main() {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene')
  if (!canvas) throw new Error('Canvas element #scene not found.')
  canvas.width = 800
  canvas.height = 600

  const { device, context, format, depthTexture } = await initWebGpu(canvas)
  const pipeline = createLitPipeline(device, format)
  const mesh = generateSphereMesh(1, 32, 32)
  const buffers = createMeshBuffers(device, mesh)

  // Uniforms: worldViewProjection(16) + world(16) + color(4) + lightDirection(4) = 40 floats.
  const uniformBuffer = device.createBuffer({
    label: 'sphere uniforms',
    size: 40 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  })

  const projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, 0.1, 100)
  const view = mat4.lookAt(mat4.create(), [0, 0, 5], [0, 0, 0], [0, 1, 0])
  const world = mat4.identity(mat4.create())
  const worldViewProjection = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, world))

  const uniformData = new Float32Array(40)
  uniformData.set(worldViewProjection, 0)
  uniformData.set(world, 16)
  uniformData.set([0.6, 0.6, 0.65, 1.0], 32) // color
  const lightDirection = [0.3, -0.5, -1.0]
  const lightLength = Math.hypot(...lightDirection)
  uniformData.set(lightDirection.map((v) => v / lightLength), 36) // lightDirection.xyz, .w stays 0
  device.queue.writeBuffer(uniformBuffer, 0, uniformData)

  function frame() {
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
    pass.setPipeline(pipeline)
    pass.setVertexBuffer(0, buffers.positionBuffer)
    pass.setVertexBuffer(1, buffers.normalBuffer)
    pass.setIndexBuffer(buffers.indexBuffer, 'uint32')
    pass.setBindGroup(0, bindGroup)
    pass.drawIndexed(buffers.indexCount)
    pass.end()
    device.queue.submit([encoder.finish()])
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

- [ ] **Step 6: Replace the scaffold's Playwright test**

The old `packages/app/e2e/scaffold.spec.ts` asserted on the removed `#app` text content. Replace its
contents (same file, same purpose — "does the app boot cleanly" — updated for the new page):

```typescript
import { expect, test } from '@playwright/test'

test('app boots, WebGPU is available, and no page errors occur', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toBeAttached()

  const hasWebGpu = await page.evaluate(() => 'gpu' in navigator)
  expect(hasWebGpu).toBe(true)

  // Give the async main() a moment to initialize the device and submit a frame.
  await page.waitForTimeout(500)
  expect(errors).toEqual([])
})
```

(Full pixel-level rendering verification is intentionally out of scope for this test — see this
plan's Context section on the CI-headless-WebGPU risk. This test only confirms the page loads, the
API surface exists, and nothing threw.)

- [ ] **Step 7: Manually verify the sphere actually renders**

Run: `npm run dev --workspace=@toboldlyglow/app`, open the printed URL in a real browser (Chrome or
Edge — current stable versions support WebGPU on desktop).
Expected: a single sphere is visible, lit from one side with a visible dark/light gradient (not a
flat silhouette). If nothing appears, check the browser console for WebGPU errors before proceeding
— do not adjust shader/pipeline code to "make something appear" without understanding the actual
error.

- [ ] **Step 8: Run the existing test suites to confirm no regressions**

Run: `npm run test --workspace=@toboldlyglow/app` (mesh generator tests, still pure/fast)
Run: `npx playwright install --with-deps chromium` (if not already installed)
Run: `npm run test:e2e --workspace=@toboldlyglow/app`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/renderer/shaders.ts packages/app/src/renderer/webgpu.ts packages/app/src/main.ts packages/app/index.html packages/app/package.json packages/app/package-lock.json packages/app/e2e/scaffold.spec.ts package-lock.json
git commit -m "feat(app): render a single lit sphere with WebGPU"
```

---

### Task 3: Two-Body Scene — Sun and Earth with Real Positions

**Files:**
- Modify: `packages/app/src/renderer/shaders.ts` (add the unlit shader)
- Modify: `packages/app/src/renderer/webgpu.ts` (add `createUnlitPipeline`)
- Modify: `packages/app/src/main.ts` (replace the single-sphere scene with Sun + Earth)
- Modify: `CREDITS.md` (attribute `gl-matrix`)

**Interfaces:**
- Consumes: `earthHeliocentricL`, `earthHeliocentricB`, `earthHeliocentricR`,
  `sphericalToX/Y/Z`, `calendarToJulianDay`, `julianMillenniaSinceJ2000` (all from
  `@toboldlyglow/engine`, already implemented); `generateSphereMesh`, `initWebGpu`,
  `createLitPipeline`, `createMeshBuffers` (Tasks 1-2).
- Produces: the running scene in `main.ts`. No new exported functions — this task is integration,
  not a new reusable module.

- [ ] **Step 1: Add the unlit shader to `packages/app/src/renderer/shaders.ts`**

Append (keep `litSphereShaderCode` unchanged):

```typescript
// Uniform layout: [0..16) worldViewProjection : mat4x4f, [16..20) color : vec4f
export const unlitSphereShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  color: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(vert: VertexInput) -> @builtin(position) vec4f {
  return uni.worldViewProjection * vec4f(vert.position, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
  return uni.color;
}
`
```

- [ ] **Step 2: Add `createUnlitPipeline` to `packages/app/src/renderer/webgpu.ts`**

Add the import and function (keep everything else in the file unchanged):

```typescript
import { litSphereShaderCode, unlitSphereShaderCode } from './shaders'
```

```typescript
export function createUnlitPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const module = device.createShaderModule({ label: 'unlit sphere shader', code: unlitSphereShaderCode })
  return device.createRenderPipeline({
    label: 'unlit sphere pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [POSITION_BUFFER_LAYOUT, NORMAL_BUFFER_LAYOUT] },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
  })
}
```

- [ ] **Step 3: Replace `packages/app/src/main.ts` with the two-body scene**

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
import {
  createLitPipeline,
  createMeshBuffers,
  createUnlitPipeline,
  initWebGpu,
  type MeshBuffers,
} from './renderer/webgpu'

// TEMPORARY visual scale, not physically accurate. Distance uses real astronomical units
// converted to scene units, so orbital motion is spatially correct; body radii are fixed
// placeholder sizes chosen only so both bodies are visible and distinguishable — the real
// realistic/explorer scale toggle (design spec §4.3) is a separate future plan.
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
  const canvas = document.querySelector<HTMLCanvasElement>('#scene')
  if (!canvas) throw new Error('Canvas element #scene not found.')
  canvas.width = 800
  canvas.height = 600

  const { device, context, format, depthTexture } = await initWebGpu(canvas)
  const litPipeline = createLitPipeline(device, format)
  const unlitPipeline = createUnlitPipeline(device, format)

  const sphereMesh = generateSphereMesh(1, 32, 32)
  const meshBuffers = createMeshBuffers(device, sphereMesh)

  const sunUniformBuffer = device.createBuffer({
    label: 'sun uniforms',
    size: 20 * 4, // worldViewProjection(16) + color(4)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const sunBindGroup = device.createBindGroup({
    layout: unlitPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: sunUniformBuffer } }],
  })

  const earthUniformBuffer = device.createBuffer({
    label: 'earth uniforms',
    size: 40 * 4, // worldViewProjection(16) + world(16) + color(4) + lightDirection(4)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const earthBindGroup = device.createBindGroup({
    layout: litPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: earthUniformBuffer } }],
  })

  const projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, 0.1, 1000)
  const view = mat4.lookAt(mat4.create(), [0, 25, 60], [0, 0, 0], [0, 1, 0])

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

  function frame() {
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

- [ ] **Step 4: Manually verify both bodies render**

Run: `npm run dev --workspace=@toboldlyglow/app`, open the printed URL.
Expected: a bright, flat-colored sphere (the Sun) near the center, and a smaller, visibly-shaded
sphere (Earth) offset from it, showing a light/dark gradient. If Earth is off-screen or the two
overlap awkwardly, adjust the `view` eye position (`[0, 25, 60]`) and/or `AU_TO_SCENE_UNITS` — these
are the plan's only intentionally-tunable aesthetic constants; everything else (positions from the
engine, the shader math) should not need adjustment to "make it look right."

- [ ] **Step 5: Run the full test suite**

Run: `npm run test --workspace=@toboldlyglow/app && npm run test:e2e --workspace=@toboldlyglow/app`
Expected: all pass (the Task 2 E2E test still just checks page-load/no-errors/`navigator.gpu`
presence, which remains valid for the two-body scene).

- [ ] **Step 6: Attribute `gl-matrix` in `CREDITS.md`**

Add a new subsection before the existing "Build tooling" list:

```markdown
## Math library

- [gl-matrix](https://glmatrix.net/) — MIT License (matrix/vector math for the WebGPU renderer:
  perspective/lookAt matrices, vector normalization)
```

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/renderer/shaders.ts packages/app/src/renderer/webgpu.ts packages/app/src/main.ts CREDITS.md
git commit -m "feat(app): render Sun and Earth using real orbital positions"
```

---

## Verification (whole plan)

After all 3 tasks: `npm run lint && npm run typecheck && npm run build && npm test && npm run test:e2e`
from the repo root should all pass. `npm run dev --workspace=@toboldlyglow/app` should show a bright
Sun and a shaded Earth, positioned per today's real orbital data — this is the project's first
visible milestone.

## What's next

- **Camera controller** (free-fly, FOV, touch input) — replaces the fixed `mat4.lookAt` call in
  `main.ts` with real interactivity.
- **Time controller** (play/pause, jog/shuttle) — replaces the hardcoded `new Date()` call in
  `earthPositionInSceneUnits` with a driven simulation clock, making Earth's motion visible over
  time instead of only reflecting "now."
- **Remaining 7 planets** — same pattern as the orbital-mechanics-earth plan (one data file + one
  wrapper file per body), each one an immediately-visible drop-in addition to this renderer once its
  position functions exist, using the same `createLitPipeline` + a new per-planet uniform buffer.
- **Textures** — replace the flat `color` uniforms with actual planet imagery once a texture-loading
  task is planned.
- **CI-headless WebGPU** — investigate whether Playwright's bundled Chromium can render WebGPU
  headlessly on Linux CI (SwiftShader software rendering), so the E2E test can eventually assert real
  pixel output instead of just "no errors."
