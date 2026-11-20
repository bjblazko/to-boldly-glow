import { describe, expect, it } from 'vitest'
import { letterPath } from '../src/apollo/blockLetters'
import { latheMesh, mergePrimitives } from '../src/apollo/latheMesh'
import { assemblyKind, explodeOffset, SATURN_V_ASSEMBLIES, saturnVParts } from '../src/apollo/saturnVParts'
import { ENGINES, HEIGHTS, SII_INTERSTAGE, SIVB_INTERSTAGE, STAGE_RADIUS, TOTAL_HEIGHT, UPPER_RADIUS } from '../src/apollo/saturnVProfile'
import { tankProfile } from '../src/apollo/shapes'

const uv = (): [number, number] => [0, 0]

// The face normal of each triangle, from its winding (counter-clockwise seen from the front).
function faceNormals({ positions, indices }: { positions: Float32Array; indices: Uint32Array }): { centre: number[]; normal: number[] }[] {
  const vertex = (index: number) => [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]]
  const faces = []
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    const [a, b, c] = [vertex(indices[triangle]), vertex(indices[triangle + 1]), vertex(indices[triangle + 2])]
    const u = b.map((value, axis) => value - a[axis])
    const v = c.map((value, axis) => value - a[axis])
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    faces.push({ centre: a.map((value, axis) => (value + b[axis] + c[axis]) / 3), normal })
  }
  return faces.filter(({ normal }) => Math.hypot(...normal) > 1e-9)
}

describe('latheMesh', () => {
  const cylinder = latheMesh([[0, 0], [2, 0], [2, 5], [0, 5]], { texture: 't', uv, segments: 16, sharp: true })

  it('sweeps the profile all the way around', () => {
    let maxRadius = 0
    for (let index = 0; index < cylinder.positions.length; index += 3) maxRadius = Math.max(maxRadius, Math.hypot(cylinder.positions[index], cylinder.positions[index + 2]))
    expect(maxRadius).toBeCloseTo(2, 5)
  })

  it('winds every face of a closed body outward', () => {
    for (const { centre, normal } of faceNormals(cylinder)) {
      const outward = [centre[0], centre[1] - 2.5, centre[2]]
      expect(normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2]).toBeGreaterThan(0)
    }
  })

  it('gives vertex normals of unit length pointing the same way as the faces', () => {
    for (let index = 0; index < cylinder.normals.length; index += 3) expect(Math.hypot(cylinder.normals[index], cylinder.normals[index + 1], cylinder.normals[index + 2])).toBeCloseTo(1, 5)
  })

  it('offsets indices when merging', () => {
    const merged = mergePrimitives([cylinder, cylinder])
    expect(merged.positions.length).toBe(cylinder.positions.length * 2)
    expect(Math.max(...merged.indices)).toBe(cylinder.positions.length / 3 * 2 - 1)
  })
})

describe('tankProfile', () => {
  it('reaches from the bottom of the lower dome to the top of the upper one', () => {
    const profile = tankProfile({ radius: 5, bottom: 10, top: 20, lowerDome: 3, upperDome: 2 })
    const heights = profile.map(([, height]) => height)
    expect(Math.min(...heights)).toBeCloseTo(7)
    expect(Math.max(...heights)).toBeCloseTo(22)
    expect(profile[0][0]).toBeCloseTo(0)
    expect(profile.at(-1)![0]).toBeCloseTo(0)
  })
})

describe('the Saturn V', () => {
  const parts = saturnVParts()
  const all = [...parts.values()].flat()
  const coordinates = (axis: number) => all.flatMap((primitive) => [...primitive.positions].filter((_, index) => index % 3 === axis))

  it('stands 363 ft (110.6 m) tall', () => {
    expect(Math.max(...coordinates(1))).toBeCloseTo(TOTAL_HEIGHT, 2)
    expect(TOTAL_HEIGHT).toBeCloseTo(110.64, 2)
  })

  it('is 33 ft (10.06 m) across the S-IC and S-II, 21 ft 8 in (6.6 m) across the S-IVB', () => {
    expect(STAGE_RADIUS * 2).toBeCloseTo(10.06, 2)
    expect(UPPER_RADIUS * 2).toBeCloseTo(6.6, 2)
  })

  it('stacks the stages at their News Reference heights', () => {
    expect(HEIGHTS.sicTop).toBeCloseTo(42.06, 2)
    expect(HEIGHTS.siiTop - HEIGHTS.sicTop).toBeCloseTo(24.87, 2)
    expect(HEIGHTS.sivbTop - HEIGHTS.siiTop).toBeCloseTo(17.86, 2)
    expect(HEIGHTS.cmTop).toBeLessThan(TOTAL_HEIGHT)
  })

  it('places the interstages between the separation planes of the Flight Manual', () => {
    expect(SII_INTERSTAGE).toBeCloseTo(4.98, 2) // stations 1564 to 1760 in
    expect(HEIGHTS.siiTop + SIVB_INTERSTAGE - HEIGHTS.sicTop).toBeCloseTo((2746.5 - 1564) * 0.0254, 3)
  })

  it('fits the J-2s of each upper stage inside the interstage below it', () => {
    const j2Height = 11 * 0.3048 + 0.0254
    expect(ENGINES.sii.exit + j2Height).toBeLessThan(HEIGHTS.sicTop + SII_INTERSTAGE)
    expect(ENGINES.sivb.exit + j2Height).toBeLessThan(HEIGHTS.siiTop + SIVB_INTERSTAGE)
  })

  it('builds every assembly, no more than the renderer takes', () => {
    expect([...parts.keys()].sort()).toEqual([...SATURN_V_ASSEMBLIES].sort())
    expect(SATURN_V_ASSEMBLIES.length).toBeLessThanOrEqual(16)
  })

  it('cuts open the stages and the SLA, and shows what is inside them only then', () => {
    expect(SATURN_V_ASSEMBLIES.filter((assembly) => assemblyKind(assembly) === 'shell')).toEqual(['sla', 'sivb', 'sii', 'sic'])
    expect(SATURN_V_ASSEMBLIES.filter((assembly) => assemblyKind(assembly) === 'inside')).toEqual(['sivbInside', 'siiInside', 'sicInside'])
  })

  it('takes the stack apart upward, each part at least as far as the one below', () => {
    const order = ['sic', 'sii', 'sivb', 'iu', 'sla', 'lm', 'sm', 'cm', 'les'] as const
    const rises = order.map((assembly) => explodeOffset(assembly)[1])
    expect(rises).toEqual([...rises].sort((a, b) => a - b))
  })
})

describe('the block letters', () => {
  it('draw every letter of the lettering, and refuse one they lack', () => {
    for (const letter of 'UNITEDSTATES') expect(letterPath(letter)).toMatch(/^M/)
    expect(letterPath(' ')).toBe('')
    expect(() => letterPath('Q')).toThrow()
  })
})
