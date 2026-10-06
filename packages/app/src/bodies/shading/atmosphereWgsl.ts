// What a body's atmosphere adds to its surface: the glow of sunlight scattered at its limb, and the
// color of the light reaching the ground along the terminator. (The twilight glow above the
// terminator is the atmosphere shell's, see atmosphereShell/.) Part of the lit body shader (see
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
  let incidence = dot(normal, toLight);
  let sunFacingGate = smoothstep(-0.1, 0.3, incidence);
  return uni.atmosphereParams.rgb * rimFactor * uni.atmosphereParams.a * sunFacingGate * sunlight + backlitGlow(rimFactor, incidence, toLight, toCamera) * sunlight;
}

// Seen against the Sun, the air at the limb scatters its light forward toward the camera: a bright
// ring around a backlit planet, reddened by its long path through the atmosphere (the twilight
// color, where the body has one).
fn backlitGlow(rimFactor: f32, incidence: f32, toLight: vec3f, toCamera: vec3f) -> vec3f {
  let towardSun = max(dot(-toCamera, toLight), 0.0);
  let reddened = mix(uni.atmosphereParams.rgb, uni.twilight.rgb, step(0.001, uni.twilight.a));
  return reddened * pow(towardSun, 6.0) * smoothstep(-0.25, 0.05, incidence) * rimFactor * uni.atmosphereParams.a * 3.0;
}

// The color of the sunlight reaching the ground: near the terminator it crosses a long path of air
// and arrives reddened (on Mars, whose fine dust scatters red away, bluish).
fn sunlightColor(geometricNormal: vec3f, toLight: vec3f) -> vec3f {
  let incidence = dot(geometricNormal, toLight);
  let twilight = smoothstep(-0.06, 0.0, incidence) * (1.0 - smoothstep(0.0, 0.07, incidence));
  return mix(vec3f(1.0), uni.twilight.rgb, twilight * uni.twilight.a);
}
`
