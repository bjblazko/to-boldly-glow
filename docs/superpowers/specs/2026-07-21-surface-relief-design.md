# Surface Relief: Pole-Fade Fix, Bump Mapping, Higher Tessellation — Design Specification

Status: Approved — 2026-07-21

## 1. Motivation

While verifying this session's shadow-casting work, a distinct swirl-shaped artifact was found near
Saturn's pole. Systematic elimination (disabling, one at a time: the ring shadow, the moon-shadow
occluder test, mipmap generation, anisotropic filtering, and finally the entire lighting/shadow/
atmosphere shader path down to a raw unlit texture sample) proved it isn't caused by this session's
shadow/mipmap/atmosphere work — it survives even a bare `textureSample` with zero lighting math.
Root cause: `saturn.jpg` is an equirectangular texture, and equirectangular projections compress an
enormous amount of image width into a physically tiny sliver of image height near each pole; viewed
on the sphere from a near-polar camera angle, that sliver is stretched back out to cover a large
visible area, magnifying ordinary texture softness/compression noise into a visible pattern. It's
periodic and sweeps across the disc because Saturn's own rotation (~10.7h) cycles different texture
content through that magnified polar region.

Separately, the user asked whether bump/normal/displacement mapping could help — both as a possible
indirect fix and as a worthwhile visual upgrade on its own (planet silhouettes/terminators currently
look a bit faceted/flat). This spec covers both: a small, targeted pole-fade fix, and a separate,
purely-additive bump-mapping feature plus higher sphere tessellation.

## 2. Scope

**In scope**:
- A shader-side "pole fade" that blends texture samples (color now; bump map once added) toward a
  deliberately blurry version of themselves near either pole, fixing the specific artifact and
  protecting any future per-body map from showing the same failure mode.
- Bump mapping (finite-difference height-map perturbation of the shading normal) for rocky/icy
  bodies with a sourced height map, and a synthetic luminance-derived bump for the four gas giants
  (no real "cloud-top height" data exists to source).
- A cheap ambient-occlusion approximation (cavity darkening) piggybacking on bump mapping's height
  sampling.
- A translucent, Fresnel-driven cloud shell for the four gas giants specifically, reusing the ring
  shader's existing alpha-blending pattern.
- Raising the shared sphere mesh's tessellation from 32×32 to 64×64 segments to reduce visible
  silhouette/terminator faceting.

**Out of scope** (explicitly deferred, not part of this spec):
- **Normal mapping.** Needs per-vertex tangent vectors the current mesh doesn't carry (unlike bump
  mapping, which derives an analytic tangent basis from the UV-sphere's known parameterization with
  no mesh changes). Deferred to a future spec once bump mapping has shipped and been evaluated.
- **Displacement mapping.** Would need much higher tessellation than even the 64×64 target here,
  per-body (not shared) meshes, and — critically — would make the pole problem worse, not better:
  noisy height data pushed through the same equirectangular pole-magnification would carve visible
  geometric spikes/pits at the pole instead of just a discolored swirl. Not pursued.
- **True volumetric transparency** (raymarched multi-layer light scattering through gas). The
  translucent cloud shell in scope here is a single alpha-blended sphere with Fresnel-driven opacity,
  not real volumetrics — disproportionately heavy for this project, not pursued.
- **Guaranteed bump-map coverage for every body.** Bodies with no available/licensable height source
  (confirmed at implementation time, not this spec) ship flat-shaded exactly as they render today —
  this is a deliberate fallback, not a gap to close later.
- **Cloud shell for Earth/Venus.** Both already have the additive Fresnel rim-glow treatment from
  this session's earlier atmosphere work; extending the shell technique to them is a plausible future
  idea, not part of this spec.

## 3. Pole-fade fix

Every lit-body fragment computes a fade factor from its UV's V coordinate:

```
poleFadeFactor(v) = smoothstep(0.0, POLE_FADE_WIDTH, v) * smoothstep(1.0, 1.0 - POLE_FADE_WIDTH, v)
```

`POLE_FADE_WIDTH` (a tunable constant, starting guess ~0.05, i.e. the last 5% of latitude near each
pole) is 1.0 away from the poles and ramps to 0.0 exactly at v=0 or v=1. Each texture sample (the
color/albedo sample now; the bump-map sample once §4 lands) is computed twice — once normally via
`textureSample` (automatic mip selection), once forced to a coarse, blurry mip level via
`textureSampleLevel(tex, sampler, uv, highLevel)` — and the fragment mixes between them using
`poleFadeFactor` as the blend weight. `highLevel` is derived from `textureDimensions` (the texture's
own last mip index), so this works for any body's texture without a hardcoded size assumption.

