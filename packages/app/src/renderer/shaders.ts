// Uniform float count for litSphereShaderCode's Uniforms struct below — kept as a named constant
// (rather than a bare literal duplicated at every call site in main.ts) so growing this struct
// can't silently drift out of sync with the Float32Array packing that feeds it: a mismatch here is
// silently-wrong rendering, not a compile error.
export const LIT_UNIFORM_FLOAT_COUNT = 72

// Uniform layout (must match the Float32Array packing in main.ts exactly):
//   [0..16)  worldViewProjection : mat4x4f
//   [16..32) world               : mat4x4f
//   [32..36) color               : vec4f
//   [36..40) lightDirection      : vec4f (xyz used, w unused — vec4 avoids WGSL's vec3
//                                 trailing-padding alignment gotcha in uniform buffers)
//   [40..44) cameraPosition      : vec4f (xyz used, w unused; world-space, for specular)
//   [44..60) occluders           : array<vec4f, 4> (xyz = world-space center, w = world-space
//                                 radius; a radius of 0 marks an unused slot). Up to 4 shadow-
//                                 casting spheres tested against this body's own surface — a
//                                 planet's slots hold its own moons (if any), a moon's slot 0 holds
//                                 its parent planet.
//   [60..64) ringParams          : vec4f (x = the Sun's own world-space radius at the current
//                                 scaleBlend, needed by every body to compute the Sun's angular
//                                 size for the shadow's soft-penumbra math; y/z = Saturn's ring
//                                 inner/outer world-space radius, both 0 for every non-Saturn body
//                                 so the ring-plane shadow test below is a no-op elsewhere; w unused)
//   [64..68) atmosphereParams    : vec4f (rgb = rim-glow color, a = intensity; a of 0 means no
//                                 atmosphere - every moon and Mercury/Mars write this as all-zero)
//   [68..72) bumpParams          : vec4f (x = bump/AO intensity, roughly 0-1; 0 means no effect;
//                                 y/z/w unused)
export const litSphereShaderCode = /* wgsl */ `
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

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) uv: vec2f,
  @location(2) worldPosition: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var bodyTexture: texture_2d<f32>;
@group(0) @binding(2) var bodySampler: sampler;
@group(0) @binding(3) var bumpTexture: texture_2d<f32>;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.normal = (uni.world * vec4f(vert.normal, 0.0)).xyz;
  out.uv = vert.uv;
  out.worldPosition = (uni.world * vec4f(vert.position, 1.0)).xyz;
  return out;
}

// Area of overlap between two circles of radii r1, r2 (same angular units, e.g. radians) whose
// centers are distance d apart. Used to turn "how much of the Sun's disc does this occluder cover"
// into a smooth [0,1] fraction rather than a hard binary in/out test.
fn circleOverlapArea(r1: f32, r2: f32, d: f32) -> f32 {
  if (d >= r1 + r2) {
    return 0.0;
  }
  let rmin = min(r1, r2);
  let rmax = max(r1, r2);
  if (d <= rmax - rmin) {
    return 3.14159265 * rmin * rmin;
  }
  let d1 = clamp((d * d + r1 * r1 - r2 * r2) / (2.0 * d * r1), -1.0, 1.0);
  let d2 = clamp((d * d + r2 * r2 - r1 * r1) / (2.0 * d * r2), -1.0, 1.0);
  let term1 = r1 * r1 * acos(d1);
  let term2 = r2 * r2 * acos(d2);
  let term3 = 0.5 * sqrt(max(0.0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  return term1 + term2 - term3;
}

// Fraction of the Sun's angular disc still visible from worldPos after accounting for up to 4
// occluding spheres (uni.occluders) plus, for Saturn, its own ring plane (uni.ringParams.yz). Soft
// rather than hard-binary: the Sun has a real angular radius at these distances (not a point
// source), so partial coverage fades smoothly instead of producing an unrealistically crisp
// terminator during a transit/eclipse. Feeds both the diffuse/specular terms below and (once added)
// the atmospheric rim glow, so a body's limb dims consistently with its shadowed surface.
fn sunVisibleFraction(worldPos: vec3f) -> f32 {
  let toSunVec = -worldPos; // the Sun always sits at the world origin
  let distanceToSun = length(toSunVec);
  if (distanceToSun < 1e-6) {
    return 1.0;
  }
  let toSunDir = toSunVec / distanceToSun;
  let sunRadius = uni.ringParams.x;
  let sunAngularRadius = asin(clamp(sunRadius / distanceToSun, 0.0, 1.0));
  let sunDiscArea = 3.14159265 * sunAngularRadius * sunAngularRadius;
  if (sunDiscArea < 1e-9) {
    return 1.0;
  }

  var visible = 1.0;
  for (var i = 0; i < 4; i = i + 1) {
    let occluder = uni.occluders[i];
    let occluderRadius = occluder.w;
    if (occluderRadius <= 0.0) {
      continue;
    }
    let toOccluder = occluder.xyz - worldPos;
    let distanceToOccluder = length(toOccluder);
    if (distanceToOccluder < 1e-6) {
      continue;
    }
    let occluderDir = toOccluder / distanceToOccluder;
    let occluderAngularRadius = asin(clamp(occluderRadius / distanceToOccluder, 0.0, 1.0));
    let angularSeparation = acos(clamp(dot(toSunDir, occluderDir), -1.0, 1.0));
    let overlap = circleOverlapArea(sunAngularRadius, occluderAngularRadius, angularSeparation);
    visible = min(visible, 1.0 - overlap / sunDiscArea);
  }

  // Saturn-only ring-plane shadow: ray-plane intersect the fragment-to-Sun ray against the ring's
  // plane (through this body's own center; normal derived from its world matrix — the same trick
  // ringShaderCode uses for its own normal). A flat partial-opacity band with a soft edge, not a
  // sample of the ring texture's real per-radius alpha — a deliberate simplification that doesn't
  // reproduce the Cassini Division gap. ringParams.y/.z are 0 for every non-Saturn body, so
  // ringOuter > ringInner is false and this whole block is a no-op everywhere else.
  let ringInner = uni.ringParams.y;
  let ringOuter = uni.ringParams.z;
  if (ringOuter > ringInner) {
    // Local +Z, matching the ring mesh's actual flat plane (geometry/ring.ts generates it flat in
    // the local XY plane, normal local +Z) - NOT local Y, which was this test's original (wrong)
    // axis, copied from ringShaderCode's own same mistake below (now also fixed). The wrong axis
    // put the shadow-casting plane 90 degrees off from the ring's real plane.
    let ringNormal = normalize((uni.world * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
    let ringCenter = uni.world[3].xyz;
    let denom = dot(toSunDir, ringNormal);
    if (abs(denom) > 1e-4) {
      let t = dot(ringCenter - worldPos, ringNormal) / denom;
      if (t > 0.0) {
        let hit = worldPos + toSunDir * t;
        let hitDistance = length(hit - ringCenter);
        let edgeSoftness = (ringOuter - ringInner) * 0.05;
        let inside = smoothstep(ringInner - edgeSoftness, ringInner + edgeSoftness, hitDistance)
          * (1.0 - smoothstep(ringOuter - edgeSoftness, ringOuter + edgeSoftness, hitDistance));
        visible = min(visible, 1.0 - inside * 0.85);
      }
    }
  }

  return clamp(visible, 0.0, 1.0);
}

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
// drop translation" trick sunVisibleFraction's ring-plane test and ringShaderCode both use for
// their own normals (also local +Z, matching the ring mesh's real flat-XY-plane geometry).
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

  // A small Blinn-Phong specular highlight — real planets aren't matte diffuse-only, and a
  // subtle sheen reads as "not flat" much more effectively than raising the diffuse/ambient terms
  // (which would just wash out the day/night terminator instead of adding actual dimensionality).
  // Deliberately restrained (low intensity, tight cone) since these are dry rocky/gaseous bodies,
  // not glossy spheres — this is not a physically-based ocean/ice reflectance model.
  let toCamera = normalize(uni.cameraPosition.xyz - in.worldPosition);
  let halfVector = normalize(toLight + toCamera);
  let specular = pow(max(dot(normal, halfVector), 0.0), 24.0) * 0.15 * step(0.0, dot(normal, toLight)) * shadowFactor;

  // Atmospheric rim/limb glow: a Fresnel term (brightest where the surface normal is near-
  // perpendicular to the camera, i.e. right at the silhouette edge) approximating how sunlight
  // scatters through a thin shell of atmosphere seen edge-on. atmosphereParams.a is 0 for bodies
  // with no substantial real atmosphere (Mercury, Mars, every moon), making this whole term a
  // no-op for them. Gated by the SAME shadowFactor as the diffuse/specular terms above, so a
  // planet's limb dims consistently with its shadowed surface during a transit/eclipse, and by a
  // sun-facing falloff so the glow fades out toward the unlit night limb rather than wrapping
  // all the way around the silhouette.
  let rimFactor = pow(1.0 - max(dot(normal, toCamera), 0.0), 3.0);
  let sunFacingGate = smoothstep(-0.1, 0.3, dot(normal, toLight));
  let atmosphereGlow = uni.atmosphereParams.rgb * rimFactor * uni.atmosphereParams.a * sunFacingGate * shadowFactor;

  // aoFactor darkens the surface-visible terms (diffuse color, specular) but NOT atmosphereGlow —
  // the glow represents light scattered in the atmosphere above the surface, not something a
  // surface-level cavity should occlude.
  return vec4f(sampled.rgb * uni.color.rgb * diffuse * aoFactor + vec3f(specular) * aoFactor + atmosphereGlow, uni.color.a);
}
`

