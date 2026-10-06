// How a body's surface reflects sunlight, per material (see surfaceMaterial.ts): which parts are
// open water or ice - read from the albedo texture - how the surface scatters light diffusely, and
// the Sun's highlight on it. Part of the lit body shader (see litBodyShader.ts), which declares the
// uniforms these read.
export const surfaceReflectanceWgsl = /* wgsl */ `
const PI: f32 = 3.14159265;
// Clear water and ice reflect about 2% of light head-on, more and more toward grazing angles.
const WATER_REFLECTANCE: f32 = 0.02;
// Keeps a perfect glint from turning into a single blown-out pixel.
const MAX_HIGHLIGHT: f32 = 6.0;
// Just enough light on the night side to make out the surface, as by earthshine or starlight.
const NIGHT_SIDE_LIGHT: f32 = 0.015;

struct Surface {
  roughness: f32,
  specular: f32,
  ocean: f32,
};

// Everything about how one point of the surface is lit and seen.
struct SurfaceShading {
  normal: vec3f,
  glitterNormal: vec3f,
  toLight: vec3f,
  toCamera: vec3f,
  // How much of the Sun's disc the point sees (eclipses), and the color its light arrives in.
  sunlight: f32,
  sunColor: vec3f,
};

fn brightness(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

// Open water: on Earth's map the only blue there is (land is never bluer than it is red).
fn oceanWeight(albedo: vec3f) -> f32 {
  return uni.ocean.z * smoothstep(0.1, 0.22, albedo.b - albedo.r);
}

// Ice: bright and nearly colorless (deserts are as bright, but clearly tinted).
fn iceWeight(albedo: vec3f) -> f32 {
  let strongest = max(albedo.r, max(albedo.g, albedo.b));
  let saturation = (strongest - min(albedo.r, min(albedo.g, albedo.b))) / max(strongest, 1e-4);
  return uni.ice.z * smoothstep(0.62, 0.8, brightness(albedo)) * (1.0 - smoothstep(0.06, 0.16, saturation));
}

fn surfaceAt(albedo: vec3f) -> Surface {
  let ocean = oceanWeight(albedo);
  let ice = iceWeight(albedo) * (1.0 - ocean);
  let roughness = mix(mix(uni.surface.x, uni.ice.x, ice), uni.ocean.x, ocean);
  let specular = mix(mix(uni.surface.y, uni.ice.y, ice), uni.ocean.y, ocean);
  return Surface(roughness, specular, ocean);
}

// Sunlight scattered back from the surface. A matte surface fades toward the terminator - over a
// narrowed band, so the day/night boundary reads clearly - while dusty regolith stays evenly
// bright out to the limb (Lommel-Seeliger), and gas and cloud decks darken toward the limb.
fn diffuseReflection(normal: vec3f, toLight: vec3f, toCamera: vec3f) -> f32 {
  let incidence = dot(normal, toLight);
  let matte = smoothstep(-0.12, 0.12, incidence);
  let lit = max(incidence, 0.0);
  let seen = max(dot(normal, toCamera), 0.0);
  let dusty = min(2.0 * lit / (lit + seen + 1e-4), 1.4) * smoothstep(-0.04, 0.06, incidence);
  let limb = pow(max(seen, 1e-3), uni.surface.w);
  return mix(matte, dusty, uni.surface.z) * limb;
}

// The Sun's highlight (GGX microfacets with Schlick's Fresnel): a tight, bright glint on calm
// water that grows toward the limb, a broad sheen on ice and cloud tops, next to nothing on rock.
fn sunHighlight(normal: vec3f, toLight: vec3f, toCamera: vec3f, roughness: f32) -> f32 {
  let incidence = dot(normal, toLight);
  if (incidence <= 0.0) {
    return 0.0;
  }
  let halfway = normalize(toLight + toCamera);
  let alpha = max(roughness * roughness, 0.002);
  let alphaSquared = alpha * alpha;
  let facing = max(dot(normal, halfway), 0.0);
  let spread = facing * facing * (alphaSquared - 1.0) + 1.0;
  let distribution = alphaSquared / (PI * spread * spread);
  let k = alpha * 0.5;
  let seen = max(dot(normal, toCamera), 1e-3);
  let visibility = 0.25 / ((incidence * (1.0 - k) + k) * (seen * (1.0 - k) + k));
  let fresnel = WATER_REFLECTANCE + (1.0 - WATER_REFLECTANCE) * pow(1.0 - max(dot(toCamera, halfway), 0.0), 5.0);
  return min(distribution * visibility * fresnel * incidence, MAX_HIGHLIGHT);
}

fn hash22(p: vec2f) -> vec2f {
  return fract(sin(vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)))) * 43758.5453);
}

// Sun glitter: on open water the glint breaks into sparkles from waves far too small to see -
// each patch of sea tilted at random, its tilt slowly turning. Patches are about two screen pixels
// across whatever the distance, so the glitter neither aliases nor turns to mush.
fn glitterNormal(normal: vec3f, frame: TangentFrame, uv: vec2f, pixelsPerUv: vec2f) -> vec3f {
  let cells = max(pixelsPerUv * 0.5, vec2f(1.0));
  let cell = floor(uv * cells);
  let random = hash22(cell);
  let angle = random.x * 2.0 * PI + uni.surfaceDetail.z * (0.6 + random.y);
  let tilt = (0.15 + 0.2 * random.y) * uni.surfaceDetail.y;
  return normalize(normal + (frame.tangent * cos(angle) + frame.bitangent * sin(angle)) * tilt);
}

// Everything the surface itself sends toward the camera: its diffusely lit color plus the Sun's
// highlight - on water, partly broken into glitter.
fn reflectedLight(albedo: vec3f, shading: SurfaceShading) -> vec3f {
  let surface = surfaceAt(albedo);
  let diffuse = diffuseReflection(shading.normal, shading.toLight, shading.toCamera) * shading.sunlight;
  let calm = sunHighlight(shading.normal, shading.toLight, shading.toCamera, surface.roughness);
  let sparkling = sunHighlight(shading.glitterNormal, shading.toLight, shading.toCamera, surface.roughness * 0.5);
  let highlight = mix(calm, mix(calm, sparkling, 0.6), surface.ocean * uni.surfaceDetail.y);
  return (albedo * diffuse * 0.98 + vec3f(highlight * surface.specular * shading.sunlight)) * shading.sunColor + albedo * NIGHT_SIDE_LIGHT;
}
`
