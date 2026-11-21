import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { letterPath } from '../src/apollo/blockLetters'
import { flagLettering, foilTexture, plaqueTexture, PLAQUE_TEXT } from '../src/apollo/lmTextures'
import { applyHinge, hingeMatrix } from '../../app/src/spacecraft/modelHinge'
import { pickModel } from '../../app/src/spacecraft/modelPick'
import type { ModelData } from '../../app/src/spacecraft/modelFile'
import { ASCENT_FRAME } from '../src/apollo/lmAscent'
import { COCKPIT, cockpitParts, cockpitTextures } from '../src/apollo/lmCockpit'
import { swatch } from '../src/apollo/lmParts'
import { COCKPIT_ASSEMBLIES, LM_ASSEMBLIES, type LmAssembly, lmAssemblyKind, lmHinge, lmParts } from '../src/apollo/lmParts'
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
  const points = (assembly: LmAssembly) => (parts.get(assembly) ?? []).flatMap(({ positions }) => Array.from({ length: positions.length / 3 }, (_, i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]] as [number, number, number]))

  it('builds every assembly but the cockpit\'s, at most 16 in all', () => {
    expect(LM_ASSEMBLIES.length).toBeLessThanOrEqual(16)
    expect([...parts.keys()].sort()).toEqual([...LM_ASSEMBLIES].sort())
    expect(LM_ASSEMBLIES.length + COCKPIT_ASSEMBLIES.length).toBeLessThanOrEqual(16)
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

describe("Eagle's cockpit", () => {
  const looks = { wall: swatch('ascent'), floor: swatch('ascentDark'), dark: swatch('black'), glass: swatch('glass'), steel: swatch('steel') }
  const cockpit = [...cockpitParts(looks).values()].flat()
  const corners = cockpit.flatMap(({ positions }) => Array.from({ length: positions.length / 3 }, (_, i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]))

  it('lies inside the crew compartment', () => {
    for (const [x, y, z] of corners) {
      expect(Math.abs(x)).toBeLessThanOrEqual(ASCENT_STAGE.cabinRadius / Math.cos(Math.PI / 8))
      expect(y).toBeGreaterThanOrEqual(ASCENT_STAGE.floor - 0.25)
      expect(y).toBeLessThanOrEqual(ASCENT_FRAME.cabinMiddle + ASCENT_STAGE.cabinRadius)
      expect(z).toBeGreaterThanOrEqual(ASCENT_FRAME.cabinBack - 0.01)
      expect(z).toBeLessThanOrEqual(ASCENT_STAGE.cabinFront + 0.01)
    }
  })

  it('puts a standing crew member\'s eyes about 1.65 m above the floor', () => {
    expect(COCKPIT.eye - COCKPIT.floor).toBeGreaterThanOrEqual(1.55)
    expect(COCKPIT.eye - COCKPIT.floor).toBeLessThanOrEqual(1.75)
  })

  // Every triangle of the cockpit and the ascent stage, as the app's picking sees them.
  const cockpitTriangles = cockpit.reduce((sum, { indices }) => sum + indices.length / 3, 0)
  const model = ((): ModelData => {
    const all = [...cockpit, ...(lmParts().get('ascent') ?? [])]
    const vertices: number[] = []
    const indices: number[] = []
    for (const { positions, indices: own } of all) {
      const first = vertices.length / 9
      for (let i = 0; i < positions.length; i += 3) vertices.push(positions[i], positions[i + 1], positions[i + 2], 0, 1, 0, 0, 0, 0)
      for (const index of own) indices.push(first + index)
    }
    return { description: {} as ModelData['description'], vertices: Float32Array.from(vertices), indices: Uint32Array.from(indices) }
  })()
  const clearance = (from: number[]) => Array.from({ length: 8 }, (_, k) => {
    const angle = (k * Math.PI) / 4
    return pickModel(model, from as [number, number, number], [Math.sin(angle), 0, Math.cos(angle)], { moved: [[0, 0, 0]], shown: () => true, cutAway: () => false }) ?? Infinity
  })

  it('leaves room to turn just inside the hatch, and where each of the crew stood', () => {
    expect(Math.min(...clearance(COCKPIT.hatchInside))).toBeGreaterThanOrEqual(0.3)
    expect(Math.min(...clearance(COCKPIT.commander))).toBeGreaterThanOrEqual(0.25)
    expect(Math.min(...clearance(COCKPIT.pilot))).toBeGreaterThanOrEqual(0.25)
  })

  it('leaves the hatch open to come in through', () => {
    const only = { ...model, indices: model.indices.slice(0, cockpitTriangles * 3) }
    const [from, to] = [COCKPIT.hatchOutside, COCKPIT.hatchInside]
    const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    const direction = [(to[0] - from[0]) / length, (to[1] - from[1]) / length, (to[2] - from[2]) / length] as [number, number, number]
    const hit = pickModel(only, from as [number, number, number], direction, { moved: [[0, 0, 0]], shown: () => true, cutAway: () => false })
    expect(hit === null || hit > length).toBe(true)
  })

  it('draws every panel at about 3,000 pixels per metre', async () => {
    const textures = await cockpitTextures()
    expect([...textures.keys()].sort()).toEqual(['lm-panel-1.jpg', 'lm-panel-11.jpg', 'lm-panel-14.jpg', 'lm-panel-16.jpg', 'lm-panel-2.jpg', 'lm-panel-3.jpg', 'lm-panel-4.jpg', 'lm-panel-8.jpg'])
    expect((await sharp(textures.get('lm-panel-1.jpg')).metadata()).width).toBe(1920)
  }, 60000)
})
