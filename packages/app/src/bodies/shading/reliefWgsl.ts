// Surface relief: the shading normal perturbed by a height map, with a matching ambient-occlusion
// darkening, faded out toward the poles where equirectangular textures break down. Part of the lit
// body shader (see litBodyShader.ts), which declares the uniforms and textures these read.
export const reliefWgsl = /* wgsl */ `
// Equirectangular textures compress an enormous amount of image width into a physically tiny
// sliver of image height near each pole (v=0 north, v=1 south — see sphereMesh.ts's UV
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

  // Tangent = direction of increasing u (east, counterclockwise about the pole - see
  // sphereMesh.ts's UV comment), bitangent = direction of increasing v (south), matching the
  // east-west / south-north sample differences below.
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
  let bitangent = cross(tangent, normal);

  let dHeightDu = (east - west) * 0.5;
  let dHeightDv = (south - north) * 0.5;
  let perturbedNormal = normalize(normal - (tangent * dHeightDu + bitangent * dHeightDv) * intensity * BUMP_STRENGTH_SCALE);

  let neighborAvg = (east + west + north + south) * 0.25;
  let cavity = max(0.0, neighborAvg - center);
  let ao = 1.0 - clamp(cavity * intensity * AO_STRENGTH_SCALE, 0.0, AO_MAX_DARKENING);

  return BumpResult(perturbedNormal, ao);
}
`
