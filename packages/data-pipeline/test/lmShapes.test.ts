import { describe, expect, it } from 'vitest'
import { laidAlongZ, polygon, prism, type Swatch } from '../src/apollo/lmShapes'
import type { MeshPrimitive } from '../src/spacecraft/glbMesh'
import { lmParts } from '../src/apollo/lmParts'

const LOOK: Swatch = { texture: 'palette.png', uv: [0.5, 0.5] }

// For every triangle: whether its corners run counter-clockwise seen from where its normal points
// (the renderer's front face) - the cross product of its edges points along its normal.
function windingsAgree({ positions, normals, indices }: MeshPrimitive): boolean {
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]].map((i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]])
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const i = indices[t] * 3
    // A triangle with no area (where a lathe meets its axis) faces nowhere.
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) continue
    if (n[0] * normals[i] + n[1] * normals[i + 1] + n[2] * normals[i + 2] <= 0) return false
  }
  return true
}

describe('the lunar module\'s shapes', () => {
  it('build a prism whose faces are turned the way their normals point', () => {
    expect(windingsAgree(prism(polygon(8, 1), 0, 2, LOOK))).toBe(true)
  })

  it('keep that when laid along +Z (a mirror would turn every face inside out)', () => {
    expect(windingsAgree(laidAlongZ(prism(polygon(8, 1), 0, 2, LOOK), [0, 3, 0]))).toBe(true)
  })

  it('turns every face of both stages\' shells outward (a shell seen from behind is drawn dark)', () => {
    const parts = lmParts()
    for (const shell of ['descent', 'ascent'] as const) for (const [index, primitive] of (parts.get(shell) ?? []).entries()) expect(windingsAgree(primitive), `${shell} #${index}`).toBe(true)
  })
})
