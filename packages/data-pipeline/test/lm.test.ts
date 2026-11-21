import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { letterPath } from '../src/apollo/blockLetters'
import { flagLettering, foilTexture, plaqueTexture, PLAQUE_TEXT } from '../src/apollo/lmTextures'
import { applyHinge, hingeMatrix } from '../../app/src/spacecraft/modelHinge'
import { LM_ASSEMBLIES, lmAssemblyKind, lmHinge, lmParts } from '../src/apollo/lmParts'
import { ASCENT_STAGE, DESCENT_STAGE, FOOTPAD, LEGS, legHinge, LM_HEIGHTS, PROBE_LENGTH } from '../src/apollo/lmProfile'

const FT = 0.3048
const IN = 0.0254

describe('the lunar module', () => {
  it('has the News Reference sizes: 22 ft 11 in tall, 31 ft across the gear, both stages 14 ft 1 in wide', () => {
    expect(LM_HEIGHTS.overall).toBeCloseTo(22 * FT + 11 * IN, 3)
    expect(LM_HEIGHTS.ascentTop - LM_HEIGHTS.interstage).toBeCloseTo(12 * FT + 4 * IN, 3)
    expect(LM_HEIGHTS.interstage).toBeCloseTo(10 * FT + 7 * IN, 3)
    expect(DESCENT_STAGE.width).toBeCloseTo(14 * FT + 1 * IN, 3)
    expect(ASCENT_STAGE.width).toBeCloseTo(14 * FT + 1 * IN, 3)
  })

  it('stands on four 37 in footpads, 31 ft across from edge to edge', () => {
    expect(LEGS).toHaveLength(4)
    expect(FOOTPAD.radius * 2).toBeCloseTo(37 * IN, 3)
    const [front, , back] = LEGS
    const across = Math.hypot(front.footpad[0] - back.footpad[0], front.footpad[2] - back.footpad[2]) + FOOTPAD.radius * 2
    expect(across).toBeCloseTo(31 * FT, 2)
    for (const leg of LEGS) expect(leg.footpad[1]).toBeCloseTo(0, 6)
  })

  it('has its probes about 5 ft long on three legs - none on the ladder leg in front (+Z)', () => {
    expect(PROBE_LENGTH).toBeCloseTo(5 * FT, 3)
    expect(LEGS.filter((leg) => leg.probe).map((leg) => leg.azimuthDegrees)).toEqual([90, 180, 270])
    expect(LEGS[0].azimuthDegrees).toBe(0)
  })

  it('folds each leg up beside the stages, inside the adapter (6.6 m across) and lower than the top', () => {
    for (const leg of LEGS) {
      const folded = applyHinge(hingeMatrix(legHinge(leg), 1), leg.footpad)
      expect(Math.hypot(folded[0], folded[2]) + FOOTPAD.radius, `leg at ${leg.azimuthDegrees}°`).toBeLessThan(3.3)
      expect(folded[1]).toBeGreaterThan(LM_HEIGHTS.interstage)
      expect(folded[1]).toBeLessThan(LM_HEIGHTS.overall)
    }
  })
})

describe("Eagle's textures", () => {
  it('crinkles its foil the same way every time, gold where gold', async () => {
    const foil = await foilTexture(1, 'gold')
    const { width, height } = await sharp(foil).metadata()
    expect([width, height]).toEqual([2048, 2048])
    expect((await foilTexture(1, 'gold')).equals(foil)).toBe(true)
    const [r, g, b] = (await sharp(foil).stats()).channels.map((channel) => channel.mean)
    expect(r).toBeGreaterThan(130)
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
  }, 30000)

  it('writes the plaque in our own block letters, wider than tall, without signatures', async () => {
    for (const letter of PLAQUE_TEXT.join(' ')) expect(() => letterPath(letter)).not.toThrow()
    expect(PLAQUE_TEXT.join(' ')).toContain('WE CAME IN PEACE FOR ALL MANKIND')
    const { width, height } = await sharp(await plaqueTexture()).metadata()
    expect(width).toBeGreaterThan(height ?? 0)
  })

  it('puts the flag and "UNITED STATES" on the foil', async () => {
    const { width, height } = await sharp(await flagLettering()).metadata()
    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(width ?? 0)
  }, 30000)
})

describe("Eagle's parts", () => {
  const parts = lmParts()
  const points = (assembly: (typeof LM_ASSEMBLIES)[number]) => (parts.get(assembly) ?? []).flatMap(({ positions }) => Array.from({ length: positions.length / 3 }, (_, i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]] as [number, number, number]))

  it('builds every assembly but the cockpit, at most 16 in all', () => {
    expect(LM_ASSEMBLIES.length).toBeLessThanOrEqual(16)
    expect([...parts.keys()].sort()).toEqual(LM_ASSEMBLIES.filter((assembly) => assembly !== 'cockpit').sort())
    expect(LM_ASSEMBLIES.filter((assembly) => lmAssemblyKind(assembly) === 'shell')).toEqual(['descent', 'ascent'])
  })

  it('stands 22 ft 11 in to the tip of its VHF antenna, its probes reaching 5 ft below the footpads', () => {
    const heights = [...parts.keys()].flatMap(points).map(([, y]) => y)
    expect(Math.max(...heights)).toBeCloseTo(LM_HEIGHTS.overall, 1)
    expect(Math.min(...points('deployed').map(([, y]) => y))).toBeCloseTo(-PROBE_LENGTH, 2)
    expect(Math.min(...points('descent').map(([, y]) => y))).toBeGreaterThan(0.5)
  })

  it('keeps the ascent stage above the interstage', () => {
    expect(Math.min(...points('ascent').map(([, y]) => y))).toBeGreaterThan(LM_HEIGHTS.interstage - 0.05)
  })

  it('folds every leg, ladder and all, inside the adapter', () => {
    for (const leg of ['leg0', 'leg1', 'leg2', 'leg3'] as const) {
      const hinge = lmHinge(leg)
      expect(hinge, leg).toBeDefined()
      const folded = hingeMatrix(hinge, 1)
      for (const point of points(leg)) expect(Math.hypot(...[applyHinge(folded, point)[0], applyHinge(folded, point)[2]]), leg).toBeLessThan(3.3)
    }
    expect(lmHinge('descent')).toBeUndefined()
  })
})
