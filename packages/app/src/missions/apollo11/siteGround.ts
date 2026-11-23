import { mat4, vec3 } from 'gl-matrix'
import type { Vec3 } from '../../math/tuples'
import type { Apollo11Scene } from './apollo11Scene'
import type { TerrainTile } from './tranquilityTerrain'

// The ground round Tranquility Base as the metre pass draws it: where it is from the camera, how
// high things are over it, the sunlight's projection onto it (for shadows) and its terrain's files.

// The ground is drawn while the camera is within this of the site (km).
const GROUND_KM = 200

// How high a frame's origin (camera-relative m) is over the site's level.
export function heightOverPlane(world: mat4, { world: ground, up }: Ground): number {
  return (world[12] - ground[12]) * up[0] + (world[13] - ground[13]) * up[1] + (world[14] - ground[14]) * up[2]
}

// The projection along the sunlight onto the site's level, a few centimetres above it; null with the
// Sun under the horizon. x' = x - L (n·(x - p)) / (n·L), p the site, n up, L toward the Sun.
export function flattenOnto({ world: ground, up }: Ground, toSun: Vec3): mat4 | null {
  const nl = up[0] * toSun[0] + up[1] * toSun[1] + up[2] * toSun[2]
  if (nl < 0.02) return null
  const p: Vec3 = [ground[12] + up[0] * 0.05, ground[13] + up[1] * 0.05, ground[14] + up[2] * 0.05]
  const np = up[0] * p[0] + up[1] * p[1] + up[2] * p[2]
  const m = mat4.create()
  for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) m[col * 4 + row] = (row === col ? 1 : 0) - (toSun[row] * up[col]) / nl
  for (let row = 0; row < 3; row++) m[12 + row] = (toSun[row] * np) / nl
  return m
}

// How high the camera is over the ground's level (m): the site seen from the camera, along up.
export function heightOver({ world, up }: Ground): number {
  return Math.abs(world[12] * up[0] + world[13] * up[1] + world[14] * up[2])
}

export interface Ground {
  world: mat4
  up: Vec3
}

const TERRAIN_URL = 'data/apollo11/terrain'

// The terrain tile and its heights (null if they cannot be had: the plain cap then).
export const TERRAIN_FILES = TERRAIN_URL
export async function loadTerrain(): Promise<{ tile: TerrainTile; raw: Uint16Array } | null> {
  try {
    const [tile, heights] = await Promise.all([fetch(`${TERRAIN_URL}/tranquility.json`).then((r) => r.json() as Promise<TerrainTile>), fetch(`${TERRAIN_URL}/tranquility-heights.bin`).then((r) => r.arrayBuffer())])
    return { tile, raw: new Uint16Array(heights) }
  } catch (error) {
    console.warn('The Apollo 11 tour could not load Tranquility Base’s terrain.', error)
    return null
  }
}

// The ground round the site (in the Moon's axes, camera-relative metres), while the camera is near.
export function groundAt(scene: Apollo11Scene, cameraKm: Vec3): Ground | null {
  const site = scene.siteMoonFrameKm()
  if (!site) return null
  const axes = scene.moonAxesNow()
  const moon = scene.moonKm()
  const turned = vec3.transformMat4(vec3.create(), site, axes)
  const siteKm: Vec3 = [moon[0] + turned[0], moon[1] + turned[1], moon[2] + turned[2]]
  if (Math.hypot(siteKm[0] - cameraKm[0], siteKm[1] - cameraKm[1], siteKm[2] - cameraKm[2]) > GROUND_KM) return null
  const m = mat4.fromTranslation(mat4.create(), [(siteKm[0] - cameraKm[0]) * 1000, (siteKm[1] - cameraKm[1]) * 1000, (siteKm[2] - cameraKm[2]) * 1000])
  return { world: mat4.multiply(m, m, axes), up: scene.moonUpAt(siteKm) }
}

