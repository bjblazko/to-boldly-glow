// Surface relief: the shading normal perturbed by a height map - or by heights read from the albedo
// - with a matching ambient-occlusion darkening, faded out toward the poles where equirectangular
// textures break down. Part of the lit
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
// Brightness differences in an albedo texture run far larger than in a height map, so read as
// heights they count for less.
const ALBEDO_RELIEF_SCALE: f32 = 1.2;

struct TangentFrame {
  tangent: vec3f,
  bitangent: vec3f,
};

// The surface's own east and south directions, in which the textures' u and v grow. No per-vertex
// tangent attributes are needed: for a UV-sphere, the tangent (longitude direction) is always
// perpendicular to both the surface normal and the polar axis, so it's derived here via a cross
// product against the sphere's own local +Z axis (transformed to world space through uni.world) —
// the same "transform a local axis, drop translation" trick sunVisibleFraction's ring-plane test
// and ringShaderCode both use for their own normals.
fn tangentFrame(normal: vec3f) -> TangentFrame {
  let polarAxis = normalize((uni.world * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
  var tangent = cross(polarAxis, normal);
  let tangentLength = length(tangent);
  if (tangentLength < 1e-4) {
    // Exactly at a pole, where tangent direction is undefined (normal is parallel to polarAxis) —
    // any consistent direction works here, since poleFadeFactor already fades every effect using
    // it toward zero at the poles regardless.
    tangent = vec3f(1.0, 0.0, 0.0);
  } else {
    tangent = tangent / tangentLength;
  }
  return TangentFrame(tangent, cross(tangent, normal));
}

struct BumpResult {
  normal: vec3f,
  ao: f32,
};

// Heights around a point: its own and its four neighbors' one step east, west, south and north.
struct Heights {
  center: f32,
  east: f32,
  west: f32,
  south: f32,
  north: f32,
};

fn heightMapHeights(uv: vec2f) -> Heights {
  let step = 1.0 / vec2f(textureDimensions(bumpTexture));
  return Heights(
    textureSampleLevel(bumpTexture, bodySampler, uv, 0.0).r,
    textureSampleLevel(bumpTexture, bodySampler, uv + vec2f(step.x, 0.0), 0.0).r,
    textureSampleLevel(bumpTexture, bodySampler, uv - vec2f(step.x, 0.0), 0.0).r,
    textureSampleLevel(bumpTexture, bodySampler, uv + vec2f(0.0, step.y), 0.0).r,
    textureSampleLevel(bumpTexture, bodySampler, uv - vec2f(0.0, step.y), 0.0).r,
  );
}

fn albedoHeight(uv: vec2f, level: f32) -> f32 {
  return dot(textureSampleLevel(bodyTexture, bodySampler, uv, level).rgb, vec3f(0.2126, 0.7152, 0.0722));
}

// The albedo's light and shade read as heights - bright highlands and crater rims, dark maria and
// valleys - at the mip level one screen pixel covers, so the relief doesn't alias from afar. A
// coarser level spans more ground per step, so its height differences make gentler slopes: from
// afar only the large features show, close up the fine ones too (partly compensated, so the relief
// doesn't vanish altogether at a distance).
fn albedoHeights(uv: vec2f, level: f32) -> Heights {
  let step = exp2(level) / vec2f(textureDimensions(bodyTexture));
  let gentler = exp2(-0.75 * level);
  let center = albedoHeight(uv, level);
  return Heights(
    center,
    center + (albedoHeight(uv + vec2f(step.x, 0.0), level) - center) * gentler,
    center + (albedoHeight(uv - vec2f(step.x, 0.0), level) - center) * gentler,
    center + (albedoHeight(uv + vec2f(0.0, step.y), level) - center) * gentler,
    center + (albedoHeight(uv - vec2f(0.0, step.y), level) - center) * gentler,
  );
}

// Tilts the normal down each slope (u grows east, v grows south), and darkens cavities a little: a
// cheap ambient occlusion from the same samples.
fn perturbedNormal(normal: vec3f, frame: TangentFrame, heights: Heights, strengths: vec2f) -> BumpResult {
  let slope = vec2f(heights.east - heights.west, heights.south - heights.north) * 0.5;
  let tilted = normalize(normal - (frame.tangent * slope.x + frame.bitangent * slope.y) * strengths.x);
  let cavity = max(0.0, (heights.east + heights.west + heights.north + heights.south) * 0.25 - heights.center);
  return BumpResult(tilted, 1.0 - clamp(cavity * strengths.y, 0.0, AO_MAX_DARKENING));
}

// Relief: a real height map where the body has one (the gas giants' bands), otherwise heights read
// from its albedo (craters, mountain ranges), slightly exaggerated so they show from afar. Albedo
// relief adds no ambient occlusion: its dark patches are dark already.
fn applyRelief(normal: vec3f, frame: TangentFrame, uv: vec2f, albedoLevel: f32) -> BumpResult {
  let heightMap = uni.bumpParams.x;
  if (heightMap > 0.0) {
    return perturbedNormal(normal, frame, heightMapHeights(uv), vec2f(heightMap * BUMP_STRENGTH_SCALE, heightMap * AO_STRENGTH_SCALE));
  }
  let fromAlbedo = uni.surfaceDetail.x;
  if (fromAlbedo > 0.0) {
    return perturbedNormal(normal, frame, albedoHeights(uv, albedoLevel), vec2f(fromAlbedo * ALBEDO_RELIEF_SCALE, 0.0));
  }
  return BumpResult(normal, 1.0);
}
`
