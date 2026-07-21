# Surface Relief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Saturn pole-magnification artifact, and add bump mapping, ambient occlusion, a
translucent gas-giant cloud shell, and higher sphere tessellation — per
`docs/superpowers/specs/2026-07-21-surface-relief-design.md`.

**Architecture:** Everything lives in the existing hand-rolled WebGPU renderer
(`packages/app/src/renderer/`, no Three.js). The pole-fade fix and bump/AO work extend the existing
shared `litSphereShaderCode` fragment shader and its uniform struct (no per-body pipelines, no new
vertex attributes — tangent/bitangent are derived analytically from the world-space normal and the
sphere's known local-+Z polar axis, the same trick already used for the ring's own normal). The
cloud shell is a genuinely new, separate alpha-blended pipeline drawing a second, larger instance of
the *same* shared sphere mesh already used for every body.

**Tech Stack:** TypeScript, Vite, WGSL, gl-matrix, WebGPU. `packages/data-pipeline` (Node/tsx) gets
a new offline script; this task adds `sharp` (MIT-licensed) as a devDependency there for JPEG/PNG
decode+encode, since no image-processing library exists in this repo yet and the browser bundle
never sees it (data-pipeline output is a checked-in static asset, not a runtime dependency).

## Global Constraints

- This project has no WGSL unit-test framework — "the test" for shader/rendering-integration changes
  in this plan means: `npm run typecheck`, `npm run build`, the existing Vitest suite for pure
  TypeScript functions, a Playwright e2e smoke test (assert zero `pageerror`s — WebGPU validation
  errors, e.g. a uniform-struct-size or bind-group mismatch, surface as catchable page errors via
  the existing `uncapturederror` listener in `renderer/webgpu.ts:72-74`), and a manual visual check
  in a running browser. This mirrors this session's own established, already-proven pattern for
  every prior shader change — apply it in place of literal red/green unit tests wherever a step
  touches WGSL.
- Every body-uniform-buffer size change must update `LIT_UNIFORM_FLOAT_COUNT` in
  `packages/app/src/renderer/shaders.ts` — never a bare literal at any call site (see that file's
  own comment on why: a mismatch is silently-wrong rendering, not a compile error).
- New texture/data assets go under `packages/app/public/textures/`; new provenance entries go in
  `CREDITS.md`, following its existing per-source citation format exactly.
- Never commit until a task's own verification steps pass.

---

### Task 1: Raise shared sphere tessellation to 64×64

