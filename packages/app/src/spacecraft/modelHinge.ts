import type { Vec3 } from '../math/tuples'

// An assembly that folds about a hinge (the lunar module's legs): it turns about the line through
// `pivot` along `axis` (a unit vector, the model's own frame) by `angle` radians when fully folded.
export interface Hinge {
  pivot: [number, number, number]
  axis: [number, number, number]
  angle: number
}

// The fold as an affine matrix: three rows of [rotation | translation], as the shader takes them.
// No hinge, or not folded: the identity.
export function hingeMatrix(hinge: Hinge | undefined, fold: number): Float32Array {
  const angle = hinge ? hinge.angle * fold : 0
  if (!hinge || angle === 0) return Float32Array.of(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0)
  const [x, y, z] = hinge.axis
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c
  // Rodrigues' rotation matrix, row by row.
  const r = [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ]
  const p = hinge.pivot
  // p' = R (p0 - pivot) + pivot = R p0 + (pivot - R pivot)
  return Float32Array.from(r.flatMap((row, i) => [...row, p[i] - (row[0] * p[0] + row[1] * p[1] + row[2] * p[2])]))
}

export function applyHinge(m: ArrayLike<number>, [x, y, z]: Vec3): Vec3 {
  return [m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]]
}

// The same fold in WGSL, for every shader that draws the model (its picture, its shadow): expects a
// uniform `uni` with `hinges: array<vec4f, 3 * MAX_ASSEMBLIES>`, three rows per assembly. `w` is 1
// for a point and 0 for a direction (a normal: the fold only turns it).
export const HINGE_WGSL = /* wgsl */ `
fn hinged(assembly: i32, p: vec3f, w: f32) -> vec3f {
  let row = assembly * 3;
  let a = uni.hinges[row];
  let b = uni.hinges[row + 1];
  let c = uni.hinges[row + 2];
  return vec3f(dot(a.xyz, p) + a.w * w, dot(b.xyz, p) + b.w * w, dot(c.xyz, p) + c.w * w);
}
`

// Every assembly's fold, packed as the shaders take it (the identity for the slots left over).
export function packHinges(values: Float32Array, at: number, hinges: readonly Float32Array[] | undefined, count: number): void {
  for (let index = 0; index < count; index++) values.set(hinges?.[index] ?? IDENTITY, at + index * 12)
}

const IDENTITY = hingeMatrix(undefined, 0)
