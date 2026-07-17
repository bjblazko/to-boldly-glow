export interface SphereMesh {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

// Generates a UV sphere: latSegments bands from pole to pole, lonSegments bands around each
// latitude circle. A unit sphere's outward normal at any point equals that point's position
// divided by its radius, so positions and normals share the same generation loop.
export function generateSphereMesh(radius: number, latSegments: number, lonSegments: number): SphereMesh {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  for (let lat = 0; lat <= latSegments; lat++) {
    const theta = (lat * Math.PI) / latSegments
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)

    for (let lon = 0; lon <= lonSegments; lon++) {
      const phi = (lon * 2 * Math.PI) / lonSegments
      const sinPhi = Math.sin(phi)
      const cosPhi = Math.cos(phi)

      const x = cosPhi * sinTheta
      const y = cosTheta
      const z = sinPhi * sinTheta

      positions.push(radius * x, radius * y, radius * z)
      normals.push(x, y, z)
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
    indices: new Uint32Array(indices),
  }
}
