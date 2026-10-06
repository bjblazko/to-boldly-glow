import type { BodyDefinition } from '../solarSystem/bodies'
import { planetAuPosition } from '../solarSystem/entities'
import { scaledPosition, type AuPosition } from '../solarSystem/sceneScale'

const ORBIT_PATH_SEGMENTS = 128
const DAYS_PER_JULIAN_MILLENNIUM = 365_250

// Samples one full sidereal orbit at evenly spaced times (not angles), in true AU. Point 0 and the
// last point are T=0 and T=period, so drawn as a line strip the path closes on itself. Sampling is
// the expensive part (VSOP87 series), so callers keep the samples and only rescale them.
export function sampleOrbit(planet: BodyDefinition): AuPosition[] {
  if (planet.siderealPeriodDays === null) throw new Error(`${planet.id} has no orbital period for an orbit path.`)
  const periodDays = planet.siderealPeriodDays
  return Array.from({ length: ORBIT_PATH_SEGMENTS + 1 }, (_, i) =>
    planetAuPosition(planet, ((i / ORBIT_PATH_SEGMENTS) * periodDays) / DAYS_PER_JULIAN_MILLENNIUM),
  )
}

// The sampled orbit as a flat [x0, y0, z0, x1, ...] line strip in scene units for a scale blend.
export function scaleOrbitSamples(samples: AuPosition[], blend: number): Float32Array {
  return Float32Array.from(samples.flatMap((sample) => scaledPosition(sample, blend)))
}

export function generateOrbitPathPositions(planet: BodyDefinition, blend: number): Float32Array {
  return scaleOrbitSamples(sampleOrbit(planet), blend)
}