**Files:**
- Modify: `packages/app/src/main.ts:191` (the `generateSphereMesh(1, 32, 32)` call site)
- Modify: `packages/app/test/sphere.test.ts` (no code change needed — it already parametrizes
  `latSegments`/`lonSegments` as local test constants, not the production default; this task adds
  one more test asserting the *production* call site's actual arguments)

**Interfaces:**
- Consumes: `generateSphereMesh(radius, latSegments, lonSegments): SphereMesh` (existing,
  `packages/app/src/geometry/sphere.ts` — unchanged signature)
- Produces: nothing new for later tasks; this is a leaf change.

- [ ] **Step 1: Write a failing test asserting the production tessellation constant**

Add to `packages/app/test/sphere.test.ts`, as a new top-level `describe` block (after the existing
one, same file):

```typescript
describe('generateSphereMesh production call site', () => {
  it('main.ts uses at least 64 segments per axis for a visibly round silhouette', async () => {
    const mainSource = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf-8'),
    )
    const match = mainSource.match(/generateSphereMesh\(1,\s*(\d+),\s*(\d+)\)/)
    expect(match).not.toBeNull()
    const [, latSegments, lonSegments] = match!
    expect(Number(latSegments)).toBeGreaterThanOrEqual(64)
    expect(Number(lonSegments)).toBeGreaterThanOrEqual(64)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: FAIL — `main.ts` still calls `generateSphereMesh(1, 32, 32)`, so `latSegments`/`lonSegments`
are `32`, less than `64`.

- [ ] **Step 3: Update the production call site**

In `packages/app/src/main.ts`, change:

```typescript
  const sphereMesh = generateSphereMesh(1, 32, 32)
```

to:

```typescript
  const sphereMesh = generateSphereMesh(1, 64, 64)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@toboldlyglow/app`
Expected: PASS

- [ ] **Step 5: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 6: Manual visual check**

Run: `cd packages/app && npm run dev`, open the app in a browser, zoom in close on a planet's
terminator line and silhouette edge.
Expected: visibly smoother curve than before (harder to eyeball precisely without a side-by-side,
but no obviously flat facets at typical zoom levels). No console errors.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/main.ts packages/app/test/sphere.test.ts
git commit -m "Raise shared sphere mesh tessellation from 32x32 to 64x64 segments

Reduces visible silhouette/terminator faceting. Still trivial cost —
the mesh is shared and instanced across all ~17 bodies drawn per
frame, so this only grows one shared vertex/index buffer 4x, not
per-body geometry."
```

---

### Task 2: Pole-fade fix in `litSphereShaderCode`

**Files:**
- Modify: `packages/app/src/renderer/shaders.ts` (the `litSphereShaderCode` template string, around
  lines 152-159 for the `fs` function's `sampled` computation)

**Interfaces:**
- Consumes: nothing new.
- Produces: a `poleFadeFactor(v: f32) -> f32` WGSL function inside `litSphereShaderCode`, reused by
  Task 3/4's bump-mapping work (referenced there, not duplicated).

This task has no CPU-side pure function to unit-test (the fade math lives entirely in WGSL); per
Global Constraints, verification is typecheck/build/e2e-smoke/manual visual.

- [ ] **Step 1: Add the pole-fade helper function and use it for the color sample**

In `packages/app/src/renderer/shaders.ts`, inside the `litSphereShaderCode` template string, add a
new function right before the `@fragment fn fs(...)` definition (i.e. immediately after
`sunVisibleFraction`'s closing brace, before the `@fragment` line):

```wgsl
// Equirectangular textures compress an enormous amount of image width into a physically tiny
// sliver of image height near each pole (v=0 north, v=1 south — see geometry/sphere.ts's UV
// convention). Viewed on the sphere from a near-polar camera angle, that sliver is stretched back
// out to cover a large visible area, magnifying ordinary texture softness/compression noise into a
// visible artifact (diagnosed on Saturn, but this is a property of every equirectangular texture
// sampled this way, not a Saturn-specific bug). POLE_FADE_WIDTH is the fraction of latitude near
// each pole this fades over; a starting guess, tune once running against how far the artifact
// actually extends.
const POLE_FADE_WIDTH: f32 = 0.05;

fn poleFadeFactor(v: f32) -> f32 {
  return smoothstep(0.0, POLE_FADE_WIDTH, v) * smoothstep(1.0, 1.0 - POLE_FADE_WIDTH, v);
}
```

Then replace the existing color-sample line inside `fs`:

```wgsl
  let sampled = textureSample(bodyTexture, bodySampler, in.uv);
```

with:

```wgsl
  let poleFade = poleFadeFactor(in.uv.y);
  let sharpColor = textureSample(bodyTexture, bodySampler, in.uv);
  let coarseLevel = f32(textureNumLevels(bodyTexture) - 1u);
  let blurryColor = textureSampleLevel(bodyTexture, bodySampler, in.uv, coarseLevel);
  let sampled = mix(blurryColor, sharpColor, poleFade);
```

`textureNumLevels` is a WGSL builtin returning the texture's actual mip count — this works for any
body's texture without hardcoding a size assumption, matching how `bloomDownsampleShaderCode`
already derives `texelSize` from `textureDimensions` rather than a hardcoded constant.

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed — this confirms the WGSL template string is still valid TypeScript (it's a
plain string, so this alone doesn't validate the WGSL syntax itself; that's checked next).

- [ ] **Step 3: Add an e2e smoke test scrubbing Saturn's pole view**

Create `packages/app/e2e/poleShading.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

test('viewing a planet near-pole-on renders without WebGPU errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#entity-search-input').fill('Saturn')
  await page.locator('#entity-search-input').press('Enter')
  await page.waitForTimeout(2000) // let the fly-to tween settle

  // Drag to a near-polar viewing angle (large vertical drag), where the pole-fade shader path is
  // actually exercised — this is a regression check for the WGSL change (uniform-layout/bind-group
  // correctness via pageerror), not a pixel-level "is it actually smoother" check.
  const canvas = page.locator('#scene')
  const box = await canvas.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.9, { steps: 10 })
    await page.mouse.up()
  }
  await page.waitForTimeout(500)

  expect(errors).toEqual([])
})
```

- [ ] **Step 4: Run the new e2e test**

Run: `cd packages/app && npx playwright test e2e/poleShading.spec.ts`
Expected: PASS, zero page errors.

- [ ] **Step 5: Manual visual check on Saturn specifically**

Run: `cd packages/app && npm run dev`, open the app, search for Saturn, drag to a near-polar view
(matching the framing from this session's earlier bug report).
Expected: the swirl artifact is visibly gone or substantially softened near the pole. If it's still
sharply visible, increase `POLE_FADE_WIDTH` (e.g. to `0.08`) and re-check before moving on — this is
the one value in this whole plan explicitly expected to need empirical tuning.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/renderer/shaders.ts packages/app/e2e/poleShading.spec.ts
git commit -m "Fix pole-magnification texture artifact with a shader-side blur fade

Blends the color sample toward a deliberately coarse, blurry mip
level as a fragment approaches either pole (v=0/v=1), rather than
editing any texture asset. Diagnosed on Saturn during this session's
shadow work (root cause: equirectangular pole magnification of
ordinary texture noise, confirmed via systematic elimination down to
a bare unlit texture sample) but applies uniformly to every lit body."
```

---

### Task 3: Bump mapping — data model, shader technique, uniform/texture plumbing

**Files:**
- Modify: `packages/app/src/solarSystem/bodies.ts` (add `bumpMapUrl?`/`bumpIntensity?` to
  `BodyDefinition`)
- Modify: `packages/app/src/solarSystem/moons.ts` (same two fields on `MoonDefinition`)
- Modify: `packages/app/src/renderer/shaders.ts` (`litSphereShaderCode`: grow the uniform struct,
  add the bump-texture binding, add the tangent-basis + finite-difference bump function, apply it in
  `fs`)
- Modify: `packages/app/src/renderer/textureLoader.ts` (add `createFallbackFlatBumpTexture`)
- Modify: `packages/app/src/main.ts` (`createBodyRenderable`, the planet/moon uniform-write blocks)

**Interfaces:**
- Consumes: `poleFadeFactor` (Task 2, same shader string), `LIT_UNIFORM_FLOAT_COUNT` (existing,
  `renderer/shaders.ts`), `loadBodyTexture`/`createFallbackWhiteTexture` (existing,
  `renderer/textureLoader.ts`).
- Produces:
  - `BodyDefinition.bumpMapUrl?: string`, `BodyDefinition.bumpIntensity?: number` (and identical
    fields on `MoonDefinition`) — consumed by Task 5/6 (asset sourcing) and Task 7 (gas-giant script
    populates `bumpMapUrl` for the 4 gas giants).
  - `LIT_UNIFORM_FLOAT_COUNT = 72` (grown from 68) — the `bumpParams: vec4f` field (x = intensity,
    y/z/w unused) at uniform offset `[68..72)`.
  - `createFallbackFlatBumpTexture(device: GPUDevice): GPUTexture` in `textureLoader.ts` — consumed
    by `main.ts`'s body-renderable setup.
  - `createBodyRenderable(...)` gains an optional 8th parameter `fallbackBumpTexture?: GPUTexture` —
    Task 4 (AO) extends the same shader function this task adds, no further signature change needed
    there.

- [ ] **Step 1: Add the data-model fields**

In `packages/app/src/solarSystem/bodies.ts`, in the `BodyDefinition` interface, add after the
existing `atmosphereIntensity?: number` field:

```typescript
  /**
   * Path (under public/) to a grayscale height map used for bump mapping (perturbing the shading
   * normal only — no geometry change). Undefined means no relief. Sourced per-body; see
   * CREDITS.md for provenance once populated.
   */
  bumpMapUrl?: string
  /** Bump-mapping and ambient-occlusion strength, roughly 0-1. Undefined/0 means no effect. */
  bumpIntensity?: number
```

In `packages/app/src/solarSystem/moons.ts`, in the `MoonDefinition` interface, add the identical two
fields after the existing `textureUrl?: string` field (same doc comments).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS — these are optional fields, so no existing body/moon literal needs updating yet.

- [ ] **Step 3: Grow the uniform struct and add the bump-texture binding**

In `packages/app/src/renderer/shaders.ts`, update the doc comment above `litSphereShaderCode` (find
the line `export const LIT_UNIFORM_FLOAT_COUNT = 68`) to:

```typescript
export const LIT_UNIFORM_FLOAT_COUNT = 72
```

and add one more line to the layout comment block immediately above it, after the existing
`atmosphereParams` line:

```typescript
//   [68..72) bumpParams          : vec4f (x = bump/AO intensity, roughly 0-1; 0 means no effect;
//                                 y/z/w unused)
```

In the `struct Uniforms` block inside the `litSphereShaderCode` template string, add one field after
`atmosphereParams`:

```wgsl
struct Uniforms {
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
  occluders: array<vec4f, 4>,
  ringParams: vec4f,
  atmosphereParams: vec4f,
  bumpParams: vec4f,
};
```

Add a new texture binding after the existing `bodySampler` binding:

```wgsl
@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var bodyTexture: texture_2d<f32>;
@group(0) @binding(2) var bodySampler: sampler;
@group(0) @binding(3) var bumpTexture: texture_2d<f32>;
```

- [ ] **Step 4: Add the bump/tangent-basis WGSL function**

Still in `litSphereShaderCode`, add this function after `poleFadeFactor` (from Task 2) and before
`@fragment fn fs`:

```wgsl
// Tuning constants for the bump/AO effect — starting values, expect to adjust once running against
// real height-map assets.
const BUMP_STRENGTH_SCALE: f32 = 4.0;
const AO_STRENGTH_SCALE: f32 = 8.0;
const AO_MAX_DARKENING: f32 = 0.5;

struct BumpResult {
  normal: vec3f,
  ao: f32,
};

// Perturbs the shading normal using a grayscale height map, and returns a cheap ambient-occlusion
// darkening factor alongside it (see the AO comment in fs() for why this piggybacks on the same
// height samples rather than being a separate pass). No per-vertex tangent attributes are needed:
// for a UV-sphere, the tangent (longitude direction) is always perpendicular to both the surface
// normal and the polar axis, so it's derived here via a cross product against the sphere's own
// local +Z axis (transformed to world space through uni.world) — the same "transform a local axis,
// drop translation" trick sunVisibleFraction's ring-plane test and ringShaderCode both already use
// for their own normals, just with local Z instead of local Y.
fn applyBump(worldPos: vec3f, normal: vec3f, uv: vec2f) -> BumpResult {
  let intensity = uni.bumpParams.x;
  if (intensity <= 0.0) {
    return BumpResult(normal, 1.0);
  }

  let texelSize = 1.0 / vec2f(textureDimensions(bumpTexture));
  let center = textureSampleLevel(bumpTexture, bodySampler, uv, 0.0).r;
  let east = textureSampleLevel(bumpTexture, bodySampler, uv + vec2f(texelSize.x, 0.0), 0.0).r;
  let west = textureSampleLevel(bumpTexture, bodySampler, uv - vec2f(texelSize.x, 0.0), 0.0).r;
  let south = textureSampleLevel(bumpTexture, bodySampler, uv + vec2f(0.0, texelSize.y), 0.0).r;
  let north = textureSampleLevel(bumpTexture, bodySampler, uv - vec2f(0.0, texelSize.y), 0.0).r;

  let polarAxis = normalize((uni.world * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
  var tangent = cross(polarAxis, normal);
  let tangentLength = length(tangent);
  if (tangentLength < 1e-4) {
    // Exactly at a pole, where tangent direction is undefined (normal is parallel to polarAxis) —
    // any consistent direction works here, since poleFadeFactor (Task 2) already fades this whole
    // effect toward zero at the poles regardless.
    tangent = vec3f(1.0, 0.0, 0.0);
  } else {
    tangent = tangent / tangentLength;
  }
  let bitangent = cross(normal, tangent);

  let dHeightDu = (east - west) * 0.5;
  let dHeightDv = (south - north) * 0.5;
  let perturbedNormal = normalize(normal - (tangent * dHeightDu + bitangent * dHeightDv) * intensity * BUMP_STRENGTH_SCALE);

  let neighborAvg = (east + west + north + south) * 0.25;
  let cavity = max(0.0, neighborAvg - center);
  let ao = 1.0 - clamp(cavity * intensity * AO_STRENGTH_SCALE, 0.0, AO_MAX_DARKENING);

  return BumpResult(perturbedNormal, ao);
}
```

(This step includes the 5-tap ambient-occlusion sampling already, rather than adding it separately
in Task 4 — see Task 4's note on why it's folded in here instead of as a true follow-up edit.)

- [ ] **Step 5: Wire the bump result into `fs`**

Replace the body of `@fragment fn fs` in `litSphereShaderCode` — find:

```wgsl
@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let toLight = -uni.lightDirection.xyz;
  let shadowFactor = sunVisibleFraction(in.worldPosition);
  let litFraction = max(dot(normal, toLight), 0.0) * shadowFactor;
  let diffuse = litFraction * 0.85 + 0.1;
  let poleFade = poleFadeFactor(in.uv.y);
  let sharpColor = textureSample(bodyTexture, bodySampler, in.uv);
  let coarseLevel = f32(textureNumLevels(bodyTexture) - 1u);
  let blurryColor = textureSampleLevel(bodyTexture, bodySampler, in.uv, coarseLevel);
  let sampled = mix(blurryColor, sharpColor, poleFade);
```

and replace with:

```wgsl
@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let geometricNormal = normalize(in.normal);
  let poleFade = poleFadeFactor(in.uv.y);

  // Bump/AO perturbation is faded back toward "no effect" (raw normal, ao=1) near the poles via
  // the same poleFade weight used for the color sample above it, rather than separately blurring
  // the bump texture's own mip chain — a zero-magnitude perturbation can't show any artifact
  // regardless of what the underlying height samples look like, which is simpler than duplicating
  // Task 2's mip-blend technique for a second texture.
  let bumpResult = applyBump(in.worldPosition, geometricNormal, in.uv);
  let normal = normalize(mix(geometricNormal, bumpResult.normal, poleFade));
  let aoFactor = mix(1.0, bumpResult.ao, poleFade);

  let toLight = -uni.lightDirection.xyz;
  let shadowFactor = sunVisibleFraction(in.worldPosition);
  let litFraction = max(dot(normal, toLight), 0.0) * shadowFactor;
  let diffuse = litFraction * 0.85 + 0.1;
  let sharpColor = textureSample(bodyTexture, bodySampler, in.uv);
  let coarseLevel = f32(textureNumLevels(bodyTexture) - 1u);
  let blurryColor = textureSampleLevel(bodyTexture, bodySampler, in.uv, coarseLevel);
  let sampled = mix(blurryColor, sharpColor, poleFade);
```

Then find the existing specular/atmosphere/return block:

```wgsl
  let toCamera = normalize(uni.cameraPosition.xyz - in.worldPosition);
  let halfVector = normalize(toLight + toCamera);
  let specular = pow(max(dot(normal, halfVector), 0.0), 24.0) * 0.15 * step(0.0, dot(normal, toLight)) * shadowFactor;

  // Atmospheric rim/limb glow: ...
  let rimFactor = pow(1.0 - max(dot(normal, toCamera), 0.0), 3.0);
  let sunFacingGate = smoothstep(-0.1, 0.3, dot(normal, toLight));
  let atmosphereGlow = uni.atmosphereParams.rgb * rimFactor * uni.atmosphereParams.a * sunFacingGate * shadowFactor;

  return vec4f(sampled.rgb * uni.color.rgb * diffuse + vec3f(specular) + atmosphereGlow, uni.color.a);
}
```

and change only the final `return` line (everything above it, including the existing
`atmosphereGlow` comment, is unchanged) to:

```wgsl
  // aoFactor darkens the surface-visible terms (diffuse color, specular) but NOT atmosphereGlow —
  // the glow represents light scattered in the atmosphere above the surface, not something a
  // surface-level cavity should occlude.
  return vec4f(sampled.rgb * uni.color.rgb * diffuse * aoFactor + vec3f(specular) * aoFactor + atmosphereGlow, uni.color.a);
}
```

- [ ] **Step 6: Add the flat-bump fallback texture**

In `packages/app/src/renderer/textureLoader.ts`, add after the existing
`createFallbackWhiteTexture` function:

```typescript
// A neutral 1x1 "flat" height map for bodies with no bumpMapUrl — every finite-difference sample
// applyBump takes from this texture is identical, so it perturbs nothing and contributes zero
// ambient-occlusion darkening, exactly reproducing today's un-bumped appearance.
export function createFallbackFlatBumpTexture(device: GPUDevice): GPUTexture {
  const texture = device.createTexture({
    label: 'fallback flat bump texture',
    size: [1, 1],
    format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  })
  device.queue.writeTexture({ texture }, new Uint8Array([128, 128, 128, 255]), { bytesPerRow: 4 }, [1, 1])
  return texture
}
```

- [ ] **Step 7: Extend `createBodyRenderable` to bind a bump texture**

In `packages/app/src/main.ts`, replace the `createBodyRenderable` function:

```typescript
async function createBodyRenderable<TDefinition extends { id: string; textureUrl?: string }>(
  device: GPUDevice,
  pipeline: GPURenderPipeline,
  definition: TDefinition,
  uniformFloatCount: number,
  sampler: GPUSampler,
  mipPipeline: GPURenderPipeline,
  mipSampler: GPUSampler,
): Promise<BodyRenderable<TDefinition>> {
  const uniformBuffer = device.createBuffer({
    label: `${definition.id} uniforms`,
    size: uniformFloatCount * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const texture = definition.textureUrl
    ? await loadBodyTexture(device, definition.textureUrl, mipPipeline, mipSampler)
    : createFallbackWhiteTexture(device)
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: texture.createView() },
      { binding: 2, resource: sampler },
    ],
  })
  return { definition, uniformBuffer, bindGroup }
}
```

with:

```typescript
async function createBodyRenderable<TDefinition extends { id: string; textureUrl?: string; bumpMapUrl?: string }>(
  device: GPUDevice,
  pipeline: GPURenderPipeline,
  definition: TDefinition,
  uniformFloatCount: number,
  sampler: GPUSampler,
  mipPipeline: GPURenderPipeline,
  mipSampler: GPUSampler,
  fallbackBumpTexture?: GPUTexture,
): Promise<BodyRenderable<TDefinition>> {
  const uniformBuffer = device.createBuffer({
    label: `${definition.id} uniforms`,
    size: uniformFloatCount * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const texture = definition.textureUrl
    ? await loadBodyTexture(device, definition.textureUrl, mipPipeline, mipSampler)
    : createFallbackWhiteTexture(device)
  const entries: GPUBindGroupEntry[] = [
    { binding: 0, resource: { buffer: uniformBuffer } },
    { binding: 1, resource: texture.createView() },
    { binding: 2, resource: sampler },
  ]
  // Only planets/moons (litPipeline) declare a bumpTexture binding — the Sun's unlitPipeline has no
  // such binding, so this entry must stay entirely absent for that call, not just point at a
  // fallback: WebGPU's auto bind-group-layout requires entries to exactly match what the pipeline's
  // shader actually declares. Callers signal "this pipeline expects one" by passing
  // fallbackBumpTexture at all.
  if (fallbackBumpTexture) {
    const bumpTexture = definition.bumpMapUrl
      ? await loadBodyTexture(device, definition.bumpMapUrl, mipPipeline, mipSampler)
      : fallbackBumpTexture
    entries.push({ binding: 3, resource: bumpTexture.createView() })
  }
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries,
  })
  return { definition, uniformBuffer, bindGroup }
}
```

Update the import line for `textureLoader.ts` near the top of `main.ts`:

```typescript
import { createFallbackFlatBumpTexture, createFallbackWhiteTexture, loadBodyTexture } from './renderer/textureLoader'
```

Update the three `createBodyRenderable` call sites. Find:

```typescript
  const sunRenderable = await createBodyRenderable(device, unlitPipeline, SUN, 20, bodySampler, mipmapPipeline, mipmapSampler)
  const planetRenderables = await Promise.all(
    PLANETS.map((planet) =>
      createBodyRenderable(device, litPipeline, planet, LIT_UNIFORM_FLOAT_COUNT, bodySampler, mipmapPipeline, mipmapSampler),
    ),
  )
  const moonRenderables = await Promise.all(
    MOONS.map((moon) =>
      createBodyRenderable(device, litPipeline, moon, LIT_UNIFORM_FLOAT_COUNT, bodySampler, mipmapPipeline, mipmapSampler),
    ),
  )
```

and replace with:

```typescript
  const fallbackBumpTexture = createFallbackFlatBumpTexture(device)
  const sunRenderable = await createBodyRenderable(device, unlitPipeline, SUN, 20, bodySampler, mipmapPipeline, mipmapSampler)
  const planetRenderables = await Promise.all(
    PLANETS.map((planet) =>
      createBodyRenderable(
        device,
        litPipeline,
        planet,
        LIT_UNIFORM_FLOAT_COUNT,
        bodySampler,
        mipmapPipeline,
        mipmapSampler,
        fallbackBumpTexture,
      ),
    ),
  )
  const moonRenderables = await Promise.all(
    MOONS.map((moon) =>
      createBodyRenderable(
        device,
        litPipeline,
        moon,
        LIT_UNIFORM_FLOAT_COUNT,
        bodySampler,
        mipmapPipeline,
        mipmapSampler,
        fallbackBumpTexture,
      ),
    ),
  )
```

- [ ] **Step 8: Write `bumpParams` in both per-frame uniform-write blocks**

In `packages/app/src/main.ts`, in the moon uniform-write block (inside the `if (showMoons)` loop),
find:

```typescript
        uniforms.set([sunRadius, 0, 0, 0], 60)
        device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
```

and change to:

```typescript
        uniforms.set([sunRadius, 0, 0, 0], 60)
        uniforms.set([moon.bumpIntensity ?? 0, 0, 0, 0], 68)
        device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
```

In the planet uniform-write block (the `for (const { renderable, x: sx, ... } of planetFrameData)`
loop), find:

```typescript
      const { atmosphereColor, atmosphereIntensity } = renderable.definition
      if (atmosphereColor && atmosphereIntensity) {
        uniforms.set([...atmosphereColor, atmosphereIntensity], 64)
      }
      device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
```

and change to:

```typescript
      const { atmosphereColor, atmosphereIntensity, bumpIntensity } = renderable.definition
      if (atmosphereColor && atmosphereIntensity) {
        uniforms.set([...atmosphereColor, atmosphereIntensity], 64)
      }
      uniforms.set([bumpIntensity ?? 0, 0, 0, 0], 68)
      device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
```

- [ ] **Step 9: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed. This is the step most likely to catch a mismatched `LIT_UNIFORM_FLOAT_COUNT`
or an out-of-range `uniforms.set` offset (TypeScript won't catch the latter — that's what Step 10's
e2e run is for).

- [ ] **Step 10: Add an e2e smoke test**

Create `packages/app/e2e/bumpMapping.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

test('rendering with the grown lit-body uniform struct produces no WebGPU errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Every body (including ones with no bumpMapUrl yet, which is all of them until Task 5+) renders
  // through the new binding/uniform layout every frame — a few seconds of normal rendering exercises
  // it thoroughly. A bind-group-layout or uniform-struct-size mismatch surfaces as a pageerror via
  // the uncapturederror listener in renderer/webgpu.ts.
  await page.waitForTimeout(2000)

  expect(errors).toEqual([])
})
```

- [ ] **Step 11: Run the new e2e test and the full suite**

Run: `cd packages/app && npx playwright test e2e/bumpMapping.spec.ts`
Expected: PASS.

Run: `cd /Users/blazko/Development/ToBoldlyGlow && npm run test:e2e -- --workers=1`
Expected: all tests PASS (use `--workers=1` — this session found the parallel runner flakes under
WebGPU device contention across concurrent browser contexts; serial execution is the reliable check).

- [ ] **Step 12: Manual visual check**

Run: `cd packages/app && npm run dev`, open the app.
Expected: every body renders exactly as before (no visible change yet — every `bumpIntensity` is
still `undefined`/0 until Task 5+ populates real data). No console errors.

- [ ] **Step 13: Commit**

```bash
git add packages/app/src/solarSystem/bodies.ts packages/app/src/solarSystem/moons.ts \
  packages/app/src/renderer/shaders.ts packages/app/src/renderer/textureLoader.ts \
  packages/app/src/main.ts packages/app/e2e/bumpMapping.spec.ts
git commit -m "Add bump mapping + ambient occlusion to the lit-body shader

Finite-difference height-map perturbation of the shading normal, with
tangent/bitangent derived analytically from the world-space normal
and the sphere's own local +Z polar axis - no new vertex attributes
needed, unlike normal mapping. A cheap ambient-occlusion darkening
term reuses the same 5-tap height sampling (center vs. neighbor
average). Every body binds a bump texture (WebGPU requires a
consistent bind-group layout per pipeline); bodies without a real
bumpMapUrl bind a flat neutral fallback that perturbs nothing.

No real height-map assets are wired up yet (bumpIntensity is
undefined everywhere) - this lands the mechanism only."
```

---

### Task 4: Confirm ambient occlusion (already implemented in Task 3)

Per the spec's own sequencing note, AO was folded directly into Task 3's `applyBump` function rather
than added as a separate follow-up edit, since it reuses the exact same height-map samples with only
a different combination formula — implementing it as a literal separate patch would mean re-editing
the same WGSL function twice for no benefit. This task is a verification-only checkpoint confirming
that decision didn't skip anything from the spec.

**Files:** none modified — read-only verification against `docs/superpowers/specs/2026-07-21-surface-relief-design.md` §5.

- [ ] **Step 1: Re-read spec §5 and confirm every requirement is met by Task 3's `applyBump`**

Check against `docs/superpowers/specs/2026-07-21-surface-relief-design.md`:
- "grows from 3 taps to 5 (adding -du, -dv)" — confirmed: `applyBump` samples `center, east, west,
  south, north` (5 taps).
- "compare the center height against the average of its four neighbors" — confirmed:
  `neighborAvg = (east + west + north + south) * 0.25`.
- "reuses bumpIntensity as a single combined relief strength knob" — confirmed: both
  `perturbedNormal` and `ao` scale from the same `intensity` uniform, no separate AO field was added.

- [ ] **Step 2: No commit needed** — this task produces no file changes.

---

### Task 5: Source and wire up Earth's real bump map (pipeline validation)

**Files:**
- Modify: `packages/app/src/solarSystem/bodies.ts` (Earth's `bumpMapUrl`/`bumpIntensity`)
- Modify: `CREDITS.md` (new provenance entry)
- Create: `packages/app/public/textures/earth_bump.jpg` (or `.png`, matching whatever format is
  actually downloaded)

**Interfaces:**
- Consumes: `BodyDefinition.bumpMapUrl`/`bumpIntensity` (Task 3).
- Produces: nothing new for later tasks — this is the reference case Task 6 repeats per-body.

This task requires an actual internet lookup (asset sourcing can't be pre-scripted the way code
changes can) — do the investigation step first, then apply the exact integration pattern below to
whatever is found.

- [ ] **Step 1: Check Solar System Scope's texture pack for an Earth bump/elevation map**

Visit `https://www.solarsystemscope.com/textures/` (already the cited source for every existing
planet/Sun/Moon texture in this repo, CC BY 4.0, see `CREDITS.md`). Look for an Earth bump, height,
topography, or elevation map (Solar System Scope's pack has historically included one alongside the
Earth day-map, clouds, and specular maps — confirm the current exact filename/URL at implementation
time, since this plan can't verify it directly).

- [ ] **Step 2: If found, download and add it to the repo**

Download the file, resize/recompress it to match the existing texture convention (2K, same rough
file size as `earth.jpg`) if the source is much larger, and save it as
`packages/app/public/textures/earth_bump.jpg`.

- [ ] **Step 3: Wire it into `bodies.ts`**

In `packages/app/src/solarSystem/bodies.ts`, find Earth's entry (`id: 'earth'`) and add after the
existing `atmosphereIntensity: 0.5,` line:

```typescript
    bumpMapUrl: '/textures/earth_bump.jpg',
    bumpIntensity: 0.6,
```

- [ ] **Step 4: Document provenance in `CREDITS.md`**

Add a new subsection to `CREDITS.md` (after the existing "## Planet & Sun textures" section, before
"## Moon textures"):

```markdown
## Bump/height maps

Earth's bump map (`packages/app/public/textures/earth_bump.jpg`) is from the same Solar System
Scope source and CC BY 4.0 license as the color textures above (exact source filename: [fill in
once confirmed]).
```

(Fill in the exact source filename from Step 1 once confirmed — this is the one placeholder-shaped
item in this plan, and it's a licensing-citation detail that genuinely cannot be known until the
lookup happens, not a stand-in for undone design work.)

- [ ] **Step 5: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 6: Manual visual check**

Run: `cd packages/app && npm run dev`, open the app, fly to Earth, zoom in on the terminator line
(where grazing light makes relief most visible).
Expected: visible surface relief — mountain ranges/continents should read as having actual bumps,
not a flat painted texture. If it looks like noise rather than recognizable relief, check that the
downloaded map is genuinely a height map (grayscale, bright = high) and not something else
(specular/cloud map) mistakenly downloaded instead.

- [ ] **Step 7: Run the full e2e suite**

Run: `cd /Users/blazko/Development/ToBoldlyGlow && npm run test:e2e -- --workers=1`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/solarSystem/bodies.ts CREDITS.md packages/app/public/textures/earth_bump.jpg
git commit -m "Add Earth's bump map, validating the bump-mapping pipeline end-to-end"
```

If no suitable Earth bump map is found in Step 1, skip Steps 2-8, leave Earth's `bumpMapUrl` unset
(it renders exactly as it does today per the flat-fallback design), and note this in the commit for
Task 6 so the "ship without it" fallback path itself still gets exercised by at least one real body.

---

### Task 6: Source and wire up remaining rocky/icy bodies' bump maps

**Files:**
- Modify: `packages/app/src/solarSystem/bodies.ts` (Mercury, Venus, Mars)
- Modify: `packages/app/src/solarSystem/moons.ts` (Moon, Io, Europa, Ganymede, Callisto, Titan)
- Modify: `CREDITS.md`
- Create: whichever `packages/app/public/textures/<body>_bump.jpg` files are actually found

**Interfaces:**
- Consumes: same as Task 5.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Check Solar System Scope for Mercury/Venus/Mars/Moon bump maps**

Same source as Task 5, Step 1. Solar System Scope's pack has historically included bump maps for
several rocky bodies beyond Earth — confirm current availability at implementation time.

- [ ] **Step 2: For each body with a map found, repeat Task 5's Steps 2-4 pattern**

Download, save as `packages/app/public/textures/<body-id>_bump.jpg`, add `bumpMapUrl`/`bumpIntensity`
to the body's entry in `bodies.ts`, add a `CREDITS.md` line. Suggested starting `bumpIntensity`
values (tune visually): Mercury `0.7` (heavily cratered, should read as rougher than Earth), Venus
`0.15` (its thick cloud deck means real surface relief isn't visible anyway — keep this subtle),
Mars `0.5`, Moon `0.6`.

- [ ] **Step 3: Check USGS Astrogeology for Galilean moon / Titan DEM data**

Visit `https://astrogeology.usgs.gov/search` and search for each of Io, Europa, Ganymede, Callisto,
Titan plus "DEM" or "topography" or "elevation model" — USGS publishes real elevation data for some
Solar System bodies with sufficient orbiter coverage. This is public-domain US government work
(matching the existing citation pattern for these same 5 moons' color textures in `CREDITS.md`), so
if found, no new licensing question — just a new provenance line.

- [ ] **Step 4: For each moon with a map found, repeat the same integration pattern in `moons.ts`**

Same as Step 2, but editing `packages/app/src/solarSystem/moons.ts` instead. Suggested starting
`bumpIntensity`: `0.5` for all 5 (tune visually once running — Io in particular, being volcanically
resurfaced rather than heavily cratered, may look better at a lower value like `0.3`).

- [ ] **Step 5: For anything not found, leave it unset — this is the expected, deliberate fallback**

Per the spec: bodies with no available/licensable height source ship flat-shaded exactly as they
render today. Titania, Oberon, and Triton have no albedo texture at all already (see `moons.ts`'s
existing doc comment on why) and are not expected to get a bump map either — skip them entirely,
don't spend investigation time here.

- [ ] **Step 6: Typecheck, build, and run the full test suite**

Run: `npm run typecheck && npm run build && npm run test`
Expected: all succeed.

Run: `cd /Users/blazko/Development/ToBoldlyGlow && npm run test:e2e -- --workers=1`
Expected: all PASS.

- [ ] **Step 7: Manual visual check across whichever bodies got a real map**

Run: `cd packages/app && npm run dev`, fly to each body that received a `bumpMapUrl` in this task,
zoom to its terminator.
Expected: visible relief, same check as Task 5 Step 6.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/solarSystem/bodies.ts packages/app/src/solarSystem/moons.ts CREDITS.md \
  packages/app/public/textures/
git commit -m "Add bump maps for remaining rocky/icy bodies where a source was available

Bodies with no available/licensable height map (confirmed via Solar
System Scope and USGS Astrogeology) ship flat-shaded exactly as
before - a deliberate fallback per the design spec, not a gap."
```

---

### Task 7: Gas-giant synthetic bump-map data-pipeline script

**Files:**
- Create: `packages/data-pipeline/src/deriveGasGiantBumpMaps.ts`
- Create: `packages/data-pipeline/test/deriveGasGiantBumpMaps.test.ts`
- Modify: `packages/data-pipeline/package.json` (new `sharp` devDependency, new `derive-bump-maps`
  script)
- Modify: `packages/app/src/solarSystem/bodies.ts` (Jupiter/Saturn/Uranus/Neptune `bumpMapUrl`/
  `bumpIntensity`)
- Modify: `CREDITS.md`
- Create (generated, checked in): `packages/app/public/textures/jupiter_bump.png`,
  `saturn_bump.png`, `uranus_bump.png`, `neptune_bump.png`

**Interfaces:**
- Consumes: nothing from earlier tasks (independent of Task 5/6's asset sourcing).
- Produces: `deriveBumpMapBuffer(input: Buffer): Promise<Buffer>` (pure, testable, in
  `deriveGasGiantBumpMaps.ts`) — no later task consumes this directly, but it's the pattern any
  future synthetic-texture-derivation script in this repo should copy.

- [ ] **Step 1: Add `sharp` as a data-pipeline devDependency**

In `packages/data-pipeline/package.json`, add to `devDependencies`:

```json
    "sharp": "^0.33.0",
```

and add a new script:

```json
    "derive-bump-maps": "tsx src/deriveGasGiantBumpMaps.ts",
```

Run: `npm install` (from the repo root, so the workspace picks up the new dependency)
Expected: installs successfully. `sharp` is MIT-licensed and native-binding-based (prebuilt
binaries for common platforms) — this is a devDependency of the offline `data-pipeline` package
only, never shipped to the browser bundle (`packages/app`'s own dependencies are untouched).

- [ ] **Step 2: Write a failing test for the pure derivation function**

Create `packages/data-pipeline/test/deriveGasGiantBumpMaps.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { deriveBumpMapBuffer } from '../src/deriveGasGiantBumpMaps'

describe('deriveBumpMapBuffer', () => {
  it('produces a grayscale image the same dimensions as the input', async () => {
    // A tiny synthetic 4x4 RGB test image with varying brightness, standing in for a real albedo
    // texture - deriveBumpMapBuffer shouldn't care about image content beyond luminance.
    const input = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .png()
      .toBuffer()

    const output = await deriveBumpMapBuffer(input)
    const outputMeta = await sharp(output).metadata()

    expect(outputMeta.width).toBe(4)
    expect(outputMeta.height).toBe(4)
  })

  it('maps brighter input regions to brighter output (luminance-derived)', async () => {
    const darkInput = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 20, g: 20, b: 20 } },
    })
      .png()
      .toBuffer()
    const brightInput = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 220, g: 220, b: 220 } },
    })
      .png()
      .toBuffer()

    const darkOutput = await deriveBumpMapBuffer(darkInput)
    const brightOutput = await deriveBumpMapBuffer(brightInput)

    const darkStats = await sharp(darkOutput).stats()
    const brightStats = await sharp(brightOutput).stats()

    expect(brightStats.channels[0].mean).toBeGreaterThan(darkStats.channels[0].mean)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/data-pipeline && npm run test`
Expected: FAIL — `deriveGasGiantBumpMaps.ts` doesn't exist yet (`Cannot find module`).

- [ ] **Step 4: Implement `deriveGasGiantBumpMaps.ts`**

Create `packages/data-pipeline/src/deriveGasGiantBumpMaps.ts`:

```typescript
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Converts an existing gas-giant albedo texture into a synthetic grayscale "pseudo-bump" map by
// boosting local luminance contrast. There is no real published "cloud-top height" data for any gas
// giant - this is a deliberate stylization derived entirely from data already licensed and checked
// into this repo (the body's own color texture), not a claim of real elevation data. See
// CREDITS.md's entry for this script for the exact wording used to document that distinction.
export async function deriveBumpMapBuffer(inputPngOrJpg: Buffer): Promise<Buffer> {
  return sharp(inputPngOrJpg)
    .grayscale()
    .normalize() // stretches the luminance histogram to use the full [0, 255] range
    .linear(1.4, -20) // mild extra contrast boost beyond normalize() alone
    .png()
    .toBuffer()
}

