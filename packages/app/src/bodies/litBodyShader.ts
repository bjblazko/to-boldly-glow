import { eclipseShadowWgsl } from './shading/eclipseShadowWgsl'
import { reliefWgsl } from './shading/reliefWgsl'

// Uniform float count for litSphereShaderCode's Uniforms struct below, shared with the packing in
// litBodyUniforms.ts: a mismatch is silently wrong rendering, not a compile error.
export const LIT_UNIFORM_FLOAT_COUNT = 80

// Uniform layout (must match the Float32Array packing in litBodyUniforms.ts exactly):
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
//   [72..76) northHemisphereTint : vec4f (rgb = tint color, a = blend strength; a of 0 means no
//                                 tint - every body writes this as all-zero except learn mode's
//                                 seasons-lesson Earth)
//   [76..80) southHemisphereTint : vec4f (same shape as northHemisphereTint, for the hemisphere on
//                                 the opposite side of this body's own local +Z/pole axis)
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
  northHemisphereTint: vec4f,
  southHemisphereTint: vec4f,
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

${eclipseShadowWgsl}
${reliefWgsl}

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
  // A raw Lambertian max(dot,0) falls off gradually across nearly a full hemisphere before
  // reaching the ambient floor, reading as a soft haze rather than a clear day/night boundary.
  // smoothstep over a narrow band around the geometric terminator (dot == 0) compresses that
  // falloff into a much narrower, harder-edged band instead, while the lit and unlit hemispheres
  // still each reach their own flat extreme well before the actual terminator.
  let litFraction = smoothstep(-0.12, 0.12, dot(normal, toLight)) * shadowFactor;
  let diffuse = litFraction * 0.92 + 0.04;
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
  let litColor = sampled.rgb * uni.color.rgb * diffuse * aoFactor + vec3f(specular) * aoFactor + atmosphereGlow;

  // Learn-mode hemisphere overlay: a translucent wash over the whole northern or southern half of
  // the globe (split at the body's own local +Z/pole axis, the same axis applyBump above reads),
  // independent of the day/night terminator - the point is to show which hemisphere is tilted
  // toward the Sun THIS season, not which side is lit at this instant. Zero alpha (every body
  // outside the seasons lesson's Earth) makes this a no-op.
  let polarAxis = normalize((uni.world * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
  let hemisphereTint = select(uni.southHemisphereTint, uni.northHemisphereTint, dot(geometricNormal, polarAxis) > 0.0);
  let finalColor = mix(litColor, hemisphereTint.rgb, hemisphereTint.a);

  return vec4f(finalColor, uni.color.a);
}
`
