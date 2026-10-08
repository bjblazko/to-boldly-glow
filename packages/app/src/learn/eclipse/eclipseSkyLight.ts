import { vec3 } from 'gl-matrix'
import type { Viewpoint } from '../../camera/viewpoint'
import { clamp, smoothstep } from '../../math/tuples'
import type { SceneLayout } from '../../scene/sceneLayout'
import type { SkyLight } from '../ground/groundSky'
import { perpendicularUnit } from './eclipseGeometry'

// How bright the sky looks as the Moon covers the Sun. The eye adapts, so the light seems to fade
// far more slowly than the Sun's disc shrinks - until the last few percent are gone, when it falls
// away within seconds. Then the horizon glows all around.
const DAYLIGHT_EXPONENT = 0.4
const LAST_LIGHT_FRACTION = 0.02

export function eclipseSkyLight(sunVisibleFraction: number): SkyLight {
  const visible = clamp(sunVisibleFraction, 0, 1)
  const daylight = Math.pow(visible, DAYLIGHT_EXPONENT) * smoothstep(0, LAST_LIGHT_FRACTION, visible)
  return { daylight, glow: 1 - smoothstep(0, 0.3, daylight), glowSpread: 1, hidesStars: smoothstep(0, 0.3, daylight) }
}

// The diamond ring's glint shows while only the last sliver of the Sun is left.
export function diamondStrength(sunVisibleFraction: number): number {
  return smoothstep(0, 0.004, sunVisibleFraction) * (1 - smoothstep(0.02, 0.06, sunVisibleFraction))
}

// Where the last sliver is - on the Sun's edge right across from the Moon's center - and how
// brightly it glints.
export function diamondGlint(layout: SceneLayout, viewpoint: Viewpoint, sunVisibleFraction: number): [number, number, number, number] {
  const moon = layout.moons[0]
  const strength = diamondStrength(sunVisibleFraction)
  if (!moon || strength <= 0) return [0, 0, 0, 0]
  const eye = viewpoint.position
  const toSun = vec3.normalize(vec3.create(), vec3.negate(vec3.create(), eye))
  const toMoon = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), moon.position, eye))
  const awayFromMoon = perpendicularUnit(vec3.subtract(vec3.create(), toSun, toMoon), toSun)
  const sunAngularRadius = Math.asin(Math.min(1, layout.sun.radius / vec3.length(eye)))
  const glint = [0, 1, 2].map((i) => toSun[i] * Math.cos(sunAngularRadius) + awayFromMoon[i] * Math.sin(sunAngularRadius))
  return [glint[0], glint[1], glint[2], strength]
}