// Uniform layout: [0..16) worldViewProjection : mat4x4f, [16..20) color : vec4f
export const unlitSphereShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  color: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var bodyTexture: texture_2d<f32>;
@group(0) @binding(2) var bodySampler: sampler;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.uv = vert.uv;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let sampled = textureSample(bodyTexture, bodySampler, in.uv);
  return vec4f(sampled.rgb * uni.color.rgb, uni.color.a);
}
`

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

// Uniform layout: [0..16) rotationOnlyViewProjection : mat4x4f, [16..18) pixelSize : vec2f
// (padded to 20 floats so the buffer size stays a multiple of 16 bytes for uniform alignment).
//
// Each star is one instance of a 4-vertex triangle-strip quad, expanded entirely on the GPU from
// @builtin(vertex_index) — no per-star vertex geometry is needed. Stars are placed at a fixed
// large distance along their real direction (never at true light-year distances), so this
// sidesteps the floating-origin precision technique entirely: only direction matters here.
// rotationOnlyViewProjection is `projection * view` with the view matrix's translation stripped,
// making the quad rotate with the camera but never translate with it, like an infinitely distant
// skybox. The quad's screen-space offset is scaled by `center.w` so it stays a constant pixel size
// regardless of depth (clip-space xy is divided by w before rasterization, so pre-multiplying by w
// here cancels that division). No depth test is used — stars are drawn first in the pass, so
// opaque bodies naturally paint over them (painter's algorithm), avoiding depth-precision issues
// at this distance entirely.
export const starShaderCode = /* wgsl */ `
struct Uniforms {
  rotationOnlyViewProjection: mat4x4f,
  pixelSize: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) brightness: f32,
};

