import { AURORA_SHELL_RADIUS, GEOMAGNETIC_POLE, OVAL_COLATITUDE_DEGREES } from './auroraOval'

// Uniform layout (must match the packing in aurora.ts exactly):
//   [0..16)  worldViewProjection : mat4x4f (of the shell: Earth's frame scaled to the shell's radius)
//   [16..32) earth               : mat4x4f (Earth's frame at unit scale: rotation and position)
//   [32..36) center              : vec4f (xyz = Earth's center, w = its radius)
//   [36..40) camera              : vec4f (xyz = camera position, w = wall-clock seconds)
//   [40..44) sun                 : vec4f (xyz = unit direction from Earth toward the Sun, w = activity 0-1)
export const AURORA_UNIFORM_FLOAT_COUNT = 44

const f = (value: number) => value.toFixed(5)

// Earth's northern and southern lights, seen from space: rings of green curtains around the
// geomagnetic poles on the night side, red above, combed into vertical rays along the magnetic
// field lines and folded along the oval, breathing with the aurora's activity. Drawn on a shell
// around Earth (additively, it gives off light); each pixel follows its line of sight through the
// glowing layer in a few steps - looking down, the layer is thin, so the curtains are faint bands
// over the night side; toward the limb the line of sight runs along them, and they rise above the
// horizon as a bright glow.
export const auroraShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  earth: mat4x4f,
  center: vec4f,
  camera: vec4f,
  sun: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

const SHELL_RADIUS: f32 = ${f(AURORA_SHELL_RADIUS)};
const GEOMAGNETIC_POLE = vec3f(${GEOMAGNETIC_POLE.map(f).join(', ')});
const DEGREES: f32 = 0.0174533;
const COLATITUDE_MIDNIGHT: f32 = ${f(OVAL_COLATITUDE_DEGREES.midnight)};
const COLATITUDE_NOON: f32 = ${f(OVAL_COLATITUDE_DEGREES.noon)};
// Nothing glows farther than this from either geomagnetic pole (radians): steps outside it skip
// all the work.
const AURORAL_ZONE_COS: f32 = 0.79;
const STEPS: i32 = 12;
// Oxygen's green line (557.7 nm), its red line (630.0 nm), nitrogen's pink-violet.
const GREEN = vec3f(0.22, 1.0, 0.42);
const RED = vec3f(1.0, 0.16, 0.22);
const NITROGEN = vec3f(0.85, 0.3, 0.9);
// Brightness of the glowing layer per Earth radius of line of sight.
const EMISSION_PER_RADIUS: f32 = 38.0;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  let frame = mat3x3f(uni.earth[0].xyz, uni.earth[1].xyz, uni.earth[2].xyz);
  out.worldPosition = uni.earth[3].xyz + frame * (vert.position * SHELL_RADIUS * uni.center.w);
  return out;
}

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(0.1031, 0.1030));
  q += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x);
}

fn noise2(p: vec2f) -> f32 {
  let cell = floor(p);
  let t = fract(p);
  let u = t * t * (3.0 - 2.0 * t);
  let a = mix(hash21(cell), hash21(cell + vec2f(1.0, 0.0)), u.x);
  let b = mix(hash21(cell + vec2f(0.0, 1.0)), hash21(cell + vec2f(1.0, 1.0)), u.x);
  return mix(a, b, u.y);
}

