import { describe, expect, it } from 'vitest'
import { NO_LENS_SHIFT } from '../src/camera/viewpoint'
import { OrbitCamera } from '../src/camera/orbitCamera'
import { ROUTE_EARTH, ROUTE_EARTH_RADIUS, ROUTE_MOON, ROUTE_MOON_RADIUS } from '../src/learn/apolloRoute/routeGeometry'
import { apolloRouteShot } from '../src/learn/apolloRoute/routeShots'
import { blendViews, cameraSnapshot, keepOutside, viewAbout } from '../src/learn/lessonCameraViews'
import type { LessonShot } from '../src/learn/lessonShot'
import { APOLLO11_LESSON } from '../src/learn/lessons/apollo11'

type V = ArrayLike<number>
const distance = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// What the lesson keeps the camera out of (apolloRouteLesson.ts).
const BALLS = [{ center: ROUTE_MOON, radius: ROUTE_MOON_RADIUS * 1.005 }, { center: ROUTE_EARTH, radius: ROUTE_EARTH_RADIUS * 1.01 }]

// The eye and what it looks at along the lesson camera's flight from one shot to the next (as
// LessonCamera glides).
function flightEyes(from: LessonShot, to: LessonShot): { eye: V; target: V }[] {
  const start = new OrbitCamera({ ...from.preset, minRadius: 1e-6 })
  const view = viewAbout(cameraSnapshot(start, NO_LENS_SHIFT), to.preset.upAxis)
  const end = { ...to.preset, lensShift: NO_LENS_SHIFT }
  view.azimuth += Math.round((end.azimuth - view.azimuth) / (2 * Math.PI)) * 2 * Math.PI
  return Array.from({ length: 51 }, (_, i) => {
    const step = keepOutside(blendViews(view, end, i / 50), to.preset.upAxis, BALLS)
    return { eye: new OrbitCamera({ target: step.target, radius: step.radius, azimuth: step.azimuth, elevation: step.elevation, upAxis: to.preset.upAxis, minRadius: 1e-6 }).getEyePosition(), target: step.target }
  })
}

describe('the Apollo 11 lesson’s camera flights', () => {
  const shots = APOLLO11_LESSON.chapters.map((chapter) => ({ id: chapter.id, shot: apolloRouteShot(chapter.apolloRoute!) }))
  it.each(shots.slice(1).map((next, i) => [shots[i].id, next.id, i] as const))('from %s to %s never pass through Earth or the Moon', (_from, _to, i) => {
    for (const [a, b] of [[shots[i].shot, shots[i + 1].shot], [shots[i + 1].shot, shots[i].shot]]) {
      for (const { eye, target } of flightEyes(a, b)) {
        expect(distance(eye, ROUTE_MOON)).toBeGreaterThan(ROUTE_MOON_RADIUS)
        expect(distance(eye, ROUTE_EARTH)).toBeGreaterThan(ROUTE_EARTH_RADIUS)
        // Close over the Moon, it looks at its surface, not into it (from inside its drawn sphere
        // shows nothing: the camera would seem to see through it).
        if (distance(eye, ROUTE_MOON) < ROUTE_MOON_RADIUS * 1.1) expect(distance(target, ROUTE_MOON)).toBeGreaterThan(ROUTE_MOON_RADIUS * 0.999)
      }
    }
  })
})
