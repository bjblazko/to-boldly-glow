import { readFileSync } from 'node:fs'
import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { CameraLens } from '../src/camera/cameraLens'
import { OrbitCamera } from '../src/camera/orbitCamera'
import { createViewpoint, projectToPixels } from '../src/camera/viewpoint'
import { EARTH_RADIUS, MOON_ORBIT_TILT_DEGREES, MOON_RADIUS, SUN_RADIUS, shadowEdgeLines } from '../src/learn/eclipse/eclipseGeometry'
import { LessonCamera } from '../src/learn/lessonCamera'
import { isPhasesKind } from '../src/learn/lessonTypes'
import { LESSONS_BY_ID } from '../src/learn/lessons/lessonCatalog'
import { MOON_PHASES_LESSON } from '../src/learn/lessons/moonPhases'
import { litShapePath } from '../src/learn/phases/phaseInset'
import { earthshineStrength, litFraction, moonGroundShot, phaseAngle, PHASES_EARTH_POSITION, phaseName, phasesMoonPosition } from '../src/learn/phases/phasesGeometry'
import { twilightSkyLight } from '../src/learn/phases/phasesLesson'

const stageOf = (id: string) => MOON_PHASES_LESSON.chapters.find((chapter) => chapter.id === id)!.phases!
const degrees = (radians: number) => (radians * 180) / Math.PI
const fromEarth = (point: ArrayLike<number>) => vec3.normalize(vec3.create(), [point[0] - PHASES_EARTH_POSITION[0], point[1] - PHASES_EARTH_POSITION[1], point[2] - PHASES_EARTH_POSITION[2]])
const altitude = (direction: vec3, zenith: ArrayLike<number>) => degrees(Math.asin(vec3.dot(direction, zenith as vec3)))

describe('MOON_PHASES_LESSON', () => {
  it('goes from space down to the ground, through a month of phases', () => {
    expect(MOON_PHASES_LESSON.chapters.map((chapter) => chapter.id)).toEqual([
      'always-half-lit',
      'not-earths-shadow',
      'same-face',
      'evening-crescent',
      'first-quarter',
      'full-moon',
      'last-quarter',
    ])
    expect(MOON_PHASES_LESSON.chapters.map((chapter) => chapter.kind)).toEqual([
      'phasesOrbit',
      'phasesShadow',
      'phasesOrbit',
      'phasesSky',
      'phasesSky',
      'phasesSky',
      'phasesSky',
    ])
    for (const chapter of MOON_PHASES_LESSON.chapters) {
      expect(isPhasesKind(chapter.kind)).toBe(true)
      expect(chapter.phases).toBeDefined()
      expect(chapter.text.length).toBeGreaterThan(100)
    }
  })

  it('names each ground chapter after the phase it shows', () => {
    expect(phaseName(stageOf('evening-crescent').moonAgeDegrees)).toBe('Waxing crescent')
    expect(phaseName(stageOf('first-quarter').moonAgeDegrees)).toBe('First quarter')
    expect(phaseName(stageOf('full-moon').moonAgeDegrees)).toBe('Full moon')
    expect(phaseName(stageOf('last-quarter').moonAgeDegrees)).toBe('Last quarter')
  })

  it('is registered in LESSONS_BY_ID and offered in the lesson picker', () => {
    expect(LESSONS_BY_ID['moonPhases']).toBe(MOON_PHASES_LESSON)
    expect(readFileSync(new URL('../index.html', import.meta.url), 'utf8')).toContain('data-lesson-id="moonPhases"')
  })

  it('says what is and is not to scale', () => {
    expect(MOON_PHASES_LESSON.note).toContain('Not to scale')
  })
})

describe('the Moon phases geometry', () => {
  it('lights all of the near side at full moon, half at the quarters, none at new moon', () => {
    expect(litFraction(phaseAngle(phasesMoonPosition(0)))).toBeCloseTo(0, 6)
    expect(litFraction(phaseAngle(phasesMoonPosition(180)))).toBeCloseTo(1, 6)
    // Exactly half only with the Sun infinitely far away; the staged one is 50 Moon distances off.
    for (const age of [90, 270]) expect(Math.abs(litFraction(phaseAngle(phasesMoonPosition(age))) - 0.5)).toBeLessThan(0.015)
    expect(litFraction(phaseAngle(phasesMoonPosition(40)))).toBeLessThan(0.2)
  })

  it('puts the Moon at first quarter on the side Earth is turning toward, counterclockwise seen from the north', () => {
    const firstQuarter = phasesMoonPosition(90)
    expect(firstQuarter[1]).toBeLessThan(PHASES_EARTH_POSITION[1])
    expect(phasesMoonPosition(180)[0]).toBeGreaterThan(PHASES_EARTH_POSITION[0])
  })

  it('lights the night side by earthshine most at new moon and not at all at full moon', () => {
    expect(earthshineStrength(Math.PI)).toBeGreaterThan(earthshineStrength(Math.PI / 2))
    expect(earthshineStrength(0)).toBe(0)
  })

  it("passes the full Moon below Earth's dark shadow in the side view", () => {
    const moon = phasesMoonPosition(180, MOON_ORBIT_TILT_DEGREES)
    const { umbra } = shadowEdgeLines({ position: [0, 0, 0], radius: SUN_RADIUS }, { position: PHASES_EARTH_POSITION, radius: EARTH_RADIUS }, [0, 0, 1], PHASES_EARTH_POSITION[0] + 20)
    const lowerEdge = umbra[1]
    const t = (moon[0] - lowerEdge[0]) / (lowerEdge[3] - lowerEdge[0])
    const edgeHeight = lowerEdge[2] + (lowerEdge[5] - lowerEdge[2]) * t
    expect(moon[2] + MOON_RADIUS).toBeLessThan(edgeHeight)
  })
})

