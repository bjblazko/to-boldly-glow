import { mat4, vec4 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { perspectiveProjection } from '../src/camera/viewpoint'
import { fitToRegion, hasSidePanel, sceneRegion } from '../src/learn/lessonFrame'

describe('where a lesson scene goes', () => {
  it('puts the panel in a column on wide landscape screens, above the bar elsewhere', () => {
    expect(hasSidePanel(1280, 800)).toBe(true)
    expect(hasSidePanel(1920, 1080)).toBe(true)
    expect(hasSidePanel(820, 1180)).toBe(false) // a tablet upright
    expect(hasSidePanel(390, 844)).toBe(false) // a phone
    expect(hasSidePanel(1000, 1000)).toBe(false) // square: the column would squeeze the scene
  })

  it('leaves the scene the screen left of the column, down to the bar', () => {
    const side = sceneRegion(1280, 800)
    expect(side.right * 1280).toBeLessThan(1280 - 380)
    expect(side.bottom * 800).toBeLessThan(800 - 101)
    const stacked = sceneRegion(390, 844)
    expect([stacked.left, stacked.right]).toEqual([0, 1])
    expect(stacked.bottom * 844).toBeLessThan(844 - 101)
  })

  it('puts the content’s middle in the middle of the region, at any shift', () => {
    const region = sceneRegion(1280, 800)
    const content = { top: 30, bottom: -10, halfWidth: 5 }
    const { radius, lensShift } = fitToRegion(content, { region, aspect: 1.6 }, 100, 2)
    // The camera looks along -Z at the target (the origin) from `radius` away.
    const view = mat4.lookAt(mat4.create(), [0, 0, radius], [0, 0, 0], [0, 1, 0])
    const clip = vec4.transformMat4(vec4.create(), [0, (content.top + content.bottom) / 2, 0, 1], mat4.multiply(mat4.create(), perspectiveProjection(1.6, 1, lensShift), view))
    const [x, y] = [clip[0] / clip[3], clip[1] / clip[3]]
    expect((x + 1) / 2).toBeCloseTo((region.left + region.right) / 2, 6)
    expect((1 - y) / 2).toBeCloseTo((region.top + region.bottom) / 2, 6)
    expect(radius).toBeGreaterThanOrEqual(100)
  })
})
