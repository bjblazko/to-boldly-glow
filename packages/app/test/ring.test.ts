import { describe, expect, it } from 'vitest'
import { generateRingMesh } from '../src/geometry/ring'

describe('generateRingMesh', () => {
  const innerRadius = 1.3
  const outerRadius = 2.3
  const angularSegments = 32
  const mesh = generateRingMesh(innerRadius, outerRadius, angularSegments)

  it('produces the expected vertex and index counts', () => {
    const expectedVertexCount = (angularSegments + 1) * 2
    expect(mesh.positions.length).toBe(expectedVertexCount * 3)
    expect(mesh.uvs.length).toBe(expectedVertexCount * 2)
    expect(mesh.indices.length).toBe(angularSegments * 6)
  })

  it('places inner-edge vertices at innerRadius and outer-edge vertices at outerRadius', () => {
    for (let i = 0; i < mesh.positions.length; i += 6) {
      const innerDistance = Math.hypot(mesh.positions[i], mesh.positions[i + 1])
      const outerDistance = Math.hypot(mesh.positions[i + 3], mesh.positions[i + 4])
      expect(innerDistance).toBeCloseTo(innerRadius, 5)
      expect(outerDistance).toBeCloseTo(outerRadius, 5)
    }
  })

  it('keeps every vertex in the Z=0 plane', () => {
    for (let i = 2; i < mesh.positions.length; i += 3) {
      expect(mesh.positions[i]).toBe(0)
    }
  })

  it('maps u=0 at the inner edge and u=1 at the outer edge', () => {
    for (let i = 0; i < mesh.uvs.length; i += 4) {
      expect(mesh.uvs[i]).toBe(0)
      expect(mesh.uvs[i + 2]).toBe(1)
    }
  })

  it('references only valid vertex indices', () => {
    const vertexCount = mesh.positions.length / 3
    for (const index of mesh.indices) {
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(vertexCount)
    }
  })
})
