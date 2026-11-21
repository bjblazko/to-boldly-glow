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
