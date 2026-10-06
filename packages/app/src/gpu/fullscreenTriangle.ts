// Shared vertex stage for every fullscreen pass (bloom, mipmap generation): the standard "one big triangle"
// trick — 3 vertices, no vertex buffer, covering the whole viewport with a single triangle whose
// corners lie outside the [-1,1] clip range on two sides. Cheaper than two triangles (a quad)
// since it avoids a diagonal seam and redundant fragment work along it. uv is derived from clip
// position and flipped in Y so v=0 lands at the top of the texture, matching how the HDR/bloom
// render targets are written (clip-space +Y is up; texture V convention is top-down).
export const FULLSCREEN_TRIANGLE_VERTEX_WGSL = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let pos = positions[vertexIndex];
  var out: VertexOutput;
  out.position = vec4f(pos, 0.0, 1.0);
  out.uv = vec2f((pos.x + 1.0) * 0.5, 1.0 - (pos.y + 1.0) * 0.5);
  return out;
}
`