const GAS_GIANTS = ['jupiter', 'saturn', 'uranus', 'neptune'] as const

// Only run when executed directly (`npm run derive-bump-maps`), not when imported for tests -
// mirrors convertBrightStarCatalog.ts's existing guard pattern in this same package.
if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url))
  const texturesDir = join(here, '../../app/public/textures')

  for (const bodyId of GAS_GIANTS) {
    const inputPath = join(texturesDir, `${bodyId}.jpg`)
    const outputPath = join(texturesDir, `${bodyId}_bump.png`)
    const input = readFileSync(inputPath)
    const output = await deriveBumpMapBuffer(input)
    writeFileSync(outputPath, output)
    console.log(`Wrote ${outputPath}`)
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/data-pipeline && npm run test`
Expected: PASS.

- [ ] **Step 6: Generate the actual bump-map assets**

Run: `cd packages/data-pipeline && npm run derive-bump-maps`
Expected: writes `jupiter_bump.png`, `saturn_bump.png`, `uranus_bump.png`, `neptune_bump.png` into
`packages/app/public/textures/`. Open each in an image viewer and confirm it looks like a plausible
grayscale cloud-band pattern (bright/dark bands roughly matching the color texture's own banding),
not a solid gray or corrupted image.

- [ ] **Step 7: Wire the generated assets into `bodies.ts`**

In `packages/app/src/solarSystem/bodies.ts`, add `bumpMapUrl`/`bumpIntensity` to each gas giant's
entry. For Jupiter, after the existing `atmosphereIntensity: 0.4,` line:

```typescript
    bumpMapUrl: '/textures/jupiter_bump.png',
    bumpIntensity: 0.3,
```

Repeat for Saturn, Uranus, Neptune (each already has its own `atmosphereIntensity` line to insert
after), using `<body-id>_bump.png` and the same starting `bumpIntensity: 0.3` (subtle — this is a
stylization, not real relief, so keep it restrained; tune visually).

- [ ] **Step 8: Document provenance in `CREDITS.md`**

Add to the "## Bump/height maps" section created in Task 5 (or create it now if Task 5 found nothing
to source):

```markdown
Jupiter/Saturn/Uranus/Neptune's bump maps
(`packages/app/public/textures/{jupiter,saturn,uranus,neptune}_bump.png`) are **not real elevation
data** — no such data exists for gas-giant cloud tops. They're synthetically derived from each
planet's own already-licensed color texture (luminance + contrast enhancement, via
`packages/data-pipeline/src/deriveGasGiantBumpMaps.ts`), inheriting the same Solar System Scope CC
BY 4.0 license as the source textures. A stylization for visual depth, not a scientific claim.
```

- [ ] **Step 9: Typecheck, build, and run the full test suite**

Run: `npm run typecheck && npm run build && npm run test`
Expected: all succeed.

Run: `cd /Users/blazko/Development/ToBoldlyGlow && npm run test:e2e -- --workers=1`
Expected: all PASS.

- [ ] **Step 10: Manual visual check on a gas giant**

Run: `cd packages/app && npm run dev`, fly to Jupiter or Saturn, zoom to the terminator.
Expected: cloud bands read as having subtle relief/depth rather than looking perfectly flat. Should
be noticeably more restrained than Earth/Mercury's relief (per the lower `bumpIntensity`).

- [ ] **Step 11: Commit**

```bash
git add packages/data-pipeline/package.json packages/data-pipeline/src/deriveGasGiantBumpMaps.ts \
  packages/data-pipeline/test/deriveGasGiantBumpMaps.test.ts \
  packages/app/src/solarSystem/bodies.ts CREDITS.md \
  packages/app/public/textures/jupiter_bump.png packages/app/public/textures/saturn_bump.png \
  packages/app/public/textures/uranus_bump.png packages/app/public/textures/neptune_bump.png
