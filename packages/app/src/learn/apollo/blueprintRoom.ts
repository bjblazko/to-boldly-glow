import type { Viewpoint } from '../../camera/viewpoint'
import { createUniformBinding, createVertexBuffer, writeUniforms, type UniformBinding } from '../../gpu/buffers'
import { createScenePipeline } from '../../gpu/scenePipeline'
import type { Vec3 } from '../../math/tuples'
import { BLUEPRINT_UNIFORM_FLOAT_COUNT, BLUEPRINT_VERTEX_FLOATS, blueprintRoomShaderCode } from './blueprintRoomShader'

// The room's size (metres): the floor reaches this far from the rocket's axis each way, the walls
// stand at its left and back edges, this tall.
export const ROOM_HALF_WIDTH = 32
const WALL_HEIGHT = 120

// Which way the room faces: `toward` points from the rocket toward the camera's usual place,
// `right` to the camera's right; the walls stand behind and on the left.
export interface RoomFacing {
  toward: Vec3
  right: Vec3
}

// The vehicle lessons' open blueprint box on black (see blueprintRoomShader.ts).
export class BlueprintRoom {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipelines: { black: GPURenderPipeline; room: GPURenderPipeline },
    private readonly uniforms: UniformBinding,
    private readonly mesh: { buffer: GPUBuffer; vertexCount: number },
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat, facing: RoomFacing): Promise<BlueprintRoom> {
    const [black, room] = await Promise.all([
      createScenePipeline(device, { label: 'blueprint black', code: blueprintRoomShaderCode, format, primitive: { topology: 'triangle-list' }, depth: { write: false, compare: 'always' }, entryPoints: { vertex: 'vsBlack', fragment: 'fsBlack' } }),
      createScenePipeline(device, {
        label: 'blueprint room',
        code: blueprintRoomShaderCode,
        format,
        // Each face is seen from inside the box only: from behind a wall, it gets out of the way.
        primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
        depth: { write: true, compare: 'less' },
        buffers: [{ arrayStride: BLUEPRINT_VERTEX_FLOATS * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x2' }] }],
        entryPoints: { vertex: 'vsRoom', fragment: 'fsRoom' },
      }),
    ])
    const uniforms = createUniformBinding(device, room, { label: 'blueprint room', floatCount: BLUEPRINT_UNIFORM_FLOAT_COUNT })
    const vertices = roomVertices(facing)
    return new BlueprintRoom(device, { black, room }, uniforms, {
      buffer: createVertexBuffer(device, 'blueprint room', vertices),
      vertexCount: vertices.length / BLUEPRINT_VERTEX_FLOATS,
    })
  }

  // `marks`: up to four heights drawn on the walls (metres).
  update(viewpoint: Viewpoint, marks: readonly number[]): void {
    const values = new Float32Array(BLUEPRINT_UNIFORM_FLOAT_COUNT)
    values.set(viewpoint.viewProjection, 0)
    values.set([viewpoint.position[0], viewpoint.position[1], viewpoint.position[2], ROOM_HALF_WIDTH], 16)
    values.set([0, 1, 2, 3].map((index) => marks[index] ?? -1), 20)
    writeUniforms(this.device, this.uniforms, values)
  }

  // Right after the sky: black over it, then the box.
  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.pipelines.black)
    pass.draw(3)
    pass.setPipeline(this.pipelines.room)
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.setVertexBuffer(0, this.mesh.buffer)
    pass.draw(this.mesh.vertexCount)
  }
}

// A point `along` the facing's toward axis, `aside` along its right, at `height`.
function at({ toward, right }: RoomFacing, along: number, aside: number, height: number): Vec3 {
  return [toward[0] * along + right[0] * aside, height, toward[2] * along + right[2] * aside]
}

// The floor, the back wall and the left wall: two triangles each, wound counter-clockwise seen
// from inside the box.
export function roomVertices(facing: RoomFacing): Float32Array {
  const w = ROOM_HALF_WIDTH
  const h = WALL_HEIGHT
  // Corners with their grid places (across, up).
  type Corner = [Vec3, number, number]
  const floor: Corner[] = [[at(facing, -w, -w, 0), -w, -w], [at(facing, w, -w, 0), w, -w], [at(facing, w, w, 0), w, w], [at(facing, -w, w, 0), -w, w]]
  const back: Corner[] = [[at(facing, -w, -w, 0), -w, 0], [at(facing, -w, w, 0), w, 0], [at(facing, -w, w, h), w, h], [at(facing, -w, -w, h), -w, h]]
  const left: Corner[] = [[at(facing, -w, -w, 0), -w, 0], [at(facing, -w, -w, h), -w, h], [at(facing, w, -w, h), w, h], [at(facing, w, -w, 0), w, 0]]
  const inward: Vec3[] = [[0, 1, 0], facing.toward, facing.right]
  return Float32Array.from([floor, back, left].flatMap((corners, face) => quad(corners, inward[face]).flatMap(([point, across, up]) => [...point, across, up])))
}

// Two triangles, turned so their front faces `inward`.
function quad(corners: [Vec3, number, number][], inward: Vec3): [Vec3, number, number][] {
  const [a, b, , d] = corners.map(([point]) => point)
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
  const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const ordered = normal[0] * inward[0] + normal[1] * inward[1] + normal[2] * inward[2] > 0 ? corners : [...corners].reverse()
  return [ordered[0], ordered[1], ordered[2], ordered[0], ordered[2], ordered[3]]
}
