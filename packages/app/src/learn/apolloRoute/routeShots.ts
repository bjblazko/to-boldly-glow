import type { Vec3 } from '../../math/tuples'
import { ECLIPTIC_NORTH } from '../../solarSystem/poleOrientation'
import type { LessonShot } from '../lessonShot'
import { MOON_DISTANCE, ROUTE_EARTH, ROUTE_MOON, TOWARD_MOON } from './routeGeometry'
import type { ApolloRouteStage, ApolloRouteView } from './routeStage'

const UP: Vec3 = [...ECLIPTIC_NORTH]
// The camera stands on the side the craft leaves Earth from, looking across the Earth-Moon line,
// so Earth is on the left and the Moon on the right (azimuth in the orbit camera's basis for an
// up of +Z: forward +X, right +Y).
const AZIMUTH = Math.atan2(-TOWARD_MOON[0], TOWARD_MOON[1])
const MIDDLE: Vec3 = [(ROUTE_EARTH[0] + ROUTE_MOON[0]) / 2, (ROUTE_EARTH[1] + ROUTE_MOON[1]) / 2, 0]

const SHOTS: Record<ApolloRouteView, Omit<LessonShot, 'key'>> = {
  whole: {
    preset: { target: MIDDLE, radius: 48, azimuth: AZIMUTH, elevation: 0.95, upAxis: UP },
    bounds: { top: 6, bottom: -6, halfWidth: MOON_DISTANCE / 2 + 3 },
    maxZoomOut: 1.6,
  },
  earth: {
    preset: { target: ROUTE_EARTH, radius: 14, azimuth: AZIMUTH, elevation: 0.7, upAxis: UP },
    bounds: { top: 3.4, bottom: -3.4, halfWidth: 4 },
    maxZoomOut: 3,
    zoomFloor: 4,
  },
  moon: {
    preset: { target: ROUTE_MOON, radius: 5, azimuth: AZIMUTH, elevation: 0.7, upAxis: UP },
    bounds: { top: 1.3, bottom: -1.3, halfWidth: 1.6 },
    maxZoomOut: 6,
    zoomFloor: 1.4,
  },
}

// A chapter's camera shot: the whole route, or close to Earth or the Moon.
export function apolloRouteShot(stage: ApolloRouteStage): LessonShot {
  return { key: `apollo-${stage.view}`, ...SHOTS[stage.view] }
}