git commit -m "Derive synthetic gas-giant bump maps from their own licensed color textures

No real cloud-top elevation data exists for any gas giant. A new
offline data-pipeline script (packages/data-pipeline, mirroring the
existing convertBrightStarCatalog.ts pattern) derives a grayscale
pseudo-bump map via luminance/contrast enhancement of each planet's
own already-licensed albedo texture - sidesteps any new licensing
question, documented in CREDITS.md as a stylization, not real data."
```

---

### Task 8: Translucent Fresnel-driven cloud shell for gas giants

**Files:**
- Modify: `packages/app/src/renderer/shaders.ts` (new `cloudShellShaderCode` +
  `CLOUD_SHELL_UNIFORM_FLOAT_COUNT`)
- Modify: `packages/app/src/renderer/webgpu.ts` (new `createCloudShellPipeline`)
- Modify: `packages/app/src/main.ts` (create per-gas-giant shell uniform buffers/bind groups at
  startup, write shell uniforms + draw in `frame()`)

**Interfaces:**
- Consumes: `meshBuffers` (existing shared sphere mesh, Task 1's 64×64 version), `atmosphereColor`/
  `atmosphereIntensity` (existing `BodyDefinition` fields, already populated for all 4 gas giants).
- Produces: nothing consumed by later tasks — this is the last feature task.

- [ ] **Step 1: Add the cloud shell shader**

In `packages/app/src/renderer/shaders.ts`, add after `ringShaderCode` (end of file):

```typescript
// Uniform layout (must match the Float32Array packing in main.ts exactly):
//   [0..16)  worldViewProjection : mat4x4f
//   [16..32) world               : mat4x4f
//   [32..36) color               : vec4f (rgb = shell tint, from the body's own atmosphereColor;
//                                 a = base opacity scale, from atmosphereIntensity)
//   [36..40) lightDirection      : vec4f (xyz used, w unused)
//   [40..44) cameraPosition      : vec4f (xyz used, w unused; world-space, for the Fresnel term)
export const CLOUD_SHELL_UNIFORM_FLOAT_COUNT = 44

