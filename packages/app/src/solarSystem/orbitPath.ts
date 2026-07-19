import { sphericalToX, sphericalToY, sphericalToZ } from '@toboldlyglow/engine'
import type { BodyDefinition } from './bodies'
import { scaledPosition } from './sceneScale'

const ORBIT_PATH_SEGMENTS = 128
const DAYS_PER_JULIAN_MILLENNIUM = 365_250

// Samples one full sidereal orbit at evenly spaced time steps (not evenly spaced angles) and
// returns a closed line-strip: point 0 and the last point are both T=0 through T=period, so
// drawing this with topology 'line-strip' produces a fully closed loop.
export function generateOrbitPathPositions(planet: BodyDefinition, blend: number): Float32Array {
  const position = planet.position
  if (!position || planet.siderealPeriodDays === null) {
    throw new Error(`${planet.id} has no orbital position/period data for an orbit path.`)
  }
  const points = new Float32Array((ORBIT_PATH_SEGMENTS + 1) * 3)
  for (let i = 0; i <= ORBIT_PATH_SEGMENTS; i++) {
    const days = (i / ORBIT_PATH_SEGMENTS) * planet.siderealPeriodDays
    const T = days / DAYS_PER_JULIAN_MILLENNIUM
    const longitude = position.longitude(T)
    const latitude = position.latitude(T)
    const distanceAu = position.distance(T)
    const x = sphericalToX(longitude, latitude, distanceAu)
    const y = sphericalToY(longitude, latitude, distanceAu)
    const z = sphericalToZ(longitude, latitude, distanceAu)
    const [sx, sy, sz] = scaledPosition(x, y, z, distanceAu, blend)
    points[i * 3] = sx
    points[i * 3 + 1] = sy
    points[i * 3 + 2] = sz
  }
  return points
}
