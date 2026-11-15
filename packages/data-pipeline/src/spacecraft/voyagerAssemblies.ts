import { pieceCenter, pieceExtents, type MeshPiece } from './meshParts'

// The assemblies Voyager is taken apart into in the deep-dive lesson, and the points its labels
// point at. Coordinates are NASA's model after its node transform: metres, +Y along the dish's axis
// (toward Earth), the magnetometer boom reaching out along +Y/+Z, the RTG boom along +Z and the
// science boom (cameras and spectrometers) along -Z.
export const VOYAGER_ASSEMBLIES = ['bus', 'dish', 'rtg', 'science', 'magnetometer', 'record'] as const
export type VoyagerAssembly = (typeof VOYAGER_ASSEMBLIES)[number]

// How far each assembly moves out in the exploded view, in metres.
export const EXPLODE_OFFSETS: Record<VoyagerAssembly, [number, number, number]> = {
  bus: [0, 0, 0],
  dish: [0, 2.2, 0],
  rtg: [0, -0.4, 2.4],
  science: [0, -0.4, -2.4],
  magnetometer: [0, 1.6, 1.6],
  record: [0, 0, 0], // set from its place on the bus (see recordExplodeOffset)
}

// The dish and the bus's top ring share a texture; the dish sits above this height.
const DISH_MIN_HEIGHT = 0.9
// The magnetometer boom is the one piece longer than this.
const MAGNETOMETER_MIN_LENGTH = 4.8
// The RTG boom: out along +Z, below the bus's top; the science boom: out along -Z.
const RTG_MIN_Z = 1.9
const RTG_MAX_HEIGHT = 0.55
const SCIENCE_MAX_Z = -1.2
// Pieces of the main texture above the bus belong to the dish (its feed and struts) - or, further
// out, to the magnetometer boom (its sensors and canister).
const DISH_PARTS_MIN_HEIGHT = 1.65
const DISH_PARTS_MAX_Z = 1.5
// The Golden Record's photo in the main texture: its middle (u, v), and how near to it a piece's
// mean texture coordinate must be to show the record (other pieces use the photo's dark border).
const RECORD_UV_MIDDLE = [0.117, 0.277]
const RECORD_UV_REACH = 0.04

const DISH_TEXTURE = 'tex_02_AO.png'

export function assemblyOf(piece: MeshPiece, texture: string): VoyagerAssembly {
  const [, y] = pieceCenter(piece)
  if (texture === DISH_TEXTURE) return y > DISH_MIN_HEIGHT ? 'dish' : 'bus'
  if (pieceExtents(piece)[0] > MAGNETOMETER_MIN_LENGTH) return 'magnetometer'
  if (showsRecordPhoto(piece.meanUv)) return 'record'
  return byPlace(pieceCenter(piece))
}

// A piece of the main texture by where it sits: out on a boom, above the bus, or on it.
function byPlace([, y, z]: [number, number, number]): VoyagerAssembly {
  if (z > RTG_MIN_Z && y < RTG_MAX_HEIGHT) return 'rtg'
  if (z < SCIENCE_MAX_Z) return 'science'
  if (y < DISH_PARTS_MIN_HEIGHT) return 'bus'
  return Math.abs(z) < DISH_PARTS_MAX_Z ? 'dish' : 'magnetometer'
}

function showsRecordPhoto([u, v]: [number, number]): boolean {
  return Math.hypot(u - RECORD_UV_MIDDLE[0], v - RECORD_UV_MIDDLE[1]) < RECORD_UV_REACH
}

// The record moves straight out from the side of the bus it is mounted on.
export function recordExplodeOffset(recordCenter: [number, number, number]): [number, number, number] {
  const outward = Math.hypot(recordCenter[0], recordCenter[2]) || 1
  const distance = 1.6
  return [(recordCenter[0] / outward) * distance, 0, (recordCenter[2] / outward) * distance]
}

export interface AssemblyBox {
  min: [number, number, number]
  max: [number, number, number]
}

// The point each label points at: an assembly's middle, the dish's top, the magnetometer boom's
// far end (its outboard sensor).
export function labelAnchor(assembly: VoyagerAssembly, box: AssemblyBox): [number, number, number] {
  const middle = [0, 1, 2].map((axis) => (box.min[axis] + box.max[axis]) / 2) as [number, number, number]
  if (assembly === 'dish') return [middle[0], box.max[1], middle[2]]
  if (assembly === 'magnetometer') return [middle[0], box.max[1], box.max[2]]
  return middle
}