// A second, slightly-larger instance of the same shared sphere mesh every body already uses,
// alpha-blended over the opaque planet beneath it (see createCloudShellPipeline's blend state,
// identical to ringShaderCode's). No texture sampling at all - purely procedural shading, tinted by
// the body's own atmosphereColor (the same field driving the additive rim-glow term in
// litSphereShaderCode) so the shell reads as a thicker extension of the same atmospheric effect
// rather than an unrelated new color. Alpha is driven by a Fresnel term (thin looking straight down
// through the shell, thicker/more opaque toward the limb, where a grazing view ray passes through
// more of the shell's thickness) - the classic look of a real planetary atmosphere seen from space.
export const cloudShellShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) worldPosition: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.normal = (uni.world * vec4f(vert.normal, 0.0)).xyz;
  out.worldPosition = (uni.world * vec4f(vert.position, 1.0)).xyz;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let toLight = -uni.lightDirection.xyz;
  let toCamera = normalize(uni.cameraPosition.xyz - in.worldPosition);
  let diffuse = max(dot(normal, toLight), 0.0) * 0.7 + 0.3;
  let rimFactor = pow(1.0 - max(dot(normal, toCamera), 0.0), 2.0);
  let alpha = rimFactor * uni.color.a;
  return vec4f(uni.color.rgb * diffuse, alpha);
}
`
```