describe('the sky over the ground chapters', () => {
  for (const id of ['evening-crescent', 'first-quarter', 'full-moon', 'last-quarter']) {
    it(`${id}: the Moon and the Sun stand at the chapter's altitudes, the Sun west of a waxing Moon and east of a waning one`, () => {
      const stage = stageOf(id)
      const moon = phasesMoonPosition(stage.moonAgeDegrees)
      const shot = moonGroundShot(moon, { moon: stage.moonAltitudeDegrees, sun: stage.sunAltitudeDegrees }, stage.moonAgeDegrees)
      expect(vec3.length(shot.zenith as vec3)).toBeCloseTo(1, 6)
      expect(altitude(fromEarth(moon), shot.zenith)).toBeCloseTo(stage.moonAltitudeDegrees, 1)
      expect(altitude(fromEarth([0, 0, 0]), shot.zenith)).toBeCloseTo(stage.sunAltitudeDegrees, 1)
      if (stage.moonAgeDegrees % 180 !== 0) {
        // Facing the Moon, with the zenith up: + is right (west).
        const right = vec3.cross(vec3.create(), shot.toward, shot.zenith)
        const sunSide = vec3.dot(fromEarth([0, 0, 0]), right)
        expect(Math.sign(sunSide)).toBe(stage.moonAgeDegrees < 180 ? 1 : -1)
      }
    })
  }

  it('fades from day through a glowing dusk to night as the Sun sinks', () => {
    expect(twilightSkyLight(5).daylight).toBe(1)
    expect(twilightSkyLight(-8).daylight).toBe(0)
    expect(twilightSkyLight(-3).glow).toBe(1)
    expect(twilightSkyLight(-20).glow).toBe(0)
    expect(twilightSkyLight(-3).glowSpread).toBe(0)
  })

  it('frames each ground chapter with the Moon above the horizon, on any screen', () => {
    for (const [width, height] of [[1280, 800], [390, 844]]) {
      const canvas = { width, height, clientWidth: width, clientHeight: height } as HTMLCanvasElement
      const orbit = new OrbitCamera()
      const lens = new CameraLens(orbit, canvas)
      const camera = new LessonCamera(orbit, lens, canvas)
      for (const id of ['evening-crescent', 'first-quarter', 'full-moon', 'last-quarter']) {
        const stage = stageOf(id)
        const moon = phasesMoonPosition(stage.moonAgeDegrees)
        camera.frame('phasesSky', moonGroundShot(moon, { moon: stage.moonAltitudeDegrees, sun: stage.sunAltitudeDegrees }, stage.moonAgeDegrees))
        for (let i = 0; i < 3; i++) expect(orbit.getEyePosition()[i]).toBeCloseTo(PHASES_EARTH_POSITION[i], 4)
        const seen = projectToPixels(createViewpoint(orbit.getViewMatrix(), lens.projection(), canvas), moon)
        expect(seen.x).toBeCloseTo(width / 2, 0)
        expect(seen.y).toBeGreaterThan(0)
        expect(seen.y).toBeLessThan(height * 0.55)
      }
    }
  })
})

describe('the "seen from Earth" card', () => {
  it('draws a full disc at full moon and a straight terminator at the quarters, lit on the right while waxing', () => {
    expect(litShapePath(0, true)).toBe('M 0 -1 A 1 1 0 0 1 0 1 A 1.0000 1 0 0 1 0 -1 Z')
    expect(litShapePath(Math.PI / 2, true)).toContain('A 0.0000 1')
    // A waxing crescent: limb on the right, terminator bulging right too.
    expect(litShapePath(2.5, true)).toMatch(/^M 0 -1 A 1 1 0 0 1 0 1 A [0-9.]+ 1 0 0 0 0 -1 Z$/)
    // Waning mirrors it: limb on the left.
    expect(litShapePath(2.5, false)).toMatch(/^M 0 -1 A 1 1 0 0 0 0 1 A [0-9.]+ 1 0 0 1 0 -1 Z$/)
  })
})
