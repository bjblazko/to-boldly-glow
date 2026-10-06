import { atmosphereWgsl } from './shading/atmosphereWgsl'
import { eclipseShadowWgsl } from './shading/eclipseShadowWgsl'
import { reliefWgsl } from './shading/reliefWgsl'
import { surfaceReflectanceWgsl } from './shading/surfaceReflectanceWgsl'

// Uniform float count for litSphereShaderCode's Uniforms struct below, shared with the packing in
// litBodyUniforms.ts: a mismatch is silently wrong rendering, not a compile error.
export const LIT_UNIFORM_FLOAT_COUNT = 100

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
//   [80..100) the body's surface material, packed by surfaceMaterial.ts's packSurfaceMaterial:
//            surface       : vec4f (roughness, specular, regolith, limb darkening)
//            surfaceDetail : vec4f (albedo relief, ocean glitter, time in seconds, unused)
//            ocean         : vec4f (roughness, specular, enabled 0/1, unused)
//            ice           : vec4f (roughness, specular, enabled 0/1, unused)
//            twilight      : vec4f (rgb = color of twilight sunlight, a = strength)
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
  surface: vec4f,
  surfaceDetail: vec4f,
  ocean: vec4f,
  ice: vec4f,
  twilight: vec4f,
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
${surfaceReflectanceWgsl}
${atmosphereWgsl}

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

  // How much texture one screen pixel covers: the relief is read at that mip level, and the ocean's
  // glitter is sized to it.
  let uvPerPixel = max(fwidth(in.uv), vec2f(1e-6));
  let texels = vec2f(textureDimensions(bodyTexture));
  let albedoLevel = clamp(log2(max(max(uvPerPixel.x * texels.x, uvPerPixel.y * texels.y), 1.0)), 0.0, f32(textureNumLevels(bodyTexture) - 1u));

  // Relief is faded back toward "no effect" (raw normal, ao=1) near the poles via the same poleFade
  // weight used for the color sample below, rather than separately blurring the height source's
  // own mip chain — a zero-magnitude perturbation can't show any artifact regardless of what the
  // underlying height samples look like.
  let frame = tangentFrame(geometricNormal);
  let relief = applyRelief(geometricNormal, frame, in.uv, albedoLevel);
  let normal = normalize(mix(geometricNormal, relief.normal, poleFade));
  let aoFactor = mix(1.0, relief.ao, poleFade);

  let sharpColor = textureSample(bodyTexture, bodySampler, in.uv);
  let coarseLevel = f32(textureNumLevels(bodyTexture) - 1u);
  let blurryColor = textureSampleLevel(bodyTexture, bodySampler, in.uv, coarseLevel);
  let albedo = mix(blurryColor, sharpColor, poleFade).rgb * uni.color.rgb;

  let toLight = -uni.lightDirection.xyz;
  let toCamera = normalize(uni.cameraPosition.xyz - in.worldPosition);
  let sunlight = sunVisibleFraction(in.worldPosition);
  let shading = SurfaceShading(
    normal,
    glitterNormal(normal, frame, in.uv, 1.0 / uvPerPixel),
    toLight,
    toCamera,
    sunlight,
    sunlightColor(geometricNormal, toLight),
  );
  // aoFactor darkens what the surface itself reflects, but not the atmosphere's glow above it.
  let litColor = reflectedLight(albedo, shading) * aoFactor + rimGlow(normal, toLight, toCamera, sunlight) + twilightGlow(geometricNormal, toLight, sunlight);

  // Learn-mode hemisphere overlay: a translucent wash over the whole northern or southern half of
  // the globe (split at the body's own local +Z/pole axis, the same axis tangentFrame reads),
  // independent of the day/night terminator - the point is to show which hemisphere is tilted
  // toward the Sun THIS season, not which side is lit at this instant. Zero alpha (every body
  // outside the seasons lesson's Earth) makes this a no-op.
  let polarAxis = normalize((uni.world * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
  let hemisphereTint = select(uni.southHemisphereTint, uni.northHemisphereTint, dot(geometricNormal, polarAxis) > 0.0);
  let finalColor = mix(litColor, hemisphereTint.rgb, hemisphereTint.a);

  return vec4f(finalColor, uni.color.a);
}
`
