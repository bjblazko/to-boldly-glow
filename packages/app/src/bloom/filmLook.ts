// A film look over the finished picture, for scenes that want one (a lesson inside a spacecraft):
// the corners darkened (vignette), a fine grain moving from frame to frame, and a grade - a little
// warmer, a little less saturated, the blacks lifted a touch. All 0: the picture as it is.
export interface FilmLook {
  vignette: number
  grain: number
  grade: number
}

export const NO_FILM_LOOK: FilmLook = { vignette: 0, grain: 0, grade: 0 }

export const FILM_LOOK_WGSL = /* wgsl */ `
struct FilmLook {
  // x: vignette, y: grain, z: grade, w: a seed that changes every frame (for the grain).
  strength: vec4f,
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
