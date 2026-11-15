import { ECLIPTIC_NORTH } from '../../solarSystem/poleOrientation'
import { realPlanetPose } from '../../scene/exploreLayout'
import { PLANETS } from '../../solarSystem/bodies'
import { ephemerisAt } from '../../time/ephemeris'
import type { LessonShot } from '../lessonShot'
import type { Chapter } from '../lessonTypes'
import { RECORD_RADIUS } from './goldenRecordMesh'
import { RECORD_SCALE } from './recordScene'
import type { RouteStage, RouteView } from './voyagerStage'

const UP: [number, number, number] = [0, 1, 0]
const ECLIPTIC_UP: [number, number, number] = [...ECLIPTIC_NORTH]

// The whole probe, its magnetometer boom reaching up and out: seen from the side of its record
// (+X) and a little from above, its middle somewhat toward the boom.
const PROBE_SHOT: LessonShot = {
  key: 'probe',
  preset: { target: [0, 3.2, 3.8], radius: 24, azimuth: 0.35, elevation: 0.22, upAxis: UP },
  bounds: { top: 7, bottom: -6, halfWidth: 9.5 },
  maxZoomOut: 2.5,
}

// Taken apart, the parts spread further.
const EXPLODED_SHOT: LessonShot = { ...PROBE_SHOT, key: 'probe-exploded', bounds: { top: 8, bottom: -7.5, halfWidth: 11 } }

// The record, face on (the camera on +Z), with room beside it for the engravings' labels.
const RECORD_EXTENT = RECORD_RADIUS * RECORD_SCALE
const RECORD_SHOT: LessonShot = {
  key: 'record',
  preset: { target: [0, 0, 0], radius: RECORD_EXTENT * 3, azimuth: -Math.PI / 2, elevation: 0, upAxis: UP },
  bounds: { top: RECORD_EXTENT * 1.1, bottom: -RECORD_EXTENT * 1.1, halfWidth: RECORD_EXTENT * 1.6 },
  maxZoomOut: 2,
}

// Seen from above the planets' plane, the Sun in the middle: radius and how much must fit.
const OVERVIEWS: Partial<Record<RouteView, { radius: number; elevation: number; reach: number }>> = {
  launch: { radius: 300, elevation: 1.0, reach: 125 },
  outer: { radius: 560, elevation: 0.95, reach: 215 },
  heliosphere: { radius: 900, elevation: 0.62, reach: 320 },
}

// Voyager 1 on Valentine's Day 1990, 40 AU out, looking back (direction from the Sun, from its
// JPL Horizons position [-15.74, -30.06, 21.86] AU): azimuth and elevation of that direction, and
// its distance at Compact scale.
export const PALE_BLUE_DOT = { azimuth: Math.atan2(-30.06, -15.74), elevation: Math.asin(21.86 / 40.36), radius: 232 }

// A chapter's camera shot in the Voyager lessons.
export function voyagerShot(chapter: Chapter): LessonShot {
  const stage = chapter.voyager ?? {}
  if (chapter.kind === 'voyagerProbe') return (stage.explode ?? 0) > 0 ? EXPLODED_SHOT : PROBE_SHOT
  if (chapter.kind === 'voyagerRecord') return RECORD_SHOT
  return routeShot(stage.route ?? { from: '1977-09-05', to: '1977-09-05', view: 'launch' })
}

function routeShot(route: RouteStage): LessonShot {
  const overview = OVERVIEWS[route.view]
  if (overview) return aroundSun(route.view, overview)
  if (route.view === 'jupiter' || route.view === 'saturn') return atPlanet(route.view, route.to)
  if (route.view === 'side') return { key: 'side', preset: { target: [0, 0, 0], radius: 720, azimuth: -Math.PI / 2, elevation: 0.03, upAxis: ECLIPTIC_UP }, bounds: { top: 200, bottom: -200, halfWidth: 330 }, maxZoomOut: 1.5 }
  return {
    key: 'paleBlueDot',
    preset: { target: [0, 0, 0], radius: PALE_BLUE_DOT.radius, azimuth: PALE_BLUE_DOT.azimuth, elevation: PALE_BLUE_DOT.elevation, upAxis: ECLIPTIC_UP },
    bounds: { top: 60, bottom: -60, halfWidth: 70 },
    maxZoomOut: 1,
  }
}

function aroundSun(view: RouteView, { radius, elevation, reach }: { radius: number; elevation: number; reach: number }): LessonShot {
  return {
    key: view,
    preset: { target: [0, 0, 0], radius, azimuth: -Math.PI / 2, elevation, upAxis: ECLIPTIC_UP },
    bounds: { top: reach, bottom: -reach, halfWidth: reach },
    maxZoomOut: 1.5,
  }
}

// Close to a planet at the end of the chapter's stretch of time, seen from the Sun's side.
function atPlanet(planetId: 'jupiter' | 'saturn', date: string): LessonShot {
  const definition = PLANETS.find((planet) => planet.id === planetId)!
  const target = realPlanetPose(definition, ephemerisAt(new Date(date)), 1).position
  const azimuth = Math.atan2(target[1], target[0]) + Math.PI * 0.85
  return {
    key: planetId,
    preset: { target, radius: 70, azimuth, elevation: 0.75, upAxis: ECLIPTIC_UP },
    bounds: { top: 26, bottom: -26, halfWidth: 30 },
    maxZoomOut: 2,
  }
}
