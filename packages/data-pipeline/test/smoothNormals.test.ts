import { describe, expect, it } from 'vitest'
import type { MeshPrimitive } from '../src/spacecraft/glbMesh'
import { smoothNormals } from '../src/spacecraft/smoothNormals'

// Two triangles sharing the edge from (0,0,0) to (0,0,1), each with its own copy of those corners
// (as a texture seam leaves them): the first in the floor (y = 0), the second tilted up by `degrees`.
function hinge(degrees: number): MeshPrimitive[] {
  const angle = (degrees * Math.PI) / 180
  const tri = (third: number[]): MeshPrimitive => ({
    texture: 't',
    positions: Float32Array.from([0, 0, 0, 0, 0, 1, ...third]),
    normals: new Float32Array(9),
    uvs: new Float32Array(6),
    indices: Uint32Array.from([0, 1, 2]),
  })
  return [tri([1, 0, 0]), tri([-Math.cos(angle), Math.sin(angle), 0])].map((primitive, index) => (index === 1 ? { ...primitive, indices: Uint32Array.from([0, 2, 1]) } : primitive))
}

describe('smoothNormals', () => {
  it('smooths across a gentle fold, even where the corners are separate vertices', () => {
    const [floor, tilted] = smoothNormals(hinge(20), { creaseDegrees: 60, weld: 1e-4 })
    // On the shared edge both sides get the same, in-between normal.
    expect([...floor.normals.subarray(0, 3)].map((v) => +v.toFixed(5))).toEqual([...tilted.normals.subarray(0, 3)].map((v) => +v.toFixed(5)))
    expect(floor.normals[1]).toBeLessThan(1)
  })

  it('keeps a sharp edge sharp', () => {
    const [floor] = smoothNormals(hinge(90), { creaseDegrees: 60, weld: 1e-4 })
    expect(floor.normals[1]).toBeCloseTo(1, 5)
  })
})
