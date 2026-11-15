// A mesh splits into the pieces it was modelled from: triangles that share a vertex - or a vertex
// position, as exporters duplicate vertices along texture seams - belong to the same piece.

export interface MeshPiece {
  // Its triangles, by index into the mesh's index list divided by 3.
  triangles: number[]
  min: [number, number, number]
  max: [number, number, number]
  // Its triangles' mean texture coordinate.
  meanUv: [number, number]
}

// Vertices closer than this (in model units) count as one: seams are exact, distinct parts are not.
const WELD_DECIMALS = 4

export function meshPieces(positions: Float32Array, indices: Uint32Array, uvs: Float32Array): MeshPiece[] {
  const roots = new UnionFind(positions.length / 3)
  weldEqualPositions(positions, roots)
  for (let corner = 0; corner < indices.length; corner += 3) {
    roots.join(indices[corner], indices[corner + 1])
    roots.join(indices[corner], indices[corner + 2])
  }
  const pieces = new Map<number, MeshPiece>()
  for (let triangle = 0; triangle < indices.length / 3; triangle++) {
    const root = roots.find(indices[triangle * 3])
    const piece = pieces.get(root) ?? emptyPiece()
    addTriangle(piece, triangle, { positions, indices, uvs })
    pieces.set(root, piece)
  }
  for (const piece of pieces.values()) piece.meanUv = [piece.meanUv[0] / piece.triangles.length, piece.meanUv[1] / piece.triangles.length]
  return [...pieces.values()]
}

export function pieceCenter(piece: MeshPiece): [number, number, number] {
  return [0, 1, 2].map((axis) => (piece.min[axis] + piece.max[axis]) / 2) as [number, number, number]
}

// Its extent along each axis, longest first.
export function pieceExtents(piece: MeshPiece): number[] {
  return [0, 1, 2].map((axis) => piece.max[axis] - piece.min[axis]).sort((a, b) => b - a)
}

function weldEqualPositions(positions: Float32Array, roots: UnionFind): void {
  const firstAt = new Map<string, number>()
  for (let vertex = 0; vertex < positions.length / 3; vertex++) {
    const key = [0, 1, 2].map((axis) => positions[vertex * 3 + axis].toFixed(WELD_DECIMALS)).join(',')
    const first = firstAt.get(key)
    if (first === undefined) firstAt.set(key, vertex)
    else roots.join(first, vertex)
  }
}

function emptyPiece(): MeshPiece {
  return { triangles: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], meanUv: [0, 0] }
}

function addTriangle(piece: MeshPiece, triangle: number, mesh: { positions: Float32Array; indices: Uint32Array; uvs: Float32Array }): void {
  piece.triangles.push(triangle)
  for (let corner = 0; corner < 3; corner++) {
    const vertex = mesh.indices[triangle * 3 + corner]
    for (let axis = 0; axis < 3; axis++) {
      piece.min[axis] = Math.min(piece.min[axis], mesh.positions[vertex * 3 + axis])
      piece.max[axis] = Math.max(piece.max[axis], mesh.positions[vertex * 3 + axis])
    }
    piece.meanUv[0] += (mesh.uvs[vertex * 2] ?? 0) / 3
    piece.meanUv[1] += (mesh.uvs[vertex * 2 + 1] ?? 0) / 3
  }
}

class UnionFind {
  private readonly parent: Int32Array

  constructor(size: number) {
    this.parent = Int32Array.from({ length: size }, (_, index) => index)
  }

  find(element: number): number {
    let root = element
    while (this.parent[root] !== root) {
      this.parent[root] = this.parent[this.parent[root]]
      root = this.parent[root]
    }
    return root
  }

  join(a: number, b: number): void {
    this.parent[this.find(b)] = this.find(a)
  }
}
