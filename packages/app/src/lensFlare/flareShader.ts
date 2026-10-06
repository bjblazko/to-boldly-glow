// Uniform layout (must match the Float32Array packing in lensFlare.ts exactly):
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
// space disc is covered by a nearer body (see sunVisibility.ts)
// — a smooth analytic dim rather than this per-pixel depth cutoff popping on/off at the silhouette;
// the two mechanisms are complementary (global soft dimmer vs. local hard silhouette clip).
//
// Three shapes, chosen per-instance by FLARE_SPECS (flareSpecs.ts): a regular N-gon (5-9 sides) evaluated
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