const STAR_DISTANCE: f32 = 900.0;

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(
  @builtin(vertex_index) vertexIndex: u32,
  @location(0) starDirection: vec3f,
  @location(1) brightness: f32,
) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let corner = corners[vertexIndex];

  let center = uni.rotationOnlyViewProjection * vec4f(normalize(starDirection) * STAR_DISTANCE, 1.0);
  let offset = corner * uni.pixelSize * brightness;

  var out: VertexOutput;
  out.position = vec4f(center.xy + offset * center.w, center.z, center.w);
  out.uv = corner;
  out.brightness = brightness;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let falloff = smoothstep(1.0, 0.0, length(in.uv));
  let intensity = in.brightness * falloff;
  return vec4f(vec3f(1.0, 1.0, 0.95) * intensity, intensity);
}
`

// Shared vertex stage for every post-processing pass below: the standard "one big triangle"
// trick — 3 vertices, no vertex buffer, covering the whole viewport with a single triangle whose
// corners lie outside the [-1,1] clip range on two sides. Cheaper than two triangles (a quad)
// since it avoids a diagonal seam and redundant fragment work along it. uv is derived from clip
// position and flipped in Y so v=0 lands at the top of the texture, matching how the HDR/bloom
// render targets are written (clip-space +Y is up; texture V convention is top-down).
const FULLSCREEN_TRIANGLE_VERTEX_WGSL = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let pos = positions[vertexIndex];
  var out: VertexOutput;
  out.position = vec4f(pos, 0.0, 1.0);
  out.uv = vec2f((pos.x + 1.0) * 0.5, 1.0 - (pos.y + 1.0) * 0.5);
  return out;
}
`

