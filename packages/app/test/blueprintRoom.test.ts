import { describe, expect, it } from 'vitest'
import { roomVertices } from '../src/learn/vehicle/blueprintRoom'
import { BLUEPRINT_VERTEX_FLOATS } from '../src/learn/vehicle/blueprintRoomShader'

const ROOM_HALF_WIDTH = 32
const room = { facing: { toward: [1, 0, 0] as [number, number, number], right: [0, 0, 1] as [number, number, number] }, size: { halfWidth: ROOM_HALF_WIDTH, height: 120, minor: 5, major: 10 } }

// Each triangle's corners, and its face normal from its winding.
function triangles(vertices: Float32Array) {
  const point = (index: number) => [0, 1, 2].map((axis) => vertices[index * BLUEPRINT_VERTEX_FLOATS + axis])
  return Array.from({ length: vertices.length / BLUEPRINT_VERTEX_FLOATS / 3 }, (_, triangle) => {
    const [a, b, c] = [0, 1, 2].map((corner) => point(triangle * 3 + corner))
    const u = b.map((value, axis) => value - a[axis])
    const v = c.map((value, axis) => value - a[axis])
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    return { centre: a.map((value, axis) => (value + b[axis] + c[axis]) / 3), normal }
  })
}

describe('the blueprint room', () => {
  it('is a floor, a back wall and a left wall: six triangles', () => {
    expect(triangles(roomVertices(room))).toHaveLength(6)
  })

  it('turns every face toward the inside of the box, so it hides from behind', () => {
    const inside = [0, 30, 0]
    for (const { centre, normal } of triangles(roomVertices(room))) {
      const toInside = inside.map((value, axis) => value - centre[axis])
      expect(normal[0] * toInside[0] + normal[1] * toInside[1] + normal[2] * toInside[2]).toBeGreaterThan(0)
    }
  })

  it('puts the walls behind the rocket and on its left, as the camera sees it', () => {
    const walls = triangles(roomVertices(room)).filter(({ normal }) => Math.abs(normal[1]) < 1e-6)
    const backs = walls.filter(({ centre }) => Math.abs(centre[0] + ROOM_HALF_WIDTH) < 1e-6)
    const lefts = walls.filter(({ centre }) => Math.abs(centre[2] + ROOM_HALF_WIDTH) < 1e-6)
    expect([backs.length, lefts.length]).toEqual([2, 2])
  })
})