This needs no binary texture edits and no data-pipeline step — it's pure shader logic, applied
uniformly to every lit body (not just Saturn), and it's the one piece of this spec that's actually
load-bearing for fixing the reported bug. The exact `POLE_FADE_WIDTH` will need empirical tuning
once running — the artifact's real angular extent isn't known precisely yet.

## 4. Bump mapping

### 4.1 Technique

No new vertex attributes. For a UV-sphere, tangent and bitangent vectors have a closed form in terms
of the surface normal and the known spherical UV parameterization, so both are derived analytically
in the fragment shader from `normal` alone — this is *why* bump mapping doesn't need the mesh changes
normal mapping would.

Height is sampled three times per fragment (`uv`, `uv + (du, 0)`, `uv + (0, dv)`, small fixed texel
offsets), and the two finite differences tilt the shading normal via the standard bump-mapping
formula, scaled by a per-body `bumpIntensity`. The perturbed normal replaces the raw geometric normal
in the existing diffuse and specular terms (the same terms the shadow/atmosphere work from this
session already feeds into) — no changes to how lighting itself is computed, only to which normal it
uses.

### 4.2 Data model and uniform/binding changes

- `BodyDefinition`/`MoonDefinition` gain optional `bumpMapUrl?: string` and `bumpIntensity?: number`
  (undefined intensity or no URL = effectively no relief).
- The shared lit pipeline's bind group gains a bump-texture binding. WebGPU requires a consistent
  bind group layout across every draw using one pipeline, so **every** body binds a bump texture —
  bodies without a real one bind a new flat mid-gray 1×1 fallback (mirroring the existing
  `createFallbackWhiteTexture` pattern in `textureLoader.ts`), which perturbs nothing since all three
  height samples are identical.
- `LIT_UNIFORM_FLOAT_COUNT` grows again (68 → 72) for a `bumpParams: vec4f` (x = intensity).

### 4.3 Per-body-type sourcing plan

- **Rocky/icy bodies with an existing color texture** (Mercury, Venus, Earth, Mars, Moon, Io, Europa,
  Ganymede, Callisto, Titan): source a real height map where available. Solar System Scope (already
  the source for the Sun/planet/Moon textures, CC BY 4.0, cited in `CREDITS.md`) publishes companion
  bump maps for some bodies — exact coverage to be confirmed during implementation. For the
  NASA/JPL/USGS-sourced moons, check USGS Astrogeology for public-domain DEM data. Anything not found
  ships flat (§2).
- **Gas giants** (Jupiter, Saturn, Uranus, Neptune): no real "cloud-top height" data is published
  anywhere usable. A one-time offline script (in `packages/data-pipeline`, following the existing
  `convertBrightStarCatalog` pattern) derives a synthetic grayscale bump map from each gas giant's
  *own already-licensed* albedo texture (luminance + contrast enhancement), saved as a real asset
  (e.g. `jupiter_bump.png`) checked into `public/textures/`. This sidesteps any new licensing
  question — it's a derivative of data already cited — but must be documented in `CREDITS.md` as a
  stylization derived from the color texture, explicitly not real elevation data.

## 5. Ambient occlusion (bump-mapping extension)

A cheap cavity-darkening approximation piggybacking directly on bump mapping's height sampling —
not true geometric AO (meaningless on a smooth sphere with no real geometric detail), but enough to
make cloud bands and terrain read as having real depth rather than looking painted on.

Bump mapping's finite-difference sampling grows from 3 taps (center, `+du`, `+dv`) to 5 (adding
`-du`, `-dv`), enough to compare the center height against the average of its four neighbors:
`cavity = max(0, neighborAvg - centerHeight)`. Where a fragment sits in a "pit" relative to its
surroundings, `1 - clamp(cavity * strength, 0, maxDarkening)` multiplies into the final color —
applied regardless of light direction (the defining property of *ambient* occlusion, as opposed to
the existing direct-lighting diffuse/specular terms, which already depend on light angle).

