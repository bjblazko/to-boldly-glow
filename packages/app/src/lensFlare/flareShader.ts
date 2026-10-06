import { MAX_FLARE_ELEMENTS } from './flareLayout'

// Uniform layout (packed by lensFlare.ts and flareLayout.ts):
//   [0..2)  sunNdc     : vec2f  - the Sun's screen position
//   [2]     aspect     : f32    - viewport width / height
//   [3]     strength   : f32    - how much sunlight reaches the lens (occlusion x frame fade)
//   [4..)   elements   : array<Element, MAX_FLARE_ELEMENTS> (see flareLayout.ts)
//
// Every element is one instance of a screen-space quad, drawn onto the finished scene image in the
// camera-effects pass (no depth buffer): a lens flare happens inside the camera, so a planet in the
// picture never cuts a ghost off. Whether a body hides the Sun is decided before (strength), not
// per pixel. Software renderers (CI) draw this pixel by pixel, so quads are kept tight and each
// shape's geometry is computed once per pixel, however many color channels it spreads into.
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

// Room around the nominal shape for the dispersed (larger) red channel, and for a ring's soft
// falloff past its radius. Every other shape ends at its edge, so its quad needs no more.
fn quadPadding(element: Element, shape: u32) -> f32 {
  var padding = 1.0 + 2.0 * element.style.y;
  if (shape == RING) {
    padding += 3.0 * element.style.z;
  }
  return padding;
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instance: u32) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let corner = corners[vertexIndex];
  let element = flare.elements[instance];
  let shape = shapeOf(element);
  let padding = quadPadding(element, shape);
  let center = flare.sunNdc * (1.0 - 2.0 * element.shape.x);
  var halfSize = vec2f(element.shape.y * 2.0 / flare.aspect, element.shape.y * 2.0) * padding;
  if (shape == STREAK) {
    halfSize.x = halfSize.x * element.style.w;
  }
  var out: VertexOutput;
  out.position = vec4f(center + corner * halfSize, 0.0, 1.0);
  out.local = corner * padding;
  out.ndc = center + corner * halfSize;
  out.instance = instance;
  return out;
}

// Red is drawn slightly larger and blue slightly smaller - the colored fringes of a real lens - by
// reading the shape's radial profile at a scaled radius per channel.
fn dispersed(radius: f32, dispersion: f32) -> vec3f {
  return radius * vec3f(1.0 - dispersion, 1.0, 1.0 + dispersion);
}

fn glow(radius: vec3f) -> vec3f {
  let falloff = max(1.0 - radius, vec3f(0.0));
  return pow(falloff, vec3f(4.0)) + 0.35 * pow(falloff, vec3f(1.5));
}

// Diffraction spikes from the aperture blades: an even blade count gives as many spikes.
fn starburst(p: vec2f, element: Element) -> vec3f {
  let angle = atan2(p.y, p.x) + element.style.x;
  let spikes = abs(cos(angle * element.shape.w * 0.5));
  let falloff = max(1.0 - dispersed(length(p), element.style.y), vec3f(0.0));
  return (pow(spikes, 60.0) + 0.25 * pow(spikes, 8.0)) * falloff * falloff;
}

// A thin horizontal line of light, tapering toward its ends, with a faint wider sheen.
fn streak(p: vec2f) -> f32 {
  let along = pow(max(1.0 - abs(p.x), 0.0), 2.5);
  return along * (exp(-p.y * p.y * 18.0) + 0.12 * exp(-p.y * p.y * 2.0));
}

// The distance from the center in units of the aperture polygon's own radius (regular polygon, in
// polar form): 1 on its edge.
fn polygonRadius(p: vec2f, blades: f32, rotation: f32) -> f32 {
  let slice = 2.0 * PI / blades;
  let angle = atan2(p.y, p.x) + rotation;
  let inSlice = angle - slice * floor(angle / slice) - slice * 0.5;
  return length(p) * cos(inSlice) / cos(slice * 0.5);
}

// The aperture polygon, soft-edged and a little brighter toward its rim, like a real out-of-focus
// ghost.
fn ghost(radius: vec3f, softness: f32) -> vec3f {
  return smoothstep(vec3f(1.0), vec3f(1.0 - max(softness, 0.01)), radius) * (0.55 + 0.45 * radius);
}

fn ring(radius: vec3f, width: f32) -> vec3f {
  let offset = (radius - 1.0) / max(width, 0.01);
  return exp(-offset * offset);
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

// Round dust specks: some grid cells hold one, at a random spot, size and brightness - always
// inside its own cell, so a pixel only has to look at the cell it is in.
fn dust(p: vec2f) -> f32 {
  let cell = floor(p);
  let h = hash2(cell);
  let radius = 0.08 + 0.17 * fract(h.y * 5.3);
  let speck = cell + 0.25 + 0.5 * h;
  let present = step(0.6, fract(h.x * 7.31));
  return present * smoothstep(radius, radius * 0.2, length(p - speck)) * (0.35 + 0.65 * fract(h.y * 3.7));
}

// Soft, low-contrast smears from fingerprints and haze.
fn smudge(p: vec2f) -> f32 {
  let n = 0.6 * valueNoise(p) + 0.4 * valueNoise(p * 2.03 + 5.2);
  return smoothstep(0.45, 0.85, n);
}

// Dirt on the front lens element (fixed on the lens, so it doesn't move with the Sun), only
// visible around the Sun, which lights it up: brightest at the quad's center, gone at its edge.
fn lensDirt(ndc: vec2f, reach: f32) -> f32 {
  let p = vec2f(ndc.x * flare.aspect, ndc.y);
  return (0.8 * dust(p * 6.0) + 0.35 * smudge(p * 1.6)) * exp(-3.0 * reach) * smoothstep(1.0, 0.6, reach);
}

fn elementLight(element: Element, p: vec2f, ndc: vec2f) -> vec3f {
  switch shapeOf(element) {
    case STARBURST: { return starburst(p, element); }
    case STREAK: { return vec3f(streak(p)); }
    case GHOST: { return ghost(dispersed(polygonRadius(p, element.shape.w, element.style.x), element.style.y), element.style.z); }
    case RING: { return ring(dispersed(length(p), element.style.y), element.style.z); }
    case DIRT: { return vec3f(lensDirt(ndc, length(p))); }
    default: { return glow(dispersed(length(p), element.style.y)); }
  }
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let element = flare.elements[in.instance];
  return vec4f(element.color.rgb * elementLight(element, in.local, in.ndc) * flare.strength, 0.0);
}
`
