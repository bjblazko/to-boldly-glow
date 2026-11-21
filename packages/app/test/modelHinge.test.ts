import { describe, expect, it } from 'vitest'
import { applyHinge, hingeMatrix, type Hinge } from '../src/spacecraft/modelHinge'

const QUARTER: Hinge = { pivot: [1, 0, 0], axis: [0, 0, 1], angle: Math.PI / 2 }

function expectPoint(actual: number[], expected: number[]): void {
  actual.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 6))
}

describe('hingeMatrix', () => {
  it('leaves a part without a hinge, or not folded, where it is', () => {
    expectPoint(applyHinge(hingeMatrix(undefined, 1), [2, 3, 4]), [2, 3, 4])
    expectPoint(applyHinge(hingeMatrix(QUARTER, 0), [2, 3, 4]), [2, 3, 4])
  })

  it('turns a part about its hinge by its angle when folded', () => {
    expectPoint(applyHinge(hingeMatrix(QUARTER, 1), [2, 0, 0]), [1, 1, 0])
  })

  it('turns it part of the way when part folded', () => {
    expectPoint(applyHinge(hingeMatrix(QUARTER, 0.5), [2, 0, 0]), [1 + Math.SQRT1_2, Math.SQRT1_2, 0])
  })
})

describe('the shaders', () => {
  it('fold the picture and the lamp shadow alike', async () => {
    const { modelShaderCode } = await import('../src/spacecraft/modelShader')
    const { shadowShaderCode } = await import('../src/spacecraft/modelShadow')
    for (const code of [modelShaderCode, shadowShaderCode]) {
      expect(code).toContain('fn hinged(')
      expect(code).toMatch(/hinged\([a-z]+, (vert\.)?position, 1\.0\) \+ uni\.offsets/)
    }
  })
})
