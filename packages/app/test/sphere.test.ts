import { describe, expect, it } from 'vitest'
import { generateSphereMesh } from '../src/geometry/sphere'

describe('generateSphereMesh', () => {
  const radius = 2.5
  const latSegments = 8
  const lonSegments = 12
  const mesh = generateSphereMesh(radius, latSegments, lonSegments)

  it('produces the expected vertex and index counts', () => {
    const expectedVertexCount = (latSegments + 1) * (lonSegments + 1)
    expect(mesh.positions.length).toBe(expectedVertexCount * 3)
    expect(mesh.normals.length).toBe(expectedVertexCount * 3)
    expect(mesh.indices.length).toBe(latSegments * lonSegments * 6)
  })

  it('places every vertex at the given radius from the origin', () => {
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i]
      const y = mesh.positions[i + 1]
      const z = mesh.positions[i + 2]
      const distance = Math.sqrt(x * x + y * y + z * z)
      expect(distance).toBeCloseTo(radius, 5)
    }
  })

  it('gives every vertex a unit-length outward normal', () => {
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const x = mesh.normals[i]
      const y = mesh.normals[i + 1]
      const z = mesh.normals[i + 2]
      const length = Math.sqrt(x * x + y * y + z * z)
      expect(length).toBeCloseTo(1, 5)
    }
  })

  it('keeps position and normal proportional (position = radius * normal)', () => {
    for (let i = 0; i < mesh.positions.length; i++) {
      expect(mesh.positions[i]).toBeCloseTo(radius * mesh.normals[i], 5)
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