- [ ] **Step 2: Add the cloud shell pipeline**

In `packages/app/src/renderer/webgpu.ts`, update the import line:

```typescript
import {
  cloudShellShaderCode,
  flareShaderCode,
  lineShaderCode,
  litSphereShaderCode,
  ringShaderCode,
  starShaderCode,
  unlitSphereShaderCode,
} from './shaders'
```

Add after `createRingPipeline` (end of file):

```typescript
export async function createCloudShellPipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'cloud shell shader', code: cloudShellShaderCode })
  return await device.createRenderPipelineAsync({
    label: 'cloud shell pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [POSITION_BUFFER_LAYOUT, NORMAL_BUFFER_LAYOUT, UV_BUFFER_LAYOUT] },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [
        {
          format,
          // Same non-premultiplied alpha blending as the ring pipeline.
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        },
      ],
    },
    // Unlike the ring (a flat annulus visible from both sides), this is a solid convex sphere, so
    // normal backface culling applies - same frontFace: 'cw' fix as createLitPipeline, since this
    // reuses that exact mesh and winding.
    primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'cw' },
    depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' },
    multisample: { count: SAMPLE_COUNT },
  })
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Set up per-gas-giant shell resources in `main.ts`**

In `packages/app/src/main.ts`, update the import from `renderer/shaders`:

```typescript
import { CLOUD_SHELL_UNIFORM_FLOAT_COUNT, LIT_UNIFORM_FLOAT_COUNT } from './renderer/shaders'
```

Update the import from `renderer/webgpu` to add `createCloudShellPipeline`:

```typescript
import {
  createBodySampler,
  createCloudShellPipeline,
  createFlarePipeline,
  createLinePipeline,
  createLitPipeline,
  createMeshBuffers,
  createOrbitPathBuffer,
  createRenderTargets,
  createRingBuffers,
  createRingPipeline,
  createStarBuffer,
  createStarPipeline,
  createUnlitPipeline,
  initWebGpu,
  updateOrbitPathBuffer,
  type MeshBuffers,
} from './renderer/webgpu'
```

Add, after the existing ring setup block (after the `ringBindGroup` creation, before the
`scaleBlend`/`scaleBlendTween` lines):

```typescript
  // Scoped to the four gas giants specifically (per the design spec) - Earth/Venus already have
  // the additive rim-glow term in litSphereShaderCode instead. A small local constant, not a new
  // BodyDefinition field, since this is a fixed, unlikely-to-change rendering-layer decision, not
  // per-body data (mirrors RING_INNER_RADIUS_FACTOR/RING_OUTER_RADIUS_FACTOR just above).
  const GAS_GIANT_IDS = ['jupiter', 'saturn', 'uranus', 'neptune']
  const CLOUD_SHELL_RADIUS_FACTOR = 1.035
  const cloudShellPipeline = await createCloudShellPipeline(device, sceneColorFormat)
  const cloudShellRenderables = planetRenderables
    .filter((renderable) => GAS_GIANT_IDS.includes(renderable.definition.id))
    .map((renderable) => {
      const uniformBuffer = device.createBuffer({
        label: `${renderable.definition.id} cloud shell uniforms`,
        size: CLOUD_SHELL_UNIFORM_FLOAT_COUNT * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
      const bindGroup = device.createBindGroup({
        layout: cloudShellPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      })
      return { planetId: renderable.definition.id, uniformBuffer, bindGroup }
    })
```

- [ ] **Step 5: Write shell uniforms and draw each frame**

In `packages/app/src/main.ts`'s `frame()` function, inside the planet loop
(`for (const { renderable, x: sx, y: sy, z: sz, radius } of planetFrameData) { ... }`), find the
existing Saturn-ring block:

```typescript
      if (isSaturn) {
        const ringWorld = mat4.multiply(
```

and add a new block immediately before it (still inside the same `for` loop, after the
`device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)` line and before `if (isSaturn)`):

```typescript
      const cloudShell = cloudShellRenderables.find((shell) => shell.planetId === renderable.definition.id)
      if (cloudShell && atmosphereColor && atmosphereIntensity) {
        const shellRadius = radius * CLOUD_SHELL_RADIUS_FACTOR
        const shellWorld = mat4.multiply(
          mat4.create(),
          mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
          mat4.multiply(
            mat4.create(),
            tilt,
            mat4.multiply(mat4.create(), mat4.fromZRotation(mat4.create(), rotation), mat4.fromScaling(mat4.create(), [shellRadius, shellRadius, shellRadius])),
          ),
        )
        const shellWvp = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, shellWorld))
        const shellUniforms = new Float32Array(CLOUD_SHELL_UNIFORM_FLOAT_COUNT)
        shellUniforms.set(shellWvp, 0)
        shellUniforms.set(shellWorld, 16)
        shellUniforms.set([...atmosphereColor, atmosphereIntensity], 32)
        shellUniforms.set([...lightDirection, 0], 36)
        shellUniforms.set([...cameraPosition, 0], 40)
        device.queue.writeBuffer(cloudShell.uniformBuffer, 0, shellUniforms)
      }
```

(`atmosphereColor`/`atmosphereIntensity`/`bumpIntensity` are already destructured a few lines above
this point in the same loop from Task 3, Step 8 — no new destructure needed.)

Now add the draw call. In the render-pass section, find:

```typescript
    // Drawn after every opaque sphere (including Saturn's own and any moon) so its depth test
    // correctly hides the portion of the ring that passes behind them.
    pass.setPipeline(ringPipeline)
    pass.setVertexBuffer(0, ringBuffers.positionBuffer)
    pass.setVertexBuffer(1, ringBuffers.uvBuffer)
    pass.setIndexBuffer(ringBuffers.indexBuffer, 'uint32')
    pass.setBindGroup(0, ringBindGroup)
    pass.drawIndexed(ringBuffers.indexCount)
```

and add immediately after it:

```typescript
    // Drawn after every opaque sphere and the ring, same reasoning: alpha-blended and depth-tested
    // but not depth-writing, so draw order relative to other transparent passes (orbit paths,
    // flares) doesn't matter for correctness, only that it's after all opaque geometry.
    pass.setPipeline(cloudShellPipeline)
    for (const shell of cloudShellRenderables) {
      pass.setVertexBuffer(0, meshBuffers.positionBuffer)
      pass.setVertexBuffer(1, meshBuffers.normalBuffer)
      pass.setVertexBuffer(2, meshBuffers.uvBuffer)
      pass.setIndexBuffer(meshBuffers.indexBuffer, 'uint32')
      pass.setBindGroup(0, shell.bindGroup)
      pass.drawIndexed(meshBuffers.indexCount)
    }
```

- [ ] **Step 6: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 7: Add an e2e smoke test**

Create `packages/app/e2e/cloudShell.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

test('gas giants render their translucent cloud shell without WebGPU errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#entity-search-input').fill('Jupiter')
  await page.locator('#entity-search-input').press('Enter')
  await page.waitForTimeout(2000)

  expect(errors).toEqual([])
})
```

- [ ] **Step 8: Run the new e2e test and the full suite**

Run: `cd packages/app && npx playwright test e2e/cloudShell.spec.ts`
Expected: PASS.

Run: `cd /Users/blazko/Development/ToBoldlyGlow && npm run test:e2e -- --workers=1`
Expected: all PASS.

- [ ] **Step 9: Manual visual check**

Run: `cd packages/app && npm run dev`, fly to Jupiter and Saturn.
Expected: a soft, translucent haze visible mainly toward the limb of the planet's disc, thin or
absent near the center — not a uniform fog over the whole visible disc. Should read as an extension
of the existing rim-glow effect, not a jarring new layer.

- [ ] **Step 10: Commit**

```bash
git add packages/app/src/renderer/shaders.ts packages/app/src/renderer/webgpu.ts \
  packages/app/src/main.ts packages/app/e2e/cloudShell.spec.ts
