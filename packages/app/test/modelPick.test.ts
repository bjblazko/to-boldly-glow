import { describe, expect, it } from 'vitest'
import type { ModelData } from '../src/spacecraft/modelFile'
import { hingeMatrix } from '../src/spacecraft/modelHinge'
import { pickModel } from '../src/spacecraft/modelPick'

// One square of two triangles in the plane z = 0 (from -1 to 1 in x and y), assembly 0.
function square(): ModelData {
  const corner = (x: number, y: number) => [x, y, 0, 0, 0, 1, 0, 0, 0]
  return {
    description: {} as ModelData['description'],
    vertices: Float32Array.from([...corner(-1, -1), ...corner(1, -1), ...corner(1, 1), ...corner(-1, 1)]),
    indices: Uint32Array.from([0, 1, 2, 0, 2, 3]),
  }
}

const SHOWN = { moved: [[0, 0, 0] as [number, number, number]], shown: () => true, cutAway: () => false }

describe('pickModel', () => {
  it('finds how far along the ray the model is', () => {
    expect(pickModel(square(), [0.2, 0.3, 5], [0, 0, -1], SHOWN)).toBeCloseTo(5, 6)
  })

  it('misses beside it, and behind the ray', () => {
    expect(pickModel(square(), [3, 0, 5], [0, 0, -1], SHOWN)).toBeNull()
    expect(pickModel(square(), [0, 0, 5], [0, 0, 1], SHOWN)).toBeNull()
  })

  it('looks through what the picture does not show: a hidden assembly, a cut-away quarter', () => {
    expect(pickModel(square(), [0, 0, 5], [0, 0, -1], { ...SHOWN, shown: () => false })).toBeNull()
    expect(pickModel(square(), [0, 0, 5], [0, 0, -1], { ...SHOWN, cutAway: () => true })).toBeNull()
  })

  it('finds an assembly where it has moved to', () => {
    expect(pickModel(square(), [0, 0, 5], [0, 0, -1], { ...SHOWN, moved: [[0, 0, 2]] })).toBeCloseTo(3, 6)
  })
})

// One triangle in the plane y = 0, folded up about the line x = 1 (along z) by a quarter turn.
function flap(): ModelData {
  const corner = (x: number, z: number) => [x, 0, z, 0, 1, 0, 0, 0, 0]
  return {
    description: {} as ModelData['description'],
    vertices: Float32Array.from([...corner(1, -1), ...corner(2, -1), ...corner(2, 1)]),
    indices: Uint32Array.from([0, 1, 2]),
  }
}

describe('pickModel with a hinge', () => {
  const folded = [hingeMatrix({ pivot: [1, 0, 0], axis: [0, 0, 1], angle: Math.PI / 2 }, 1)]

  it('hits a folded assembly where it is drawn, not where it lies unfolded', () => {
    expect(pickModel(flap(), [0, 0.8, 0], [1, 0, 0], { ...SHOWN, hinges: folded })).toBeCloseTo(1, 6)
    expect(pickModel(flap(), [1.8, 5, -0.5], [0, -1, 0], { ...SHOWN, hinges: folded })).toBeNull()
  })

  it('folds an assembly first, then moves it out', () => {
    expect(pickModel(flap(), [0, 0.8, 3], [1, 0, 0], { ...SHOWN, moved: [[0, 0, 3]], hinges: folded })).toBeCloseTo(1, 6)
  })
})
