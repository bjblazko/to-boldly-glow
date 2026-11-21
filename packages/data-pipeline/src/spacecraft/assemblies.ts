import type { ModelDescription } from '../../../app/src/spacecraft/modelFile'
import type { MeshPrimitive } from './glbMesh'
import type { AssignedPrimitive } from './modelWriter'

// Parts built (or read) assembly by assembly, made ready for packModel: each vertex numbered with
// its assembly's place in `order`.
export function assignAssemblies<Assembly extends string>(parts: Map<Assembly, MeshPrimitive[]>, order: readonly Assembly[]): AssignedPrimitive[] {
  return [...parts].flatMap(([assembly, primitives]) =>
    primitives.map((primitive) => ({
      primitive,
      vertexAssembly: new Uint8Array(primitive.positions.length / 3).fill(order.indexOf(assembly)),
      textureFile: primitive.texture,
    })),
  )
}

// Where each assembly's label points: the middle of its bounds - or, `onAxis`, the middle of its
// height on the vertical axis (inside the part whichever way the model has turned).
export function assemblyAnchors<Assembly extends string>(parts: Map<Assembly, MeshPrimitive[]>, onAxis: (assembly: Assembly) => boolean): ModelDescription['anchors'] {
  return Object.fromEntries(
    [...parts].map(([assembly, primitives]) => {
      const [min, max] = bounds(primitives)
      const middle = min.map((value, axis) => (value + max[axis]) / 2) as [number, number, number]
      return [assembly, onAxis(assembly) ? [0, middle[1], 0] : middle]
    }),
  )
}

function bounds(primitives: MeshPrimitive[]): [number[], number[]] {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const { positions } of primitives) {
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], positions[i + axis])
        max[axis] = Math.max(max[axis], positions[i + axis])
      }
    }
  }
  return [min, max]
}
