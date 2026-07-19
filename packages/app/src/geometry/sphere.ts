export interface SphereMesh {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint32Array
}

// Generates a UV sphere: latSegments bands from pole to pole, lonSegments bands around each
// latitude circle. A unit sphere's outward normal at any point equals that point's position
// divided by its radius, so positions and normals share the same generation loop.
// The mesh's polar axis is local +Z (theta=0 sits at local +Z, full radius) — this matches
// solarSystem/poleOrientation.ts's axisAlignmentRotation, which maps local +Z onto each body's
// real pole, and the spin rotation (mat4.fromZRotation) applied around local Z.
export function generateSphereMesh(radius: number, latSegments: number, lonSegments: number): SphereMesh {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let lat = 0; lat <= latSegments; lat++) {
    const theta = (lat * Math.PI) / latSegments
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)

    for (let lon = 0; lon <= lonSegments; lon++) {
      const phi = (lon * 2 * Math.PI) / lonSegments
      const sinPhi = Math.sin(phi)
      const cosPhi = Math.cos(phi)

      const x = sinPhi * sinTheta
      const y = cosPhi * sinTheta
      const z = cosTheta

      positions.push(radius * x, radius * y, radius * z)
      normals.push(x, y, z)
      // Standard equirectangular (Plate Carrée) mapping, matching how 2K planet texture images
      // are conventionally laid out: u wraps around longitude, v runs from north pole (v=0, local
      // +Z) to south pole (v=1, local -Z). The seam-duplicate vertices at lon=0/lon=lonSegments
      // (see index buffer below) are exactly what let u run cleanly 0..1 without a wraparound
      // artifact.
      uvs.push(lon / lonSegments, lat / latSegments)
    }
  }

  for (let lat = 0; lat < latSegments; lat++) {
    for (let lon = 0; lon < lonSegments; lon++) {
      const first = lat * (lonSegments + 1) + lon
      const second = first + lonSegments + 1

      indices.push(first, second, first + 1)
      indices.push(second, second + 1, first + 1)
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  }
}
