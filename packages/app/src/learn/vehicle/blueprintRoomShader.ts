// The vehicle lessons' room: an open blueprint box - a floor, a wall on the left and one behind,
// the rest open onto black. Each face carries a drawing's grid in metres (a fine line every few
// metres, a stronger one at a multiple, both set per room) and, on the walls, the heights worth
// marking as accent lines. A soft
// spotlight on the rocket's foot darkens the faces toward their edges, and the corners where they
// meet are a shade darker still, so the box reads as a space. A full-screen pass paints the black
// first, over the sky.

export const BLUEPRINT_UNIFORM_FLOAT_COUNT = 28
// Per vertex: position (metres), and its place on the face's grid (metres across, metres up).
export const BLUEPRINT_VERTEX_FLOATS = 5

export const blueprintRoomShaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4f,
  // xyz: the camera; w: how far the floor reaches from the axis (the walls stand at -w).
  eye: vec4f,
  // Up to four heights marked on the walls (metres; negative: none).
  marks: vec4f,
  // x: the fine grid's spacing, y: the strong one's (metres), z: the spotlight's height and w its
  // reach - both scaled to the room.
  grid: vec4f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

struct BlackOutput {
  @builtin(position) position: vec4f,
}

@vertex
fn vsBlack(@builtin(vertex_index) vertexIndex: u32) -> BlackOutput {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: BlackOutput;
  out.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  return out;
}

@fragment
fn fsBlack() -> @location(0) vec4f {
  return vec4f(0.0, 0.0, 0.0, 1.0);
}

struct RoomOutput {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) grid: vec2f,
}

@vertex
fn vsRoom(@location(0) position: vec3f, @location(1) grid: vec2f) -> RoomOutput {
  var out: RoomOutput;
  out.clip = uni.viewProjection * vec4f(position, 1.0);
  out.world = position;
  out.grid = grid;
  return out;
}

const PAPER = vec3f(0.045, 0.12, 0.22);
// How dark the spotlight's edge is, and the corners where two faces meet (the corners' shade
// reaches a third of the spotlight's height).
const SPOT_EDGE = 0.28;
const CORNER_SHADE = 0.55;

// The spotlight: full in its middle, falling off smoothly toward the room's edges.
fn spotlight(world: vec3f) -> f32 {
  let offset = (world - vec3f(0.0, uni.grid.z, 0.0)) / uni.grid.w;
  return mix(SPOT_EDGE, 1.0, exp(-dot(offset, offset)));
}

// The shade in the corners: how near this point is to the face it meets (on the floor, the walls'
// feet; on a wall, the floor and the other wall). Grid places start at -halfWidth along each wall.
fn cornerLight(world: vec3f, grid: vec2f) -> f32 {
  let halfWidth = uni.eye.w;
  let onFloor = world.y < 0.01;
  let nearest = select(min(world.y, grid.x + halfWidth), min(grid.x, grid.y) + halfWidth, onFloor);
  return mix(CORNER_SHADE, 1.0, smoothstep(0.0, uni.grid.z / 2.0, nearest));
}
const INK = vec3f(0.55, 0.75, 1.0);
const ACCENT = vec3f(1.0, 0.72, 0.35);

// How much of a line every \`spacing\` metres covers this pixel (antialiased by its footprint).
fn gridLine(coordinate: f32, spacing: f32, width: f32) -> f32 {
  let distance = abs(fract(coordinate / spacing + 0.5) - 0.5) * spacing;
  let footprint = max(fwidth(coordinate), 1e-4);
  return 1.0 - smoothstep(width * footprint, (width + 1.0) * footprint, distance);
}

// A single line at \`at\` (none for a negative height).
fn markLine(coordinate: f32, at: f32) -> f32 {
  let footprint = max(fwidth(coordinate), 1e-4);
  return select(0.0, 1.0 - smoothstep(1.2 * footprint, 2.2 * footprint, abs(coordinate - at)), at >= 0.0);
}

@fragment
fn fsRoom(in: RoomOutput) -> @location(0) vec4f {
  let minor = max(gridLine(in.grid.x, uni.grid.x, 0.5), gridLine(in.grid.y, uni.grid.x, 0.5));
  let major = max(gridLine(in.grid.x, uni.grid.y, 0.9), gridLine(in.grid.y, uni.grid.y, 0.9));
  let height = in.grid.y;
  let marked = max(max(markLine(height, uni.marks.x), markLine(height, uni.marks.y)), max(markLine(height, uni.marks.z), markLine(height, uni.marks.w)));
  // The floor's grid is level: no height marks on it.
  let onWall = select(0.0, 1.0, abs(in.world.y - height) < 0.01 && in.world.y > 0.05);
  // Far lines thin out into the paper instead of a grey moiré.
  let distance = length(in.world - uni.eye.xyz);
  let fade = clamp(1.0 - (distance - 4.0 * uni.grid.w) / (12.0 * uni.grid.w), 0.25, 1.0);
  var color = mix(PAPER, INK, (0.10 * minor + 0.24 * major) * fade);
  color *= spotlight(in.world) * cornerLight(in.world, in.grid);
  // The height marks glow on their own, unshaded.
  color = mix(color, ACCENT, 0.75 * marked * onWall);
  return vec4f(color, 1.0);
}
`
