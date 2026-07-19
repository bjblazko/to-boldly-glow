export interface RingMesh {
  positions: Float32Array
  uvs: Float32Array
  indices: Uint32Array
}

// Generates a flat annulus in the local XY plane (Z=0), inner/outer radius relative to a unit
// sphere radius of 1 — callers scale it the same way generateSphereMesh's unit sphere is scaled,
// so the ring stays proportional to its planet at every "Realistic"/"Explorer" blend position.
// The ring's normal is local +Z, matching generateSphereMesh's polar axis convention, so a ring
// lies flat in its parent body's equatorial plane once the shared tilt rotation is applied.
// UV.u is the radial fraction (0 at the inner edge, 1 at the outer edge) — the ring texture is a
// single radial gradient strip (band pattern by distance, not by angle), so UV.v is left constant;
// any value works since the source texture doesn't vary along its height.
export function generateRingMesh(innerRadius: number, outerRadius: number, angularSegments: number): RingMesh {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= angularSegments; i++) {
    const angle = (i / angularSegments) * 2 * Math.PI
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    positions.push(innerRadius * sin, innerRadius * cos, 0)
    uvs.push(0, 0.5)
    positions.push(outerRadius * sin, outerRadius * cos, 0)
    uvs.push(1, 0.5)
  }

  for (let i = 0; i < angularSegments; i++) {
    const innerA = i * 2
    const outerA = i * 2 + 1
    const innerB = (i + 1) * 2
    const outerB = (i + 1) * 2 + 1
    indices.push(innerA, outerA, innerB)
    indices.push(outerA, outerB, innerB)
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  }
}
