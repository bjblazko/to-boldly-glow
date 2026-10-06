// How high Earth's cloud layer floats, in Earth radii above the surface (exaggerated, like every
// size in Compact scale, so the clouds' shadows fall visibly beside them).
export const CLOUD_ALTITUDE = 0.012

// Earth's clouds: a light, procedural cover - no cloud map, just noise shaped by where weather
// gathers. Shared by the cloud layer (cloudLayerShader.ts) and the lit body shader's cloud shadows,
// so every shadow lies exactly under its cloud.
export const cloudCoverWgsl = /* wgsl */ `
const CLOUD_ALTITUDE: f32 = ${CLOUD_ALTITUDE};
// Weather systems span about a third of an Earth radius.
const CLOUD_FEATURE_SCALE: f32 = 2.6;
// Radians per (real) second the winds carry the clouds around the globe.
const CLOUD_WIND: f32 = 0.004;

fn cloudHash(p: vec3f) -> f32 {
  return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453);
}

fn cloudNoise(p: vec3f) -> f32 {
  let cell = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let bottom = mix(
    mix(cloudHash(cell), cloudHash(cell + vec3f(1.0, 0.0, 0.0)), u.x),
    mix(cloudHash(cell + vec3f(0.0, 1.0, 0.0)), cloudHash(cell + vec3f(1.0, 1.0, 0.0)), u.x),
    u.y,
  );
  let top = mix(
    mix(cloudHash(cell + vec3f(0.0, 0.0, 1.0)), cloudHash(cell + vec3f(1.0, 0.0, 1.0)), u.x),
    mix(cloudHash(cell + vec3f(0.0, 1.0, 1.0)), cloudHash(cell + vec3f(1.0, 1.0, 1.0)), u.x),
    u.y,
  );
  return mix(bottom, top, u.z);
}

fn cloudFbm(p: vec3f) -> f32 {
  var sum = 0.0;
  var amplitude = 0.5;
  var q = p;
  for (var octave = 0; octave < 4; octave = octave + 1) {
    sum += amplitude * cloudNoise(q);
    q = q * 2.03 + vec3f(1.7, 9.2, 4.1);
    amplitude *= 0.5;
  }
  return sum;
}

// Where weather gathers: the equatorial rain belt and the mid-latitude storm tracks are cloudier,
// the subtropical desert belts clearer.
fn cloudClimate(latitude: f32) -> f32 {
  let tropics = 1.0 - smoothstep(0.0, 0.25, latitude);
  let subtropics = smoothstep(0.25, 0.4, latitude) * (1.0 - smoothstep(0.55, 0.75, latitude));
  let polar = smoothstep(0.7, 1.0, latitude);
  return 0.08 * tropics - 0.1 * subtropics + 0.05 * polar;
}

// Cloud cover (0-1) in a direction from Earth's center, in Earth's own frame - so the clouds turn
// with the planet - carried by the winds (trade winds westward in the tropics, westerlies eastward
// farther out, shearing the clouds into bands) and slowly reshaping as time passes.
fn cloudCover(direction: vec3f, timeSeconds: f32) -> f32 {
  let latitude = abs(asin(clamp(direction.z, -1.0, 1.0)));
  let wind = mix(-1.0, 1.0, smoothstep(0.35, 0.6, latitude)) * CLOUD_WIND * timeSeconds;
  let drifted = vec3f(cos(wind) * direction.x - sin(wind) * direction.y, sin(wind) * direction.x + cos(wind) * direction.y, direction.z);
  let p = drifted * CLOUD_FEATURE_SCALE;
  let swirl = cloudFbm(p * 1.3 + vec3f(timeSeconds * 0.002));
  let density = cloudFbm(p + vec3f(swirl * 1.5));
  return smoothstep(0.5, 0.72, density + cloudClimate(latitude));
}
`
