import { mat4 } from 'gl-matrix'
import type { BodyDefinition } from '../solarSystem/bodies'
import type { MoonDefinition } from '../solarSystem/moons'
import type { Rgba, Vec3 } from '../math/tuples'

// Where each visible body is in this frame, and how it is oriented - computed once per frame by the
// explore view (real orbits) or by the active lesson (its staged scene), then drawn, labelled and
// used for lens-flare occlusion alike. Bodies a scene doesn't show are simply absent.
export interface SceneLayout {
  sun: SunPose
  planets: PlanetPose[]
  moons: MoonPose[]
  // The sizes lesson's lineup is about the names: show body labels even when they're switched off.
  alwaysShowBodyLabels?: boolean
}

export interface BodyPose {
  position: Vec3
  radius: number
  // Aligns the body's local +Z with its spin axis (planets, Sun) or with its orbital plane's normal
  // (moons - tidally locked, so the same tilt orients both their orbit and their spin).
  tilt: mat4
  spinRadians: number
}

export type SunPose = BodyPose

export interface PlanetPose extends BodyPose {
  definition: BodyDefinition
  poleDirection: Vec3
  // The seasons lesson washes the hemisphere tilted toward the Sun in a warm tint, the other in a cool one.
  hemisphereTints?: { north: Rgba; south: Rgba }
}

export interface MoonPose extends BodyPose {
  definition: MoonDefinition
  parent: PlanetPose
  // The Moon phases lesson lights the Moon's night side with sunlight reflected off Earth.
  earthshine?: number
}

// translation * (tilt * (spin * scale)) - the composition order every body has always used.
export function bodyWorldMatrix(pose: BodyPose, radius = pose.radius): mat4 {
  const spunAndScaled = mat4.multiply(
    mat4.create(),
    mat4.fromZRotation(mat4.create(), pose.spinRadians),
    mat4.fromScaling(mat4.create(), [radius, radius, radius]),
  )
  return mat4.multiply(mat4.create(), mat4.fromTranslation(mat4.create(), pose.position), mat4.multiply(mat4.create(), pose.tilt, spunAndScaled))
}

// The ring (and the lessons' overlay lines) follow the body's tilt but not its spin.
export function tiltedFrameMatrix(pose: BodyPose, scale = 1): mat4 {
  return mat4.multiply(
    mat4.create(),
    mat4.fromTranslation(mat4.create(), pose.position),
    mat4.multiply(mat4.create(), pose.tilt, mat4.fromScaling(mat4.create(), [scale, scale, scale])),
  )
}

export function findPlanet(layout: SceneLayout, id: string): PlanetPose | undefined {
  return layout.planets.find((planet) => planet.definition.id === id)
}
