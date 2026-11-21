import { describe, expect, it } from 'vitest'
import { decodeDds } from '../src/spacecraft/ddsImage'
import { readOrbiterMesh } from '../src/spacecraft/orbiterMesh'

// A two-group mesh in Orbiter's text format (MSHX1): a textured triangle and an untextured one.
const MESH = `MSHX1
GROUPS 2
LABEL Hull
MATERIAL 1
TEXTURE 1
GEOM 3 1
0 0 0 0 0 -1 0 0
1 0 0 0 0 -1 1 0
0 1 0 0 0 -1 0 1
0 1 2
LABEL Plain
MATERIAL 2
TEXTURE 0
GEOM 3 1 ; a comment
0 0 1 0 1 0
1 0 1 0 1 0
0 0 2 0 1 0
0 2 1
MATERIALS 2
hull
paint
MATERIAL hull
0.8 0.8 0.8 1
0 0 0 1
0 0 0 1 10
0 0 0 1
MATERIAL paint
1 0.5 0 1
0 0 0 1
0 0 0 1 10
0 0 0 1
TEXTURES 1
ProjectApollo\\goldfoil.dds
`

describe('readOrbiterMesh', () => {
  const mesh = readOrbiterMesh(MESH)

  it('reads each group with its label, material, texture and triangles', () => {
    expect(mesh.groups.map((group) => [group.label, group.material, group.texture, group.indices.length])).toEqual([['Hull', 0, 'ProjectApollo\\goldfoil.dds', 3], ['Plain', 1, null, 3]])
    expect(Array.from(mesh.groups[0].uvs)).toEqual([0, 0, 1, 0, 0, 1])
    expect(mesh.groups[1].uvs).toBeNull()
  })

  it('reads the materials\' diffuse colours', () => {
    expect(mesh.materials.map((material) => material.diffuse)).toEqual([[0.8, 0.8, 0.8, 1], [1, 0.5, 0, 1]])
  })
})

// A 4x4 DXT1 DDS: one block, colour 0 pure red and colour 1 pure blue, every pixel index 0 but the
// last (index 1).
function dxt1(): Buffer {
  const header = Buffer.alloc(128)
  header.write('DDS ', 0, 'ascii')
  header.writeUInt32LE(124, 4)
  header.writeUInt32LE(4, 12) // height
  header.writeUInt32LE(4, 16) // width
  header.writeUInt32LE(32, 76)
  header.writeUInt32LE(4, 80) // DDPF_FOURCC
  header.write('DXT1', 84, 'ascii')
  const block = Buffer.alloc(8)
  block.writeUInt16LE(0xf800, 0) // red
  block.writeUInt16LE(0x001f, 2) // blue
  block.writeUInt32LE(1 << 30, 4) // pixel 15 -> index 1
  return Buffer.concat([header, block])
}

describe('decodeDds', () => {
  it('decodes a DXT1 block into its colours', () => {
    const image = decodeDds(dxt1())
    expect([image.width, image.height]).toEqual([4, 4])
    expect(Array.from(image.rgba.subarray(0, 4))).toEqual([255, 0, 0, 255])
    expect(Array.from(image.rgba.subarray(60, 64))).toEqual([0, 0, 255, 255])
  })
})

// A 2x1 24-bit BMP (bottom-up rows, BGR, rows padded to 4 bytes): red then green.
function bmp(): Buffer {
  const header = Buffer.alloc(54)
  header.write('BM', 0, 'ascii')
  header.writeUInt32LE(54, 10) // pixels at
  header.writeUInt32LE(40, 14)
  header.writeInt32LE(2, 18) // width
  header.writeInt32LE(1, 22) // height
  header.writeUInt16LE(24, 28) // bits per pixel
  return Buffer.concat([header, Buffer.from([0, 0, 255, 0, 255, 0, 0, 0])])
}

describe('decodeDds, given a BMP under a .dds name (as some add-ons ship)', () => {
  it('decodes it all the same', () => {
    const image = decodeDds(bmp())
    expect([image.width, image.height]).toEqual([2, 1])
    expect(Array.from(image.rgba)).toEqual([255, 0, 0, 255, 0, 255, 0, 255])
  })
})
