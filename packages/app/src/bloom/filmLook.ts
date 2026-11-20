// A film look over the finished picture, for scenes that want one (a lesson inside a spacecraft):
// contact shadows in creases and corners (ambient occlusion from the depth buffer, `occlusion`
// strong, looking `reach` metres around), the corners darkened (vignette), a fine grain moving from
// frame to frame, and a grade - a little warmer, a little less saturated, the blacks lifted a
// touch. All 0: the picture as it is.
export interface FilmLook {
  vignette: number
  grain: number
  grade: number
  occlusion: number
  reach: number
}

export const NO_FILM_LOOK: FilmLook = { vignette: 0, grain: 0, grade: 0, occlusion: 0, reach: 0 }

// What the occlusion needs to know about the camera this frame: the projection's z terms (to turn a
// depth back into a distance) and how many pixels a metre spans at one metre's distance.
export interface FilmCamera {
  projection: ArrayLike<number>
  focalPixels: number
}

// The uniform block's floats (see FILM_LOOK_WGSL).
export function filmLookValues(look: FilmLook, seed: number, camera: FilmCamera): Float32Array<ArrayBuffer> {
  return Float32Array.from([look.vignette, look.grain, look.grade, seed % 1000, look.occlusion, look.reach, camera.projection[10], camera.projection[14], camera.focalPixels, 0, 0, 0])
}

export const FILM_LOOK_WGSL = /* wgsl */ `
struct FilmLook {
  // x: vignette, y: grain, z: grade, w: a seed that changes every frame (for the grain).
  strength: vec4f,
  // x: occlusion's strength, y: its reach (metres), z and w: the projection's z terms.
  occlusion: vec4f,
  // x: pixels per metre at one metre's distance.
  screen: vec4f,
}

// How far the surface at a pixel is from the camera (metres), from the depth buffer: the depth is
// (A z + B) / -z for a point at view-space z, with A and B the projection's z terms.
fn distanceAt(depthMap: texture_depth_multisampled_2d, pixel: vec2i, look: FilmLook) -> f32 {
  let depth = textureLoad(depthMap, pixel, 0);
  return look.occlusion.w / (depth + look.occlusion.z);
}

// How open the surface at a pixel is (1: open, less in a crease or corner): pairs of neighbours on
// opposite sides, in two rings; where their mean is nearer than the pixel, it sits in a hollow. A
// plane, however slanted, gives none; a neighbour far in front (an object before a wall) counts
// for nothing, so objects get no dark halo.
fn openness(depthMap: texture_depth_multisampled_2d, uv: vec2f, look: FilmLook) -> f32 {
  let size = vec2f(textureDimensions(depthMap));
  let pixel = vec2i(uv * size);
  let here = distanceAt(depthMap, pixel, look);
  let reach = look.occlusion.y;
  if (look.occlusion.x <= 0.0 || here > 1000.0) { return 1.0; }
  let radius = clamp(reach * look.screen.x / here, 2.0, 48.0);
  let turn = grain(uv, 0.0) * 6.2832;
  var hollow = 0.0;
  for (var i = 0; i < 8; i++) {
    let angle = turn + f32(i) * 0.3927;
    let offset = vec2f(cos(angle), sin(angle)) * radius * select(0.5, 1.0, i % 2 == 1);
    let a = distanceAt(depthMap, clamp(pixel + vec2i(offset), vec2i(0), vec2i(size) - 1), look);
    let b = distanceAt(depthMap, clamp(pixel - vec2i(offset), vec2i(0), vec2i(size) - 1), look);
    let depth = here - (a + b) * 0.5;
    hollow += smoothstep(0.0, reach * 0.5, depth) * (1.0 - smoothstep(reach, reach * 3.0, depth));
  }
  return 1.0 - look.occlusion.x * hollow / 8.0;
}

fn grain(uv: vec2f, seed: f32) -> f32 {
  return fract(sin(dot(uv * 1000.0 + vec2f(seed, seed * 1.7), vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
}

// On display-encoded colour (after tonemapping).
fn filmLook(color: vec3f, uv: vec2f, look: FilmLook) -> vec3f {
  let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));
  let graded = (mix(vec3f(luminance), color, 0.82) * vec3f(1.04, 1.0, 0.93)) * 0.96 + vec3f(0.025, 0.022, 0.02);
  var result = mix(color, graded, look.strength.z);
  let fromMiddle = length((uv - vec2f(0.5)) * vec2f(1.0, 0.8)) * 1.4;
  result *= 1.0 - look.strength.x * smoothstep(0.35, 1.0, fromMiddle);
  result += grain(uv, look.strength.w) * look.strength.y;
  return clamp(result, vec3f(0.0), vec3f(1.0));
}
`
