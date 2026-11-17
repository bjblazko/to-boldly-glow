import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { CameraLens } from '../src/camera/cameraLens'
import { OrbitCamera } from '../src/camera/orbitCamera'
import { LessonCamera } from '../src/learn/lessonCamera'
import type { LessonShot } from '../src/learn/lessonShot'
import type { Chapter } from '../src/learn/lessonTypes'
import { voyagerShot } from '../src/learn/voyager/voyagerShots'

const canvas = { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 } as HTMLCanvasElement

function lessonCamera() {
  const orbit = new OrbitCamera()
  return { orbit, camera: new LessonCamera(orbit, new CameraLens(orbit, canvas), canvas) }
}

const probeShot = voyagerShot({ kind: 'voyagerProbe', voyager: {} } as unknown as Chapter)

const narrowShot: LessonShot = {
  key: 'narrow',
  preset: { target: [0, 0, 0], radius: 50, azimuth: 0.4, elevation: 0.2, upAxis: [0, 1, 0] },
  bounds: { top: 10, bottom: -10, halfWidth: 12 },
  maxZoomOut: 2,
}

describe('LessonCamera looking around', () => {
  it('lets a model be looked at from all around, and zoomed in to its own floor', () => {
    const { orbit, camera } = lessonCamera()
    camera.frameShot(probeShot)
    expect(orbit.viewLimits).toBeNull()
    expect(orbit.minRadius).toBe(probeShot.zoomFloor ?? 5)
  })

  it('lets other scenes turn up to 90 degrees either way from their framing', () => {
    const { orbit, camera } = lessonCamera()
    camera.frameShot(narrowShot)
    expect(orbit.viewLimits?.azimuth[0]).toBeCloseTo(0.4 - Math.PI / 2, 10)
    expect(orbit.viewLimits?.azimuth[1]).toBeCloseTo(0.4 + Math.PI / 2, 10)
  })

  it('puts the pivot back and lets it move about the shot', () => {
    const { orbit, camera } = lessonCamera()
    orbit.shiftPivot([3, 0, 0])
    camera.frameShot(probeShot)
    expect(Math.hypot(...orbit.panOffset)).toBe(0)
    expect(orbit.panLimit).toBe(9.5)
  })

  it('starts a glide from where the user had moved the pivot', () => {
    const { orbit, camera } = lessonCamera()
    camera.frameShot(narrowShot)
    orbit.shiftPivot([4, 0, 0])
    const looked = vec3.clone(orbit.pivot())
    camera.frameShot(probeShot, true)
    expect(vec3.distance(orbit.pivot(), looked)).toBeCloseTo(0, 5)
  })
})

describe('LessonCamera noticing the user', () => {
  it('notices when the user moved the view, until a shot is framed again', () => {
    const { orbit, camera } = lessonCamera()
    camera.frameShot(probeShot)
    expect(camera.viewLeft).toBe(false)
    orbit.azimuth += 0.2
    expect(camera.viewLeft).toBe(true)
    orbit.azimuth -= 0.2
    expect(camera.viewLeft).toBe(true)
    camera.frameShot(probeShot)
    expect(camera.viewLeft).toBe(false)
  })

  it('notices a moved pivot and a zoom as well', () => {
    const { orbit, camera } = lessonCamera()
    camera.frameShot(probeShot)
    orbit.shiftPivot([0.5, 0, 0])
    expect(camera.viewLeft).toBe(true)
    camera.frameShot(probeShot)
    orbit.zoomBy(0.8)
    expect(camera.viewLeft).toBe(true)
  })

  it('does not count its own glide between two shots', () => {
    const { camera } = lessonCamera()
    camera.frameShot(narrowShot)
    camera.frameShot(probeShot, true)
    camera.update(0.1)
    expect(camera.viewLeft).toBe(false)
  })
})
