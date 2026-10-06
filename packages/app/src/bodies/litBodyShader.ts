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
    // Local +Z, matching the ring mesh's actual flat plane (saturnRing/ringMesh.ts generates it flat in
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