// Bright-pass: extracts the portion of the HDR scene color above THRESHOLD (per channel, not
// luminance — simpler, and sufficient for a single dominant bloom source like the Sun). Rendered
// into the bloom mip chain's base level, which is already half the canvas resolution.
const BLOOM_THRESHOLD = 1.0

export const brightPassShaderCode = /* wgsl */ `
${FULLSCREEN_TRIANGLE_VERTEX_WGSL}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let color = textureSampleLevel(inputTexture, inputSampler, in.uv, 0.0).rgb;
  let bright = max(color - vec3f(${BLOOM_THRESHOLD.toFixed(1)}), vec3f(0.0));
  return vec4f(bright, 1.0);
}
`

// Dual-Kawase-style downsample: a 5-tap filter (center weighted double the 4 diagonal taps)
// that's cheap and avoids the aliasing a single bilinear tap would introduce when halving
// resolution repeatedly down the mip chain.
export const bloomDownsampleShaderCode = /* wgsl */ `
${FULLSCREEN_TRIANGLE_VERTEX_WGSL}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let texelSize = 1.0 / vec2f(textureDimensions(inputTexture));
  let center = textureSampleLevel(inputTexture, inputSampler, in.uv, 0.0).rgb * 4.0;
  let tl = textureSampleLevel(inputTexture, inputSampler, in.uv - texelSize, 0.0).rgb;
  let tr = textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(texelSize.x, -texelSize.y), 0.0).rgb;
  let bl = textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(-texelSize.x, texelSize.y), 0.0).rgb;
  let br = textureSampleLevel(inputTexture, inputSampler, in.uv + texelSize, 0.0).rgb;
  let result = (center + tl + tr + bl + br) / 8.0;
  return vec4f(result, 1.0);
}
`

// Dual-Kawase-style upsample: a 9-tap tent filter (weights 4/2/2/2/2/1/1/1/1, sum 16) sampling the
// smaller/blurrier mip level. The render pass this draws into uses additive blending and loadOp
// 'load', so this adds a widened, blurred copy of the level below onto whatever the downsample
// chain already wrote at this level — progressively accumulating blur from coarse to fine mips.
export const bloomUpsampleShaderCode = /* wgsl */ `
${FULLSCREEN_TRIANGLE_VERTEX_WGSL}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let texelSize = 1.0 / vec2f(textureDimensions(inputTexture));
  var sum = textureSampleLevel(inputTexture, inputSampler, in.uv, 0.0).rgb * 4.0;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(-texelSize.x, 0.0), 0.0).rgb * 2.0;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(texelSize.x, 0.0), 0.0).rgb * 2.0;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(0.0, -texelSize.y), 0.0).rgb * 2.0;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(0.0, texelSize.y), 0.0).rgb * 2.0;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(-texelSize.x, -texelSize.y), 0.0).rgb;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(texelSize.x, -texelSize.y), 0.0).rgb;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(-texelSize.x, texelSize.y), 0.0).rgb;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(texelSize.x, texelSize.y), 0.0).rgb;
  return vec4f(sum / 16.0, 1.0);
}
`

