import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CameraLens } from '../src/camera/cameraLens'
import { OrbitCamera } from '../src/camera/orbitCamera'
import { createViewpoint, projectToPixels } from '../src/camera/viewpoint'
import { LessonCamera } from '../src/learn/lessonCamera'
import { PLANET_SIZES_LESSON } from '../src/learn/lessons/planetSizes'
import { LINEUP_SUN_RADIUS, lineupSlot } from '../src/learn/sizes/sizesLineup'

const PAGE = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const planetChapters = PLANET_SIZES_LESSON.chapters.filter((chapter) => chapter.focusPlanetId)
const factOf = (id: string, label: string) => PLANET_SIZES_LESSON.chapters.find((chapter) => chapter.id === id)!.facts!.find((fact) => fact.label === label)?.value

function lessonCamera(width: number, height: number) {
  const canvas = { width, height, clientWidth: width, clientHeight: height } as HTMLCanvasElement
  const orbit = new OrbitCamera()
  const lens = new CameraLens(orbit, canvas)
  return { orbit, lens, camera: new LessonCamera(orbit, lens, canvas) }
}

describe('PLANET_SIZES_LESSON', () => {
  it('shows the whole lineup, then flies to each planet along it', () => {
    expect(PLANET_SIZES_LESSON.chapters.map((chapter) => chapter.focusPlanetId ?? null)).toEqual([
      null,
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'earth',
      'venus',
      'mars',
      'mercury',
    ])
  })

  it("lists each planet's facts as pictograms from the icon sprite, labeled and in English", () => {
    for (const chapter of planetChapters) {
      expect(chapter.facts).toHaveLength(9)
      for (const fact of chapter.facts!) {
        expect(PAGE).toContain(`<symbol id="icon-${fact.icon}"`)
        expect(fact.label.length, `${chapter.id} ${fact.icon}`).toBeGreaterThan(0)
        expect(fact.value.length, `${chapter.id} ${fact.icon}`).toBeGreaterThan(0)
      }
      expect(`${chapter.text} ${chapter.facts!.map((fact) => fact.value).join(' ')}`).not.toMatch(/Durchmesser|Umfang|Entfernung/)
    }
  })

  it("gives each planet its own numbers: mass, type, air, temperatures, spin and year", () => {
    expect(factOf('jupiter', 'Mass')).toBe('318 × Earth')
    expect(factOf('jupiter', 'Type')).toBe('Gas giant')
    expect(factOf('jupiter', 'Cloud tops')).toBe('−110 °C')
    expect(factOf('uranus', 'Type')).toBe('Ice giant')
    expect(factOf('uranus', 'One spin')).toBe('17.2 hours, backwards')
    expect(factOf('earth', 'Temperature')).toBe('−89 °C to 57 °C')
    expect(factOf('earth', 'Year')).toBe('365 days')
    expect(factOf('venus', 'One spin')).toBe('243 days, backwards')
    expect(factOf('mercury', 'Atmosphere')).toMatch(/^No/)
    expect(factOf('mars', 'Atmosphere')).toMatch(/^Yes/)
    expect(factOf('neptune', 'Year')).toBe('164.8 years')
  })
})

describe('the camera on a planet chapter', () => {
  it('shows the planet whole and large in the band above the lesson panel, on any screen', () => {
    for (const [width, height] of [
      [1280, 800],
      [1024, 700],
      [390, 844],
    ]) {
      const { orbit, lens, camera } = lessonCamera(width, height)
      const panelTop = Math.max(16, height - 376)
      for (const chapter of planetChapters) {
        const id = chapter.focusPlanetId!
        camera.frame('sizes', null, { focusPlanetId: id })
        const view = orbit.getViewMatrix()
        const right = [view[0], view[4], view[8]]
        const up = [view[1], view[5], view[9]]
        const { x, radius } = lineupSlot(id)
        const viewpoint = createViewpoint(view, lens.projection(), { width, height, clientWidth: width, clientHeight: height } as HTMLCanvasElement)
        const seen = (side: number[], amount: number) => projectToPixels(viewpoint, [x + side[0] * amount, side[1] * amount, side[2] * amount])
        const [top, bottom, left, rightEdge] = [seen(up, radius), seen(up, -radius), seen(right, -radius), seen(right, radius)]
        const where = `${id} at ${width}x${height}`
        expect(top.y, where).toBeGreaterThan(70)
        expect(bottom.y, where).toBeLessThan(panelTop)
        expect(left.x, where).toBeGreaterThan(0)
        expect(rightEdge.x, where).toBeLessThan(width)
        // Saturn leaves room for its rings.
        expect(bottom.y - top.y, where).toBeGreaterThan((panelTop - 76) * (id === 'saturn' ? 0.3 : 0.5))
      }
    }
  })

  it('keeps clear of the Sun, however close a planet sits to it', () => {
    const { orbit, camera } = lessonCamera(1280, 800)
    for (const chapter of planetChapters) {
      camera.frame('sizes', null, { focusPlanetId: chapter.focusPlanetId })
      const eye = orbit.getEyePosition()
      expect(Math.hypot(eye[0], eye[1], eye[2]), chapter.id).toBeGreaterThan(LINEUP_SUN_RADIUS * 1.45)
    }
  })

  it('flies from one planet to the next and arrives exactly on its shot', () => {
    const { orbit, lens, camera } = lessonCamera(1280, 800)
    const snapshot = () => ({ target: [...orbit.target], radius: orbit.radius, azimuth: orbit.azimuth, elevation: orbit.elevation, lensShift: lens.lensShiftNdc })
    camera.frame('sizes', null, { focusPlanetId: 'saturn' })
    const saturn = snapshot()
    camera.frame('sizes', null, { focusPlanetId: 'jupiter' })
    const jupiter = snapshot()

    camera.frame('sizes', null, { focusPlanetId: 'saturn', glide: true })
    expect(snapshot()).toEqual(jupiter)
    expect(camera.isGliding).toBe(true)
    camera.update(0.8)
    expect(orbit.target[0]).toBeLessThan(jupiter.target[0])
    expect(orbit.target[0]).toBeGreaterThan(saturn.target[0])
    camera.update(1)
    expect(camera.isGliding).toBe(false)
    const arrived = snapshot()
    for (let i = 0; i < 3; i++) expect(arrived.target[i]).toBeCloseTo(saturn.target[i], 9)
    expect(arrived.radius).toBeCloseTo(saturn.radius, 9)
    expect(arrived.azimuth).toBeCloseTo(saturn.azimuth, 9)
    expect(arrived.lensShift).toBeCloseTo(saturn.lensShift, 9)
  })
})
