import type { Vec3 } from '../math/tuples'
import { MODEL_VERTEX_FLOATS, type ModelData } from './modelFile'

// The model's triangles sorted into a grid of cubes, so a short move (a step through a cabin) tests
// only the few triangles near it instead of all of them. Built once, in the model's own frame, with
// every assembly where it rests.

const CELL = 0.1

export class TriangleGrid {
  private readonly cells = new Map<string, number[]>()

  constructor({ vertices, indices }: ModelData) {
    for (let t = 0; t < indices.length; t += 3) {
      const lo: Vec3 = [Infinity, Infinity, Infinity]
      const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
      for (let k = 0; k < 3; k++) {
        const o = indices[t + k] * MODEL_VERTEX_FLOATS
        for (let axis = 0; axis < 3; axis++) {
          lo[axis] = Math.min(lo[axis], vertices[o + axis])
          hi[axis] = Math.max(hi[axis], vertices[o + axis])
        }
      }
      this.eachCell(lo, hi, (key) => {
        const cell = this.cells.get(key)
        if (cell) cell.push(t)
        else this.cells.set(key, [t])
      })
    }
  }

  // The triangles (index of their first corner) whose cells overlap the box.
  near(lo: Vec3, hi: Vec3): number[] {
    const found = new Set<number>()
    this.eachCell(lo, hi, (key) => this.cells.get(key)?.forEach((t) => found.add(t)))
    return [...found]
  }

  private eachCell(lo: Vec3, hi: Vec3, visit: (key: string) => void): void {
    const [x0, y0, z0] = lo.map((value) => Math.floor(value / CELL))
    const [x1, y1, z1] = hi.map((value) => Math.floor(value / CELL))
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) visit(`${x},${y},${z}`)
  }
}