// Composite: adds the bloom mip chain's base level (already upsampled/accumulated back up to it)
// onto the full-resolution HDR scene color, then tonemaps (Reinhard) down to displayable [0,1]
// before writing to the swapchain. This is the only pass that touches the swapchain.
const BLOOM_INTENSITY = 0.6

export const bloomCompositeShaderCode = /* wgsl */ `
${FULLSCREEN_TRIANGLE_VERTEX_WGSL}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var hdrTexture: texture_2d<f32>;
@group(0) @binding(2) var bloomTexture: texture_2d<f32>;

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let hdrColor = textureSampleLevel(hdrTexture, inputSampler, in.uv, 0.0).rgb;
  let bloomColor = textureSampleLevel(bloomTexture, inputSampler, in.uv, 0.0).rgb;
  let combined = hdrColor + bloomColor * ${BLOOM_INTENSITY.toFixed(1)};
  let tonemapped = combined / (vec3f(1.0) + combined);
  // This pass writes directly to the swapchain's non-sRGB storage format (getPreferredCanvasFormat()
  // returns a plain unorm format, not a "-srgb" variant), so nothing downstream gamma-encodes for
  // us — unlike sRGB-decoded texture samples elsewhere in the renderer, which the GPU auto-linearizes
  // on read. Without this, everything (dim stars especially) displays far too dark, since a
  // display expects gamma-encoded values, not linear light. gamma 2.2 is a standard approximation
  // of the true sRGB transfer function, accurate enough for a real-time composite like this.
  let gammaEncoded = pow(max(tonemapped, vec3f(0.0)), vec3f(1.0 / 2.2));
  return vec4f(gammaEncoded, 1.0);
}
`