git commit -m "Add a translucent Fresnel-driven cloud shell for gas giants

A second, slightly-larger instance of the shared sphere mesh,
alpha-blended over each gas giant using the same blend state as the
ring shader. Alpha is Fresnel-driven (thin looking straight down,
thicker toward the limb) rather than uniform, giving the classic
atmosphere-seen-from-space look. Tinted by the body's own existing
atmosphereColor, reusing data already in bodies.ts rather than adding
new per-body fields."
```

---

### Task 9: Final verification pass

**Files:** none — verification only.

- [ ] **Step 1: Full clean build from scratch**

Run: `rm -rf packages/app/dist packages/engine/build && npm run build`
Expected: succeeds with no errors, confirming no stale build artifacts were masking a problem.

- [ ] **Step 2: Full unit test suite**

Run: `npm run test`
Expected: all pass (engine, app, data-pipeline workspaces).

- [ ] **Step 3: Full e2e suite, serially**

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all pass, including every new spec added in Tasks 2/3/8.

- [ ] **Step 4: Close the loop on the original bug report**

Run: `cd packages/app && npm run dev`, open the app, search for Saturn, and reproduce the exact
near-polar framing from this session's original bug report (drag to a steep angle looking down
Saturn's rotation axis, with the rings visible edge-on).
Expected: no visible swirl artifact at the pole. This is the single most important manual check in
this whole plan — it's the thing that was actually reported broken.

- [ ] **Step 5: Spot-check every other new visual feature in one pass**

In the same running session: fly to Earth (bump relief + AO at the terminator, blue rim glow
unaffected), Mercury (strongest bump relief in the set, if sourced), Jupiter or Saturn (bump/AO on
cloud bands + the new translucent shell), and zoom into any planet's silhouette (tessellation).
Expected: everything renders together with no visual conflicts (e.g., the cloud shell doesn't
occlude the corona/flare unexpectedly, bump relief doesn't fight visibly with the existing shadow
terminator).

- [ ] **Step 6: No commit** — this task is verification-only. If Step 4 or 5 surfaces a problem,
      fix it as a new small commit on top of the relevant earlier task, re-run this task's steps,
      and only consider the plan complete once they pass clean.

---

## Self-Review Notes

- **Spec coverage:** §3 (pole fade) → Task 2. §4 (bump mapping, data model + technique + sourcing)
  → Tasks 3, 5, 6, 7. §5 (AO) → folded into Task 3, confirmed by Task 4. §6 (cloud shell) → Task 8.
  §7 (tessellation) → Task 1. §8 (testing) → the e2e specs added in Tasks 2/3/8 plus Task 9's final
  pass. §9 (sequencing) → this plan's task order matches it exactly (tessellation → pole-fade →
  bump+AO → asset sourcing → gas-giant script → cloud shell).
- **Placeholder scan:** the only unresolved item is the exact Solar System Scope/USGS source
  filenames in Tasks 5/6/CREDITS.md, which genuinely cannot be known until that lookup happens —
  every other step has complete, concrete code.
- **Type consistency:** `LIT_UNIFORM_FLOAT_COUNT` (68→72) and `CLOUD_SHELL_UNIFORM_FLOAT_COUNT` (44)
  are used identically at every call site across Tasks 3 and 8. `createBodyRenderable`'s
  `fallbackBumpTexture?` parameter and `applyBump`'s `BumpResult` struct are each defined once (Task
  3) and referenced, not redefined, everywhere else.
