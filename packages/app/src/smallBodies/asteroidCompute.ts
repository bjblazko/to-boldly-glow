// Uniform layout of both compute passes (must match asteroidBelt.ts):
//   [0..4)  orbitClock     : vec4f (x = days since J2000, y = scale blend, z = scene units per AU at
//                            Realistic scale, w = Compact scale's log1p distance factor)
//   [4..8)  cameraPosition : vec4f (xyz; w = number of asteroids)
//   [8..12) sizing         : vec4f (x = scene units per km at Realistic scale, y = Compact size per
//                            sqrt(km), z = CSS pixels per radian, w = scale blend)
export const ASTEROID_COMPUTE_UNIFORM_FLOAT_COUNT = 12

export const ASTEROID_WORKGROUP_SIZE = 64

// An asteroid at least this big on screen (radius, CSS pixels) is drawn as a rock; smaller ones as
// a point of light.
export const ROCK_MIN_RADIUS_PX = 1

const SHARED = /* wgsl */ `
struct Uniforms {
  orbitClock: vec4f,
  cameraPosition: vec4f,
  sizing: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
// Two vec4s per asteroid: (a, e, inclination, node), (argument of perihelion, mean anomaly at
// J2000, radius km, color).
@group(0) @binding(1) var<storage, read> orbits: array<vec4f>;
`

// Where every asteroid is: one invocation per asteroid solves Kepler's equation for this moment and
// scales the position like sceneScale.ts scales the planets - thousands of bodies on their own real
// orbits at any time scale, with no per-frame CPU work. Runs only when the simulated time has moved
// on enough to see.
export const asteroidOrbitComputeCode = /* wgsl */ `
${SHARED}
// Per asteroid: scene position (xyz) and distance from the Sun in AU (w).
@group(0) @binding(2) var<storage, read_write> positions: array<vec4f>;

const TWO_PI: f32 = 6.2831853;
const GAUSSIAN_GRAVITATIONAL_CONSTANT: f32 = 0.01720209895;

fn orbitPosition(shape: vec4f, orientation: vec4f) -> vec3f {
  let a = shape.x;
  let e = shape.y;
  let meanMotion = GAUSSIAN_GRAVITATIONAL_CONSTANT / (a * sqrt(a));
  var meanAnomaly = orientation.y + meanMotion * uni.orbitClock.x;
  meanAnomaly = meanAnomaly - TWO_PI * floor(meanAnomaly / TWO_PI + 0.5);
  var E = meanAnomaly + e * sin(meanAnomaly);
  for (var iteration = 0; iteration < 5; iteration++) {
    E = E - (E - e * sin(E) - meanAnomaly) / (1.0 - e * cos(E));
  }
  let inPlane = vec2f(a * (cos(E) - e), a * sqrt(1.0 - e * e) * sin(E));
  let w = orientation.x;
  let atNode = vec2f(cos(w) * inPlane.x - sin(w) * inPlane.y, sin(w) * inPlane.x + cos(w) * inPlane.y);
  let ci = cos(shape.z);
  let node = shape.w;
  return vec3f(
    cos(node) * atNode.x - sin(node) * ci * atNode.y,
    sin(node) * atNode.x + cos(node) * ci * atNode.y,
    sin(shape.z) * atNode.y,
  );
}

@compute @workgroup_size(${ASTEROID_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= u32(uni.cameraPosition.w)) {
    return;
  }
  let au = orbitPosition(orbits[2u * index], orbits[2u * index + 1u]);
  let distanceAu = max(length(au), 1e-6);
  let realistic = distanceAu * uni.orbitClock.z;
  let compact = uni.orbitClock.w * log(1.0 + distanceAu);
  positions[index] = vec4f(au * (mix(realistic, compact, uni.orbitClock.y) / distanceAu), distanceAu);
}
`

// Which asteroids are close enough to be seen as rocks: every frame, each one checks its size on
// screen, and the few that are big enough append themselves (orbit record and position) to a list
// drawn with an indirect draw - so the many distant ones cost a single point each.
export const asteroidRockListComputeCode = /* wgsl */ `
${SHARED}
@group(0) @binding(2) var<storage, read> positions: array<vec4f>;

struct DrawArguments {
  vertexCount: u32,
  instanceCount: atomic<u32>,
  firstVertex: u32,
  firstInstance: u32,
};

@group(0) @binding(3) var<storage, read_write> drawArguments: DrawArguments;
// Two vec4s per rock: the orbit record's second half, and the position.
@group(0) @binding(4) var<storage, read_write> rocks: array<vec4f>;

fn screenRadiusPx(orientation: vec4f, placed: vec4f) -> f32 {
  let radiusKm = orientation.z;
  let realisticRadius = radiusKm * uni.sizing.x;
  let compactRadius = uni.sizing.y * sqrt(radiusKm);
  let radius = realisticRadius * pow(compactRadius / realisticRadius, uni.sizing.w);
  return radius / max(distance(uni.cameraPosition.xyz, placed.xyz), 1e-6) * uni.sizing.z;
}

@compute @workgroup_size(${ASTEROID_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= u32(uni.cameraPosition.w)) {
    return;
  }
  let orientation = orbits[2u * index + 1u];
  let placed = positions[index];
  if (screenRadiusPx(orientation, placed) < ${ROCK_MIN_RADIUS_PX.toFixed(1)}) {
    return;
  }
  let slot = atomicAdd(&drawArguments.instanceCount, 1u);
  rocks[2u * slot] = orientation;
  rocks[2u * slot + 1u] = placed;
}
`
