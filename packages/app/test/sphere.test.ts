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
    expect(mesh.uvs.length).toBe(expectedVertexCount * 2)
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

  it('keeps every UV coordinate within [0, 1]', () => {
    for (let i = 0; i < mesh.uvs.length; i++) {
      expect(mesh.uvs[i]).toBeGreaterThanOrEqual(0)
      expect(mesh.uvs[i]).toBeLessThanOrEqual(1)
    }
  })

  it('maps u=1 at the seam start and u=0 at the seam end for every latitude ring', () => {
    for (let lat = 0; lat <= latSegments; lat++) {
      const rowStart = lat * (lonSegments + 1)
      const uAtSeamStart = mesh.uvs[rowStart * 2]
      const uAtSeamEnd = mesh.uvs[(rowStart + lonSegments) * 2]
      expect(uAtSeamStart).toBe(1)
      expect(uAtSeamEnd).toBe(0)
    }
  })

  it('maps textures un-mirrored: east (increasing u) x north (decreasing v) points outward', () => {
    // A map seen from outside the globe has east to the right of north, i.e. east x north = the
    // outward normal. The opposite sign is a mirror image (continents flipped east-west).
    const vertex = (lat: number, lon: number) => {
      const i = lat * (lonSegments + 1) + lon
      return {
        p: [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]],
        u: mesh.uvs[i * 2],
        v: mesh.uvs[i * 2 + 1],
      }
    }
    for (const lat of [2, 4, 6]) {
      for (let lon = 1; lon < lonSegments - 1; lon++) {
        const here = vertex(lat, lon)
        const next = vertex(lat, lon + 1)
        const above = vertex(lat - 1, lon)
        const sign = Math.sign(next.u - here.u)
        const east = [0, 1, 2].map((k) => sign * (next.p[k] - here.p[k]))
        const north = [0, 1, 2].map((k) => above.p[k] - here.p[k])
        expect(above.v).toBeLessThan(here.v)
        const cross = [
          east[1] * north[2] - east[2] * north[1],
          east[2] * north[0] - east[0] * north[2],
          east[0] * north[1] - east[1] * north[0],
        ]
        expect(cross[0] * here.p[0] + cross[1] * here.p[1] + cross[2] * here.p[2]).toBeGreaterThan(0)
      }
    }
  })

  it('puts the central meridian (u=0.5, longitude 0) on local -Y', () => {
    const equatorRow = (latSegments / 2) * (lonSegments + 1)
    const lon = lonSegments / 2
    const i = equatorRow + lon
    expect(mesh.uvs[i * 2]).toBeCloseTo(0.5, 10)
    expect(mesh.positions[i * 3] / radius).toBeCloseTo(0, 10)
    expect(mesh.positions[i * 3 + 1] / radius).toBeCloseTo(-1, 10)
    expect(mesh.positions[i * 3 + 2] / radius).toBeCloseTo(0, 10)
  })

  it('maps v=0 at the north pole and v=1 at the south pole', () => {
    for (let lon = 0; lon <= lonSegments; lon++) {
      const northPoleV = mesh.uvs[lon * 2 + 1]
      const southPoleRowStart = latSegments * (lonSegments + 1)
      const southPoleV = mesh.uvs[(southPoleRowStart + lon) * 2 + 1]
      expect(northPoleV).toBe(0)
      expect(southPoleV).toBe(1)
    }
  })
})

describe('generateSphereMesh production call site', () => {
  it('main.ts uses at least 64 segments per axis for a visibly round silhouette', async () => {
    const mainSource = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf-8'),
    )
    const match = mainSource.match(/generateSphereMesh\(1,\s*(\d+),\s*(\d+)\)/)
    expect(match).not.toBeNull()
    const [, latSegments, lonSegments] = match!
    expect(Number(latSegments)).toBeGreaterThanOrEqual(64)
    expect(Number(lonSegments)).toBeGreaterThanOrEqual(64)
  })
})
