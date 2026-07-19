// Uniform layout (must match the Float32Array packing in main.ts exactly):
//   [0..16)  worldViewProjection : mat4x4f
//   [16..32) world               : mat4x4f
//   [32..36) color               : vec4f
//   [36..40) lightDirection      : vec4f (xyz used, w unused — vec4 avoids WGSL's vec3
//                                 trailing-padding alignment gotcha in uniform buffers)
//   [40..44) cameraPosition      : vec4f (xyz used, w unused; world-space, for specular)
export const litSphereShaderCode = /* wgsl */ `
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
  @location(1) uv: vec2f,
  @location(2) worldPosition: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var bodyTexture: texture_2d<f32>;
@group(0) @binding(2) var bodySampler: sampler;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.normal = (uni.world * vec4f(vert.normal, 0.0)).xyz;
  out.uv = vert.uv;
  out.worldPosition = (uni.world * vec4f(vert.position, 1.0)).xyz;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let toLight = -uni.lightDirection.xyz;
  let diffuse = max(dot(normal, toLight), 0.0) * 0.85 + 0.1;
  let sampled = textureSample(bodyTexture, bodySampler, in.uv);

  // A small Blinn-Phong specular highlight — real planets aren't matte diffuse-only, and a
  // subtle sheen reads as "not flat" much more effectively than raising the diffuse/ambient terms
  // (which would just wash out the day/night terminator instead of adding actual dimensionality).
  // Deliberately restrained (low intensity, tight cone) since these are dry rocky/gaseous bodies,
  // not glossy spheres — this is not a physically-based ocean/ice reflectance model.
  let toCamera = normalize(uni.cameraPosition.xyz - in.worldPosition);
  let halfVector = normalize(toLight + toCamera);
  let specular = pow(max(dot(normal, halfVector), 0.0), 24.0) * 0.15 * step(0.0, dot(normal, toLight));

  return vec4f(sampled.rgb * uni.color.rgb * diffuse + vec3f(specular), uni.color.a);
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
//   [9]     bladeCount : f32 (0 = anamorphic streak mode; otherwise a 5-9 sided aperture polygon)
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
//
// Two shapes, chosen per-instance by main.ts's FLARE_SPECS: a regular N-gon (5-9 sides) evaluated
// via a polar signed-distance function — mimicking a real camera's aperture-blade diaphragm,
// which is what actually produces polygonal "ghost" artifacts and bokeh in a lens flare, rather
// than the plain circular blobs (easily mistaken for tiny planets) this shader used before — and
// a thin, wide horizontal streak, the signature look of an anamorphic lens flare.
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
  if (uni.bladeCount < 0.5) {
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
// always (0,1,0), transformed by `world` in the fragment shader. Lit two-sided (abs() on the dot
// product) since the ring is visible from both above and below and cullMode is 'none'. The ring
// texture is a single radial gradient strip (color + transparency by distance from the planet,
// e.g. the Cassini Division gap), so texture alpha drives real transparency via alpha blending.
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
  let normal = normalize((uni.world * vec4f(0.0, 1.0, 0.0, 0.0)).xyz);
  let brightness = abs(dot(normal, -uni.lightDirection.xyz)) * 0.85 + 0.15;
  return vec4f(sampled.rgb * brightness, sampled.a);
}
`
