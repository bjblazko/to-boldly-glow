import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyHinge, hingeMatrix } from '../../app/src/spacecraft/modelHinge'
import { MODEL_VERTEX_FLOATS, readModelBinary, type ModelDescription } from '../../app/src/spacecraft/modelFile'

// The launcher the app ships (packages/app/public/models/launcher, built by buildLauncher.ts).
const DIR = join(__dirname, '../../app/public/models/launcher')
const description = JSON.parse(readFileSync(join(DIR, 'launcher.json'), 'utf8')) as ModelDescription
const binary = readFileSync(join(DIR, 'launcher.bin'))
const model = readModelBinary(description, binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength))

// How close an assembly comes to the rocket's axis (metres), folded or not.
function nearest(id: string, fold: number): number {
  const index = description.assemblies.findIndex((assembly) => assembly.id === id)
  const turn = hingeMatrix(description.assemblies[index].hinge, fold)
  let near = Infinity
  for (let i = 0; i < description.vertexCount; i++) {
    const o = i * MODEL_VERTEX_FLOATS
    if (model.vertices[o + 8] !== index) continue
    const [x, , z] = applyHinge(turn, [model.vertices[o], model.vertices[o + 1], model.vertices[o + 2]])
    near = Math.min(near, Math.hypot(x, z))
  }
  return near
}

describe('the shipped launcher', () => {
  it('has its arms reach the rocket (5 m round its axis), and swing well clear of it when folded', () => {
    for (const arm of ['serviceArms', 'intertankArm', 'crewArm']) {
      expect(nearest(arm, 0), arm).toBeLessThan(6)
      expect(nearest(arm, 1), arm).toBeGreaterThan(7)
    }
  })
})

// An assembly's extent along an axis, folded or not.
function extent(id: string, fold: number, axis: number): [number, number] {
  const index = description.assemblies.findIndex((assembly) => assembly.id === id)
  const turn = hingeMatrix(description.assemblies[index].hinge, fold)
  let [low, high] = [Infinity, -Infinity]
  for (let i = 0; i < description.vertexCount; i++) {
    const o = i * MODEL_VERTEX_FLOATS
    if (model.vertices[o + 8] !== index) continue
    const value = applyHinge(turn, [model.vertices[o], model.vertices[o + 1], model.vertices[o + 2]])[axis]
    ;[low, high] = [Math.min(low, value), Math.max(high, value)]
  }
  return [low, high]
}

describe('the shipped launcher, its parts in place', () => {
  it("brings the crew access arm to the command module (our Saturn V's 98.76-101.99 m above its base, on the deck)", () => {
    const deck = description.marks?.deck ?? 0
    const [low, high] = extent('crewArm', 0, 1)
    const middle = (low + high) / 2
    // The rocket stands with its first stage's base (3.0 m above its engines' exits) on the deck.
    expect(middle).toBeGreaterThan(deck - 3.0 + 98.76)
    expect(middle).toBeLessThan(deck - 3.0 + 101.99)
  })

  it('folds the tail service masts and the damper arm up, and opens the masts\' covers', () => {
    for (const id of ['mast1', 'mast2', 'mast3', 'damperArm']) expect(extent(id, 1, 1)[1], id).toBeGreaterThan(extent(id, 0, 1)[1])
    // The covers turn about their top edges: they move, their top stays.
    const moved = (id: string) => [0, 1, 2].reduce((sum, axis) => sum + Math.abs(extent(id, 1, axis)[0] - extent(id, 0, axis)[0]), 0)
    for (const id of ['cover1', 'cover2', 'cover3']) expect(moved(id), id).toBeGreaterThan(0.3)
  })

  it('lifts everything but the person onto the crawler, by its height', () => {
    const crawler = JSON.parse(readFileSync(join(DIR, 'crawler.json'), 'utf8')) as ModelDescription
    const lift = crawler.bounds.max[1]
    for (const assembly of description.assemblies) expect(assembly.explode[1], assembly.id).toBeCloseTo(assembly.id === 'person' ? 0 : lift, 1)
    // The crawler under the launcher's base (where NASSP attaches it: its body reaches 0.25 m past
    // one edge).
    const [baseX, baseZ] = [extent('launcher', 0, 0), extent('launcher', 0, 2)]
    expect(crawler.bounds.min[0]).toBeGreaterThan(baseX[0] - 0.5)
    expect(crawler.bounds.max[0]).toBeLessThan(baseX[1] + 0.5)
    expect(crawler.bounds.min[2]).toBeGreaterThan(baseZ[0] - 0.5)
    expect(crawler.bounds.max[2]).toBeLessThan(baseZ[1] + 0.5)
  })
})

describe('the slide wire', () => {
  it('runs from the tower’s 98-metre level on its far side from the rocket, some 760 m down and out to the bunker', async () => {
    const { slidewireLine } = await import('../src/apollo/launcherModel')
    // A tower 12 m square standing at x 20 (the rocket on the axis), its foot on a deck 14 m up.
    const { from, to } = slidewireLine({ min: [14, 0, -6], max: [26, 140, 6] }, 14)
    expect(from[1]).toBeCloseTo(14 + 320 * 0.3048, 3)
    expect(from[0]).toBeCloseTo(26, 3)
    expect(Math.hypot(to[0] - from[0], to[2] - from[2])).toBeCloseTo(763, 0)
    expect(to[0]).toBeGreaterThan(from[0])
    expect(to[1]).toBeLessThan(5)
  })
})

describe('the crane on the tower', () => {
  it('is red like the tower, as in the photos of 1969, not the yellow-green of the simulator’s texture', async () => {
    const { craneRed } = await import('../src/apollo/launcherNassp')
    const lime = Uint8Array.of(220, 255, 0, 200, 0, 0, 200, 200, 200)
    expect(Array.from(craneRed(lime))).toEqual([200, 0, 0, 200, 0, 0, 200, 200, 200])
  })
})