// Uniform layout (must match the Float32Array packing in main.ts exactly):
//   [0..4)  color      : vec4f
//   [4..6)  ndcCenter  : vec2f
//   [6..8)  sizeNdc    : vec2f
//   [8]     ndcDepth   : f32
//   [9]     bladeCount : f32 (< -0.5 = corona/halo mode; 0 = anamorphic streak mode; otherwise a
//                              5-9 sided aperture polygon)
//   [10]    rotation   : f32 (radians; varies the polygon's orientation between ghosts)
//                              (struct rounds up to 12 floats / 48 bytes; float 11 is padding)
//
// A single screen-space billboard quad drawn directly in clip space (no view-projection matrix
// needed — the caller already resolves the Sun's screen position to NDC on the CPU each frame,
// reusing the same math as worldToScreen). Reuses the star pipeline's vertex_index quad-corner
// trick, with w fixed at 1.0 so clip space equals NDC space directly. ndcDepth is the Sun's own
// NDC depth (same convention as every other depth-tested draw in this renderer), so
// depthCompare 'less' against the scene's existing depth buffer (populated by the main pass,
// drawn beforehand) makes planets naturally occlude the flare per-pixel with no CPU readback.
// Every flare's color.rgb is additionally faded each frame by how much of the Sun's actual screen-
// space disc is covered by a nearer body (see circleOverlap.ts + main.ts's per-frame computation)
// — a smooth analytic dim rather than this per-pixel depth cutoff popping on/off at the silhouette;
// the two mechanisms are complementary (global soft dimmer vs. local hard silhouette clip).
//
// Three shapes, chosen per-instance by main.ts's FLARE_SPECS: a regular N-gon (5-9 sides) evaluated
// via a polar signed-distance function — mimicking a real camera's aperture-blade diaphragm,
// which is what actually produces polygonal "ghost" artifacts and bokeh in a lens flare, rather
// than the plain circular blobs (easily mistaken for tiny planets) this shader used before — a
// thin, wide horizontal streak, the signature look of an anamorphic lens flare — and a soft radial
// corona/halo centered directly on the Sun.
export const flareShaderCode = /* wgsl */ `
struct Uniforms {
  color: vec4f,
  ndcCenter: vec2f,
  sizeNdc: vec2f,
  ndcDepth: f32,
  bladeCount: f32,
  rotation: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

const PI: f32 = 3.14159265;

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let corner = corners[vertexIndex];
  var out: VertexOutput;
  out.position = vec4f(uni.ndcCenter + corner * uni.sizeNdc, uni.ndcDepth, 1.0);
  out.uv = corner;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  var intensity: f32;
  if (uni.bladeCount < -0.5) {
    // Corona/halo: a soft radial glow centered on the Sun itself (no polygon faceting) — a bright
    // core falling off quickly, plus a fainter, wider skirt for a softer overall halo than the
    // aperture ghosts or the bloom pass alone produce.
    let d = length(in.uv);
    let core = pow(smoothstep(1.0, 0.0, d), 3.0);
    let skirt = pow(smoothstep(1.0, 0.0, d), 0.5);
    intensity = core + 0.3 * skirt;
  } else if (uni.bladeCount < 0.5) {
    // Anamorphic streak: thin in Y, a soft wide plateau in X (not a point falloff), so it reads
    // as a stretched smear of light through the source rather than an ellipse.
    let vertical = smoothstep(1.0, 0.0, abs(in.uv.y));
    let horizontal = smoothstep(1.0, 0.2, abs(in.uv.x));
    intensity = vertical * horizontal;
  } else {
    // Regular N-gon polar SDF: for each angular slice between blade vertices, the polygon's edge
    // is closer to the center than the circumscribed radius by cos(halfSliceAngle)/cos(offset)
    // — this is the standard trick for evaluating a regular-polygon boundary in polar form.
    let angle = atan2(in.uv.y, in.uv.x) + uni.rotation;
    let sliceAngle = 2.0 * PI / uni.bladeCount;
    let angleInSlice = angle - sliceAngle * floor(angle / sliceAngle) - sliceAngle * 0.5;
    let polygonEdgeRadius = cos(sliceAngle * 0.5) / cos(angleInSlice);
    let normalizedDistance = length(in.uv) / polygonEdgeRadius;
    intensity = smoothstep(1.0, 0.8, normalizedDistance);
  }
  return vec4f(uni.color.rgb * intensity, uni.color.a * intensity);
}
`

// Uniform layout (must match the Float32Array packing in main.ts exactly):
//   [0..16)  worldViewProjection : mat4x4f
//   [16..32) world               : mat4x4f
//   [32..36) lightDirection      : vec4f (xyz used, w unused)
//
// A flat annulus (see geometry/ring.ts) with no per-vertex normal attribute — its local normal is
// always (0,0,1) (the ring mesh lies flat in the local XY plane; local +Z is its normal, matching
// generateSphereMesh's own polar-axis convention), transformed by `world` in the fragment shader.
// Lit two-sided (abs() on the dot product) since the ring is visible from both above and below and
// cullMode is 'none'. The ring texture is a single radial gradient strip (color + transparency by
// distance from the planet, e.g. the Cassini Division gap), so texture alpha drives real
// transparency via alpha blending.
export const ringShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  lightDirection: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ringTexture: texture_2d<f32>;
@group(0) @binding(2) var ringSampler: sampler;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.uv = vert.uv;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let sampled = textureSample(ringTexture, ringSampler, in.uv);
  let normal = normalize((uni.world * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
  let brightness = abs(dot(normal, -uni.lightDirection.xyz)) * 0.85 + 0.15;
  return vec4f(sampled.rgb * brightness, sampled.a);
}
`