// The light given off at a point of the layer: local = its direction in Earth's own frame, height
// above the ground (Earth radii), midnight = the direction away from the Sun in Earth's frame.
fn glow(local: vec3f, height: f32, midnight: vec3f) -> vec3f {
  let alongPole = dot(local, GEOMAGNETIC_POLE);
  if (abs(alongPole) < AURORAL_ZONE_COS) {
    return vec3f(0.0);
  }
  let pole = GEOMAGNETIC_POLE * sign(alongPole);
  // Clamped: right at the pole, rounding can carry the cosine a hair past 1.
  let colatitude = acos(min(abs(alongPole), 1.0));
  // Magnetic local time: 0 at midnight, pi at noon.
  let towardMidnight = normalize(midnight - dot(midnight, pole) * pole);
  let localTime = atan2(dot(local, cross(pole, towardMidnight)), dot(local, towardMidnight));
  let activity = uni.sun.w;
  let time = uni.camera.w;
  let quiet = 0.5 * (COLATITUDE_MIDNIGHT + COLATITUDE_NOON) + 0.5 * (COLATITUDE_MIDNIGHT - COLATITUDE_NOON) * cos(localTime);
  let width = (2.0 + 1.5 * (0.5 + 0.5 * cos(localTime))) * DEGREES;
  // The oval sways in broad arcs and folds into smaller loops; the curtains drift slowly along it.
  let hemisphere = sign(alongPole) * 3.0;
  let sway = noise2(vec2f(localTime * 2.5 + time * 0.02, hemisphere)) - 0.5;
  let folds = noise2(vec2f(localTime * 14.0 + time * 0.07, hemisphere + 1.5)) - 0.5;
  let fold = (1.6 * sway + 0.6 * folds) * width;
  let center = quiet * DEGREES * (1.0 + 0.2 * (activity - 0.5)) + fold;
  let offBand = (colatitude - center) / width;
  let band = exp(-offBand * offBand);
  let rays = 0.3 + 0.7 * noise2(vec2f(localTime * 140.0 + time * 0.3, colatitude * 30.0));
  let midnightBright = 0.5 + 0.5 * cos(localTime);
  let green = smoothstep(0.0145, 0.0175, height) * exp(-max(height - 0.0175, 0.0) / 0.01);
  let aboveGreen = (height - 0.038) / 0.014;
  let red = 0.18 * exp(-aboveGreen * aboveGreen);
  let atBottom = (height - 0.0155) / 0.002;
  let fringe = 0.12 * exp(-atBottom * atBottom);
  let strength = band * rays * midnightBright * (0.3 + activity);
  return strength * (GREEN * green + RED * red + NITROGEN * fringe);
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let radius = uni.center.w;
  let origin = (uni.camera.xyz - uni.center.xyz) / radius;
  let ray = normalize(in.worldPosition - uni.camera.xyz);
  let b = dot(origin, ray);
  let shell = b * b - dot(origin, origin) + SHELL_RADIUS * SHELL_RADIUS;
  if (shell <= 0.0) {
    discard;
  }
  let start = max(-b - sqrt(shell), 0.0);
  var end = -b + sqrt(shell);
  // The line of sight ends at the ground, if it reaches it.
  let ground = b * b - dot(origin, origin) + 1.0;
  if (ground > 0.0 && -b - sqrt(ground) > 0.0) {
    end = min(end, -b - sqrt(ground));
  }
  let frame = mat3x3f(uni.earth[0].xyz, uni.earth[1].xyz, uni.earth[2].xyz);
  let toLocal = transpose(frame);
  let midnight = -(toLocal * uni.sun.xyz);
  let step = (end - start) / f32(STEPS);
  let jitter = hash21(in.position.xy);
  var light = vec3f(0.0);
  for (var i = 0; i < STEPS; i++) {
    let point = origin + ray * (start + (f32(i) + jitter) * step);
    let distance = length(point);
    let up = point / distance;
    // Only where the ground below lies in the night does the aurora outshine the sky.
    let dark = 1.0 - smoothstep(-0.12, 0.08, dot(up, uni.sun.xyz));
    if (dark > 0.0) {
      light += glow(toLocal * up, distance - 1.0, midnight) * dark * step;
    }
  }
  let emitted = light * EMISSION_PER_RADIUS;
  // The brightest stretches along the limb roll off instead of burning out.
  return vec4f(emitted / (1.0 + 0.25 * max(emitted.g, 0.0)), 0.0);
}
`
