import { MAX_FLARE_ELEMENTS } from './flareLayout'

// Uniform layout (packed by lensFlare.ts and flareLayout.ts):
//   [0..2)  sunNdc     : vec2f  - the Sun's screen position
//   [2]     aspect     : f32    - viewport width / height
//   [3]     strength   : f32    - how much sunlight reaches the lens (occlusion x frame fade)
//   [4..)   elements   : array<Element, MAX_FLARE_ELEMENTS> (see flareLayout.ts)
//
// Every element is one instance of a screen-space quad drawn over the finished scene without any
// depth test: a lens flare happens inside the camera, so a planet in the picture never cuts a ghost
// off. Whether a body hides the Sun is decided before (strength), not per pixel.
export const flareShaderCode = /* wgsl */ `
struct Element {
  color: vec4f,
  shape: vec4f,  // t, size, shape code, blades
  style: vec4f,  // rotation, dispersion, softness, stretch
};

struct Flare {
  sunNdc: vec2f,
  aspect: f32,
  strength: f32,
  elements: array<Element, ${MAX_FLARE_ELEMENTS}>,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) ndc: vec2f,
  @location(2) @interpolate(flat) instance: u32,
};

const PI: f32 = 3.14159265;
const GLOW: u32 = 0u;
const STARBURST: u32 = 1u;
const STREAK: u32 = 2u;
const GHOST: u32 = 3u;
const RING: u32 = 4u;
const DIRT: u32 = 5u;

@group(0) @binding(0) var<uniform> flare: Flare;

fn shapeOf(element: Element) -> u32 {
  return u32(element.shape.z + 0.5);
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instance: u32) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let corner = corners[vertexIndex];
  let element = flare.elements[instance];
  let shape = shapeOf(element);
  // Room around the nominal shape for the dispersed (larger) red channel and soft edges, so no
  // shape is ever cut off by its quad.
  let padding = 1.0 + 2.0 * element.style.y + 3.0 * element.style.z;
  var center = flare.sunNdc * (1.0 - 2.0 * element.shape.x);
  var halfSize = vec2f(element.shape.y * 2.0 / flare.aspect, element.shape.y * 2.0) * padding;
  if (shape == STREAK) {
    halfSize.x = halfSize.x * element.style.w;
  }
  if (shape == DIRT) {
    center = vec2f(0.0);
    halfSize = vec2f(1.0);
  }
  var out: VertexOutput;
  out.position = vec4f(center + corner * halfSize, 0.0, 1.0);
  out.local = corner * padding;
  out.ndc = center + corner * halfSize;
  out.instance = instance;
  return out;
}

fn glow(p: vec2f) -> f32 {
  let falloff = max(1.0 - length(p), 0.0);
  return pow(falloff, 4.0) + 0.35 * pow(falloff, 1.5);
}

// Diffraction spikes from the aperture blades: an even blade count gives as many spikes.
fn starburst(p: vec2f, blades: f32, rotation: f32) -> f32 {
  let falloff = max(1.0 - length(p), 0.0);
  let angle = atan2(p.y, p.x) + rotation;
  let spikes = abs(cos(angle * blades * 0.5));
  return (pow(spikes, 60.0) + 0.25 * pow(spikes, 8.0)) * falloff * falloff;
}

// A thin horizontal line of light, tapering toward its ends, with a faint wider sheen.
fn streak(p: vec2f) -> f32 {
  let along = pow(max(1.0 - abs(p.x), 0.0), 2.5);
  return along * (exp(-p.y * p.y * 18.0) + 0.12 * exp(-p.y * p.y * 2.0));
}

// The aperture polygon (regular, in polar form), soft-edged and a little brighter toward its rim,
// like a real out-of-focus ghost.
fn ghost(p: vec2f, blades: f32, rotation: f32, softness: f32) -> f32 {
  let slice = 2.0 * PI / blades;
  let angle = atan2(p.y, p.x) + rotation;
  let inSlice = angle - slice * floor(angle / slice) - slice * 0.5;
  let r = length(p) * cos(inSlice) / cos(slice * 0.5);
  return smoothstep(1.0, 1.0 - max(softness, 0.01), r) * (0.55 + 0.45 * r);
}

fn ring(p: vec2f, width: f32) -> f32 {
  let offset = (length(p) - 1.0) / max(width, 0.01);
  return exp(-offset * offset);
}

fn shapeIntensity(element: Element, p: vec2f) -> f32 {
  switch shapeOf(element) {
    case GLOW: { return glow(p); }
    case STARBURST: { return starburst(p, element.shape.w, element.style.x); }
    case STREAK: { return streak(p); }
    case GHOST: { return ghost(p, element.shape.w, element.style.x, element.style.z); }
    case RING: { return ring(p, element.style.z); }
    default: { return 0.0; }
  }
}

fn hash2(p: vec2f) -> vec2f {
  return fract(sin(vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)))) * 43758.5453);
}

fn valueNoise(p: vec2f) -> f32 {
  let cell = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let bottom = mix(hash2(cell).x, hash2(cell + vec2f(1.0, 0.0)).x, u.x);
  let top = mix(hash2(cell + vec2f(0.0, 1.0)).x, hash2(cell + vec2f(1.0, 1.0)).x, u.x);
  return mix(bottom, top, u.y);
}

// Round dust specks: some grid cells hold one, at a random spot, size and brightness.
fn dust(p: vec2f) -> f32 {
  let cell = floor(p);
  var sum = 0.0;
  for (var y = -1.0; y <= 1.0; y += 1.0) {
    for (var x = -1.0; x <= 1.0; x += 1.0) {
      let neighbor = cell + vec2f(x, y);
      let h = hash2(neighbor);
      let radius = 0.08 + 0.22 * h.y;
      let present = step(0.6, fract(h.x * 7.31));
      let d = length(p - neighbor - h);
      sum += present * smoothstep(radius, radius * 0.2, d) * (0.35 + 0.65 * fract(h.y * 3.7));
    }
  }
  return sum;
}

// Soft, low-contrast smears from fingerprints and haze.
fn smudge(p: vec2f) -> f32 {
  let n = 0.5 * valueNoise(p) + 0.3 * valueNoise(p * 2.03 + 5.2) + 0.2 * valueNoise(p * 4.1 + 9.7);
  return smoothstep(0.45, 0.85, n);
}

// Dirt on the front lens element, only visible where the Sun lights it up.
fn lensDirt(ndc: vec2f) -> f32 {
  let p = vec2f(ndc.x * flare.aspect, ndc.y);
  let toSun = length((ndc - flare.sunNdc) * vec2f(flare.aspect, 1.0));
  return (0.8 * dust(p * 6.0) + 0.35 * smudge(p * 1.6)) * exp(-toSun * 2.0);
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let element = flare.elements[in.instance];
  var light: vec3f;
  if (shapeOf(element) == DIRT) {
    light = vec3f(lensDirt(in.ndc));
  } else {
    // Red is drawn slightly larger and blue slightly smaller: the colored fringes of a real lens.
    let dispersion = element.style.y;
    light = vec3f(
      shapeIntensity(element, in.local * (1.0 - dispersion)),
      shapeIntensity(element, in.local),
      shapeIntensity(element, in.local * (1.0 + dispersion)),
    );
  }
  return vec4f(element.color.rgb * light * flare.strength, 0.0);
}
`
