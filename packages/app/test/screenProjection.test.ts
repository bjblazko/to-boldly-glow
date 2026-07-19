import { describe, expect, it } from 'vitest'
import { mat4 } from 'gl-matrix'
import { worldToScreen } from '../src/renderer/screenProjection'

describe('worldToScreen', () => {
  const view = mat4.lookAt(mat4.create(), [0, 0, 10], [0, 0, 0], [0, 1, 0])
  const projection = mat4.perspective(mat4.create(), Math.PI / 4, 800 / 600, 0.1, 1000)
  const viewProjection = mat4.multiply(mat4.create(), projection, view)

  it('projects the camera target to the canvas center', () => {
    const result = worldToScreen(viewProjection, 0, 0, 0, 800, 600)
    expect(result.visible).toBe(true)
    expect(result.x).toBeCloseTo(400, 0)
    expect(result.y).toBeCloseTo(300, 0)
  })

  it('marks a point directly behind the camera as not visible', () => {
    const result = worldToScreen(viewProjection, 0, 0, 20, 800, 600)
    expect(result.visible).toBe(false)
  })

  it('projects a point offset to the right of center further right on screen', () => {
    const center = worldToScreen(viewProjection, 0, 0, 0, 800, 600)
    const right = worldToScreen(viewProjection, 3, 0, 0, 800, 600)
    expect(right.visible).toBe(true)
    expect(right.x).toBeGreaterThan(center.x)
  })

  it('projects a point offset upward higher on screen (smaller y, since canvas y grows downward)', () => {
    const center = worldToScreen(viewProjection, 0, 0, 0, 800, 600)
    const up = worldToScreen(viewProjection, 0, 3, 0, 800, 600)
    expect(up.visible).toBe(true)
    expect(up.y).toBeLessThan(center.y)
  })

  it('marks a point far outside the view frustum as not visible', () => {
    const result = worldToScreen(viewProjection, 1000, 1000, 0, 800, 600)
    expect(result.visible).toBe(false)
  })
})
