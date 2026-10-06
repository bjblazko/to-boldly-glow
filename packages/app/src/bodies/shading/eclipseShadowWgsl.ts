// How much of the Sun a point on a body's surface still sees: the soft shadows of moons and
// planets (eclipses and transits) and of Saturn's ring. Part of the lit body shader (see
// litBodyShader.ts), which declares the uniforms these functions read.
export const eclipseShadowWgsl = /* wgsl */ `
// Area of overlap between two circles of radii r1, r2 (same angular units, e.g. radians) whose
// centers are distance d apart. Used to turn "how much of the Sun's disc does this occluder cover"
// into a smooth [0,1] fraction rather than a hard binary in/out test.
fn circleOverlapArea(r1: f32, r2: f32, d: f32) -> f32 {
  if (d >= r1 + r2) {
    return 0.0;
  }
  let rmin = min(r1, r2);
  let rmax = max(r1, r2);
  if (d <= rmax - rmin) {
    return 3.14159265 * rmin * rmin;
  }
  let d1 = clamp((d * d + r1 * r1 - r2 * r2) / (2.0 * d * r1), -1.0, 1.0);
  let d2 = clamp((d * d + r2 * r2 - r1 * r1) / (2.0 * d * r2), -1.0, 1.0);
  let term1 = r1 * r1 * acos(d1);
  let term2 = r2 * r2 * acos(d2);
  let term3 = 0.5 * sqrt(max(0.0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  return term1 + term2 - term3;
}

// Fraction of the Sun's angular disc still visible from worldPos after accounting for up to 4
// occluding spheres (uni.occluders) plus, for Saturn, its own ring plane (uni.ringParams.yz). Soft
// rather than hard-binary: the Sun has a real angular radius at these distances (not a point
// source), so partial coverage fades smoothly instead of producing an unrealistically crisp
// terminator during a transit/eclipse. Feeds both the diffuse/specular terms below and (once added)
// the atmospheric rim glow, so a body's limb dims consistently with its shadowed surface.
fn sunVisibleFraction(worldPos: vec3f) -> f32 {
  let toSunVec = -worldPos; // the Sun always sits at the world origin
  let distanceToSun = length(toSunVec);
  if (distanceToSun < 1e-6) {
    return 1.0;
  }
  let toSunDir = toSunVec / distanceToSun;
  let sunRadius = uni.ringParams.x;
  let sunAngularRadius = asin(clamp(sunRadius / distanceToSun, 0.0, 1.0));
  let sunDiscArea = 3.14159265 * sunAngularRadius * sunAngularRadius;
  if (sunDiscArea < 1e-9) {
    return 1.0;
  }

  var visible = 1.0;
  for (var i = 0; i < 4; i = i + 1) {
    let occluder = uni.occluders[i];
    let occluderRadius = occluder.w;
    if (occluderRadius <= 0.0) {
      continue;
    }
    let toOccluder = occluder.xyz - worldPos;
    let distanceToOccluder = length(toOccluder);
    if (distanceToOccluder < 1e-6) {
      continue;
    }
    let occluderDir = toOccluder / distanceToOccluder;
    let occluderAngularRadius = asin(clamp(occluderRadius / distanceToOccluder, 0.0, 1.0));
    let angularSeparation = acos(clamp(dot(toSunDir, occluderDir), -1.0, 1.0));
    let overlap = circleOverlapArea(sunAngularRadius, occluderAngularRadius, angularSeparation);
    visible = min(visible, 1.0 - overlap / sunDiscArea);
  }

  // Saturn-only ring-plane shadow: ray-plane intersect the fragment-to-Sun ray against the ring's
  // plane (through this body's own center; normal derived from its world matrix — the same trick
  // ringShaderCode uses for its own normal). A flat partial-opacity band with a soft edge, not a
  // sample of the ring texture's real per-radius alpha — a deliberate simplification that doesn't
  // reproduce the Cassini Division gap. ringParams.y/.z are 0 for every non-Saturn body, so
  // ringOuter > ringInner is false and this whole block is a no-op everywhere else.
  let ringInner = uni.ringParams.y;
  let ringOuter = uni.ringParams.z;
  if (ringOuter > ringInner) {
    // Local +Z, matching the ring mesh's actual flat plane (saturnRing/ringMesh.ts generates it flat in
    // the local XY plane, normal local +Z) - NOT local Y, which was this test's original (wrong)
    // axis, copied from ringShaderCode's own same mistake below (now also fixed). The wrong axis
    // put the shadow-casting plane 90 degrees off from the ring's real plane.
    let ringNormal = normalize((uni.world * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
    let ringCenter = uni.world[3].xyz;
    let denom = dot(toSunDir, ringNormal);
    if (abs(denom) > 1e-4) {
      let t = dot(ringCenter - worldPos, ringNormal) / denom;
      if (t > 0.0) {
        let hit = worldPos + toSunDir * t;
        let hitDistance = length(hit - ringCenter);
        let edgeSoftness = (ringOuter - ringInner) * 0.05;
        let inside = smoothstep(ringInner - edgeSoftness, ringInner + edgeSoftness, hitDistance)
          * (1.0 - smoothstep(ringOuter - edgeSoftness, ringOuter + edgeSoftness, hitDistance));
        visible = min(visible, 1.0 - inside * 0.85);
      }
    }
  }

  return clamp(visible, 0.0, 1.0);
}
`
