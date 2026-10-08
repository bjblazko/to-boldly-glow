import { readFileSync } from 'node:fs'
import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { CameraLens } from '../src/camera/cameraLens'
import { OrbitCamera } from '../src/camera/orbitCamera'
import { createViewpoint, projectToPixels } from '../src/camera/viewpoint'
import { EARTH_POSITION, stagedMoonPosition } from '../src/learn/eclipse/eclipseGeometry'
import { SHADOW_SWEEP_DEGREES } from '../src/learn/eclipse/eclipseScene'
import { ECLIPSE_SKY_SHOT, OBSERVER, SUNWARD, ZENITH } from '../src/learn/eclipse/skyGeometry'
import { LessonCamera } from '../src/learn/lessonCamera'
import { isEclipseKind } from '../src/learn/lessonTypes'
import { LESSONS_BY_ID } from '../src/learn/lessons/lessonCatalog'
import { SOLAR_ECLIPSE_LESSON } from '../src/learn/lessons/solarEclipse'

const ids = SOLAR_ECLIPSE_LESSON.chapters.map((chapter) => chapter.id)

describe('SOLAR_ECLIPSE_LESSON', () => {
  it('goes from space down to the ground: the line-up, the tilted orbit, the shadow on Earth, then the eclipse in the sky', () => {
    expect(ids).toEqual(['new-moon', 'tilted-orbit', 'shadow-on-earth', 'first-contact', 'partial', 'diamond-ring', 'totality', 'annular'])
    expect(SOLAR_ECLIPSE_LESSON.chapters.map((chapter) => chapter.kind)).toEqual([
      'eclipseOrbit',
      'eclipseOrbit',
      'eclipseShadow',
      'eclipseSky',
      'eclipseSky',
      'eclipseSky',
      'eclipseSky',
      'eclipseSky',
    ])
  })

  it('gives every chapter a stage and some text', () => {
    for (const chapter of SOLAR_ECLIPSE_LESSON.chapters) {
      expect(isEclipseKind(chapter.kind)).toBe(true)
      expect(chapter.eclipse).toBeDefined()
      expect(chapter.text.length).toBeGreaterThan(100)
    }
  })

  it('lines the Moon up for an eclipse in the line-up and the shadow chapters, and lifts it out of line to show why not every month', () => {
    const node = (id: string) => SOLAR_ECLIPSE_LESSON.chapters.find((chapter) => chapter.id === id)!.eclipse!.nodeDegrees
    expect(node('new-moon')).toBe(0)
    expect(node('shadow-on-earth')).toBe(0)
    expect(node('tilted-orbit')).toBe(90)
  })

  // Safety first: the partial phases and the ring of fire are only ever shown through eclipse
  // glasses (or as the glare that makes the bite invisible), and the texts say so.
  it('shows the partial and annular phases through eclipse glasses, and totality without them', () => {
    const glasses = (id: string) => SOLAR_ECLIPSE_LESSON.chapters.find((chapter) => chapter.id === id)!.eclipse!.glasses
    expect(glasses('partial')).toBe(1)
    expect(glasses('annular')).toBe(1)
    expect(glasses('totality')).toBe(0)
    const text = (id: string) => SOLAR_ECLIPSE_LESSON.chapters.find((chapter) => chapter.id === id)!.text
    expect(text('first-contact')).toContain('Never look straight at the Sun')
    expect(text('partial')).toContain('ISO 12312-2')
    expect(text('totality')).toContain('only now')
    expect(text('annular')).toContain('glasses stay on')
  })

  it('says what is and is not to scale', () => {
    expect(SOLAR_ECLIPSE_LESSON.note).toContain('Not to scale')
    expect(SOLAR_ECLIPSE_LESSON.note).toContain('5 times more steeply')
  })

  it('is registered in LESSONS_BY_ID and offered in the lesson picker', () => {
    expect(LESSONS_BY_ID['solarEclipse']).toBe(SOLAR_ECLIPSE_LESSON)
    expect(readFileSync(new URL('../index.html', import.meta.url), 'utf8')).toContain('data-lesson-id="solarEclipse"')
  })
})

function lessonCameraFor(width: number, height: number) {
  const canvas = { width, height, clientWidth: width, clientHeight: height } as HTMLCanvasElement
  const orbit = new OrbitCamera()
  const lens = new CameraLens(orbit, canvas)
  return { orbit, lens, canvas, camera: new LessonCamera(orbit, lens, canvas) }
}

describe('the eclipse lesson camera', () => {
  it('stands exactly at the observer in the ground view, on any screen, looking toward the Sun with the horizon level', () => {
    for (const [width, height] of [[1280, 800], [1280, 480], [390, 844]]) {
      const { orbit, camera } = lessonCameraFor(width, height)
      camera.frame('eclipseSky', ECLIPSE_SKY_SHOT)
      const eye = orbit.getEyePosition()
      for (let i = 0; i < 3; i++) expect(eye[i]).toBeCloseTo(OBSERVER[i], 4)
      const look = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), orbit.target, eye))
      expect(vec3.dot(look, SUNWARD)).toBeGreaterThan(Math.cos((8 * Math.PI) / 180))
      // Level: the view's right-hand direction lies in the horizon's plane.
      const right = vec3.cross(vec3.create(), look, orbit.upAxis)
      expect(vec3.dot(right, ZENITH)).toBeCloseTo(0, 5)
    }
  })

  it('keeps the Moon out of the shadow close-up through its whole sweep, even on a short screen', () => {
    for (const [width, height] of [[1280, 800], [1280, 480], [390, 844], [1920, 1080]]) {
      const { orbit, lens, canvas, camera } = lessonCameraFor(width, height)
      camera.frame('eclipseShadow')
      expect(vec3.distance(orbit.getEyePosition(), EARTH_POSITION)).toBeCloseTo(9, 4)
      const viewpoint = createViewpoint(orbit.getViewMatrix(), lens.projection(), canvas)
      for (let degrees = -SHADOW_SWEEP_DEGREES; degrees <= SHADOW_SWEEP_DEGREES; degrees += 1) {
        const moon = stagedMoonPosition(0, degrees)
        const seen = projectToPixels(viewpoint, moon)
        const onScreen = seen.visible && seen.x > -60 && seen.x < width + 60 && seen.y > -60 && seen.y < height + 60
        expect(onScreen).toBe(false)
      }
    }
  })

  it('backs off far enough for the whole line-up to fit across a portrait phone screen', () => {
    const { orbit, lens, canvas, camera } = lessonCameraFor(390, 844)
    camera.frame('eclipseOrbit')
    const viewpoint = createViewpoint(orbit.getViewMatrix(), lens.projection(), canvas)
    for (const point of [[-3, 0, 0], [EARTH_POSITION[0] + 8.5, 0, 0]]) {
      const seen = projectToPixels(viewpoint, point)
      expect(seen.x).toBeGreaterThan(0)
      expect(seen.x).toBeLessThan(390)
    }
  })
})
