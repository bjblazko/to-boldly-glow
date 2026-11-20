import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { OrbitMotion } from '../src/camera/input/orbitMotion'
import { OrbitCamera } from '../src/camera/orbitCamera'

describe('OrbitMotion zoom toward the pointer', () => {
  it('eases a zoom toward its anchor', () => {
    const camera = new OrbitCamera({ radius: 40, minRadius: 1 })
    const { right } = camera.screenAxes()
    const motion = new OrbitMotion(camera, () => ({ heightPx: 800, aspect: 1.5, lensShift: { x: 0, y: 0 } }))
    motion.zoom(-0.7, [0.5, 0])
    for (let t = 0; t < 1; t += 0.016) motion.update(0.016)
    expect(camera.radius).toBeCloseTo(40 * Math.exp(-0.7), 1)
    expect(vec3.dot(camera.pivot(), right)).toBeGreaterThan(0)
  })
})
