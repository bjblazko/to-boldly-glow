import { vec3 } from 'gl-matrix'
import { worldViewProjection, type Viewpoint } from '../camera/viewpoint'
import { bodyWorldMatrix, type SunPose } from '../scene/sceneLayout'
import { SUN } from '../solarSystem/bodies'
import { SUN_UNIFORM_FLOAT_COUNT } from './sunShader'

const SECONDS_PER_DAY = 86_400
// A granule lives about ten minutes, from boiling up to dissolving again.
const GRANULE_LIFETIME_SECONDS = 600
// In white light the granulation's brightness varies by about 12% (rms) between the bright
// granules and the dark lanes around them.
const GRANULATION_CONTRAST = 0.12
// Seeds repeat after this many generations of granules - more than ten hours apart.
const GENERATION_SEEDS = 64
// How much of the picture the Sun covers where the camera starts stopping down for it, and where it
// reaches the exposure of a solar filter.
const STOP_DOWN_FROM_COVERAGE = 0.15
const FULLY_STOPPED_DOWN_COVERAGE = 0.6
// The grid of points across the screen the Sun's coverage is counted on.
const COVERAGE_GRID_COLUMNS = 32
const COVERAGE_GRID_ROWS = 18

export type GranulationParams = [seedA: number, seedB: number, phase: number, contrast: number]

// Writes the Sun's uniforms for one frame (see sunShader.ts). It remembers the previous frame's
// moment: when the clock runs so fast that granules come and go within a single frame, a camera
// would only see their average, so the pattern fades out instead of flickering.
export class SunSurface {
  private previousDays: number | null = null

  uniforms(sun: SunPose, viewpoint: Viewpoint, frame: { brightness: number; daysSinceEpoch: number }): Float32Array<ArrayBuffer> {
    const world = bodyWorldMatrix(sun)
    const uniforms = new Float32Array(SUN_UNIFORM_FLOAT_COUNT)
    uniforms.set(worldViewProjection(viewpoint, world), 0)
    uniforms.set(world, 16)
    const brightness = closeUpBrightness(frame.brightness, sunScreenCoverage(sun, viewpoint))
    uniforms.set([...SUN.color.map((channel) => channel * brightness), 1.0], 32)
    uniforms.set([...viewpoint.position, 0], 36)
    uniforms.set(this.granulation(frame.daysSinceEpoch), 40)
    return uniforms
  }

  private granulation(daysSinceEpoch: number): GranulationParams {
    const exposureSeconds = this.previousDays === null ? 0 : Math.abs(daysSinceEpoch - this.previousDays) * SECONDS_PER_DAY
    this.previousDays = daysSinceEpoch
    return granulationAt(daysSinceEpoch * SECONDS_PER_DAY, exposureSeconds)
  }
}

// Two generations of granules, half a lifetime apart. The shader weighs generation A by
// cos²(π·phase) and B by sin²(π·phase), so each takes its next seed exactly when its weight is zero:
// A at phase 0.5, B at phase 0. Computed here in double precision - seconds since J2000 are far too
// large for the shader's 32-bit floats to resolve a minute.
export function granulationAt(seconds: number, exposureSeconds: number): GranulationParams {
  const generations = seconds / GRANULE_LIFETIME_SECONDS
  const phase = generations - Math.floor(generations)
  const seedA = positiveModulo(Math.floor(generations + 0.5), GENERATION_SEEDS)
  const seedB = positiveModulo(Math.floor(generations), GENERATION_SEEDS)
  const blur = smoothstep(0.05, 0.5, exposureSeconds / GRANULE_LIFETIME_SECONDS)
  return [seedA, seedB, phase, GRANULATION_CONTRAST * (1 - blur)]
}

// Far away the Sun is over-bright on purpose, so it blooms. Close up that would burn its whole
// surface out to white, so as the Sun fills the picture the camera stops down - like a solar
// filter - until the surface sits in the picture's normal brightness range and its limb darkening
// and granulation show.
export function closeUpBrightness(brightness: number, coverage: number): number {
  const stoppedDown = smoothstep(STOP_DOWN_FROM_COVERAGE, FULLY_STOPPED_DOWN_COVERAGE, coverage)
  return Math.min(brightness, brightness ** (1 - stoppedDown))
}

// How much of the picture the Sun covers (0-1): the share of a coarse grid of view rays across the
// screen that hit it. Exact for a Sun anywhere in or around the view, however close.
export function sunScreenCoverage(sun: SunPose, viewpoint: Viewpoint): number {
  const center = vec3.transformMat4(vec3.create(), sun.position, viewpoint.view)
  const distance = vec3.length(center)
  if (distance <= sun.radius) return 1
  vec3.scale(center, center, 1 / distance)
  const cosAngularRadius = Math.cos(Math.asin(sun.radius / distance))
  // A pixel's view ray at normalized device coordinates (x, y) runs through view-space point
  // ((x + p[8]) / p[0], (y + p[9]) / p[5], -1) - p[9] being a lesson's lens shift.
  const p = viewpoint.projection
  let covered = 0
  for (let row = 0; row < COVERAGE_GRID_ROWS; row++) {
    const rayY = (((row + 0.5) / COVERAGE_GRID_ROWS) * 2 - 1 + p[9]) / p[5]
    for (let column = 0; column < COVERAGE_GRID_COLUMNS; column++) {
      const rayX = (((column + 0.5) / COVERAGE_GRID_COLUMNS) * 2 - 1 + p[8]) / p[0]
      if ((rayX * center[0] + rayY * center[1] - center[2]) / Math.hypot(rayX, rayY, 1) > cosAngularRadius) covered++
    }
  }
  return covered / (COVERAGE_GRID_ROWS * COVERAGE_GRID_COLUMNS)
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