To avoid a fourth per-body tunable, this reuses `bumpIntensity` as a single combined "relief
strength" knob driving both the normal perturbation and the AO darkening proportionally, rather than
adding a separate AO-strength field. Costs two extra texture taps per fragment (5 vs. 3) — still
trivial at this scene's draw count.

## 6. Translucent cloud shell (gas giants transparency)

A second, slightly-larger-radius sphere (~1.02-1.05× the planet's own radius) drawn after the solid
planet sphere, alpha-blended over it — reusing the exact blend state `ringShaderCode`'s pipeline
already uses (`src-alpha`/`one-minus-src-alpha` for color), not a new blending technique. No new mesh
needed: it's the same shared sphere geometry, just scaled larger via its own world matrix, the same
trick the ring mesh already uses relative to its parent body's scale.

Alpha isn't uniform across the shell — it's driven by the same Fresnel rim factor already computed
for the atmospheric rim glow (§ existing `atmosphereGlow` term from this session's earlier work):
`pow(1 - max(dot(normal, toCamera), 0), n)`. This gives the classic "thin looking straight down,
thicker/more opaque toward the limb" atmospheric look, since a grazing view ray effectively passes
through more of the shell's thickness. Needs its own pipeline (WebGPU bakes blend state into pipeline
creation, so it can't reuse the opaque `litPipeline`) — call it `cloudShellPipeline`, depth-tested but
not depth-writing (`depthWriteEnabled: false, depthCompare: 'less'`), matching the ring/flare
pipelines' existing pattern for transparent draws that shouldn't corrupt the depth buffer for later
passes.

Scoped to the four gas giants only, per the request that motivated it — not Earth/Venus, which
already have the additive rim-glow treatment from this session's earlier atmosphere work. Venus (real
opaque cloud cover) is a plausible future candidate for the same shell technique, but that's out of
scope here.

## 7. Higher sphere tessellation

`generateSphereMesh(1, 32, 32)` (`main.ts`, ~1,024 vertices, shared and instanced across every body)
becomes `generateSphereMesh(1, 64, 64)` (~4,096 vertices, still trivial for a scene with ~17 draws
per frame regardless of GPU target). Purely a `main.ts` call-site change plus updating
`generateSphereMesh`'s existing unit tests' expected vertex/index counts for the new default. No
interaction with bump mapping's analytic tangent-basis derivation, which works at any tessellation
level.

## 8. Testing

- **Data-pipeline script** (gas-giant synthetic bump derivation): unit-tested the same way as
  `convertBrightStarCatalog.test.ts` — a pure, deterministic input→output transformation.
- **`generateSphereMesh`**: existing unit tests updated for the new 64×64 default vertex/index counts.
- **e2e smoke tests**: scrub through several bodies (Mercury/Moon for strong relief, Saturn
  specifically to confirm the pole fade actually resolves the reported bug, a gas giant for the
  cloud shell) and assert zero `pageerror`s — catching bind-group/uniform-layout mismatches from the
  grown struct and the two new pipelines/bindings (bump texture, cloud shell), per this session's
  established pattern.
- **Manual visual verification**: confirm bump relief reads as relief (not noise) at a terminator
  line; confirm cavities visibly darken (AO) rather than just looking like flat bump shading; confirm
  Saturn's pole is visibly smoother; confirm silhouette faceting is reduced at typical zoom levels;
  confirm a gas giant's cloud shell reads as thin near the center of its disc and thicker toward the
  limb, not a uniform haze.

## 9. Sequencing

1. Sphere tessellation (32×32 → 64×64) — trivial, fully independent, do first.
2. Pole-fade fix — small, foundational; must land before bump mapping so bump mapping never needs a
   second, separate pole fix bolted on.
3. Bump-mapping shader technique + uniform/texture plumbing + flat fallback texture.
4. Ambient occlusion — small extension of step 3's height sampling, do right after since it shares
   the same code path.
5. Asset sourcing for rocky/icy bodies, starting with Earth (best-known result, easiest to validate
   visually) before filling in the rest.
6. Gas-giant synthetic-bump data-pipeline script — depends on the bump-mapping code path from step 3
   already working end-to-end.
7. Translucent cloud shell for gas giants — independent of steps 3-6 (a separate pipeline/mesh
   instance, not an extension of the lit-body shader), can land any time after step 1, but grouped
   last here since it's the most visually experimental piece and benefits from the gas giants
   already having their new bump/AO relief in place to compare against.
