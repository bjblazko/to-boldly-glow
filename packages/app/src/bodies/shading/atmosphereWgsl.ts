// What a body's atmosphere adds to its surface: the glow of sunlight scattered at its limb, and the
// colored light of twilight along the terminator. Part of the lit body shader (see
// litBodyShader.ts), which declares the uniforms these read.
export const atmosphereWgsl = /* wgsl */ `
// Atmospheric rim/limb glow: a Fresnel term (brightest where the surface normal is near-
// perpendicular to the camera, i.e. right at the silhouette edge) approximating how sunlight
// scatters through a thin shell of atmosphere seen edge-on. atmosphereParams.a is 0 for bodies
// with no substantial real atmosphere, making this a no-op for them. Dimmed with the surface's own
// sunlight during an eclipse, and faded out toward the night limb rather than wrapping all the way
// around the silhouette.
fn rimGlow(normal: vec3f, toLight: vec3f, toCamera: vec3f, sunlight: f32) -> vec3f {
  let rimFactor = pow(1.0 - max(dot(normal, toCamera), 0.0), 3.0);
  let sunFacingGate = smoothstep(-0.1, 0.3, dot(normal, toLight));
  return uni.atmosphereParams.rgb * rimFactor * uni.atmosphereParams.a * sunFacingGate * sunlight;
}

// The color of the sunlight reaching the ground: near the terminator it crosses a long path of air
// and arrives reddened (on Mars, whose fine dust scatters red away, bluish).
fn sunlightColor(geometricNormal: vec3f, toLight: vec3f) -> vec3f {
  let incidence = dot(geometricNormal, toLight);
  let twilight = smoothstep(-0.08, 0.02, incidence) * (1.0 - smoothstep(0.02, 0.16, incidence));
  return mix(vec3f(1.0), uni.twilight.rgb, twilight * uni.twilight.a);
}

// Just past the terminator the sky still glows: a faint band of twilight on the night side.
fn twilightGlow(geometricNormal: vec3f, toLight: vec3f, sunlight: f32) -> vec3f {
  let incidence = dot(geometricNormal, toLight);
  let band = smoothstep(-0.2, -0.03, incidence) * (1.0 - smoothstep(-0.03, 0.05, incidence));
  return uni.twilight.rgb * uni.twilight.a * band * 0.1 * sunlight;
}
`
