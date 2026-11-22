import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyHinge, hingeMatrix } from '../../app/src/spacecraft/modelHinge'
import { MODEL_VERTEX_FLOATS, readModelBinary, type ModelDescription } from '../../app/src/spacecraft/modelFile'

// The Eagle model the app ships (packages/app/public/models/eagle, built by buildEagle.ts).
const DIR = join(__dirname, '../../app/public/models/eagle')
const description = JSON.parse(readFileSync(join(DIR, 'lm.json'), 'utf8')) as ModelDescription
const binary = readFileSync(join(DIR, 'lm.bin'))
const model = readModelBinary(description, binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength))

describe('the shipped Eagle', () => {
  it('folds each leg up beside the stages, inside the adapter (6.6 m across) and below the top', () => {
    const top = Math.max(...Array.from({ length: description.vertexCount }, (_, i) => model.vertices[i * MODEL_VERTEX_FLOATS + 1]))
    description.assemblies.forEach((assembly, index) => {
      if (!assembly.hinge) return
      const folded = hingeMatrix(assembly.hinge, 1)
      let reach = 0
      let highest = -Infinity
      for (let i = 0; i < description.vertexCount; i++) {
        const o = i * MODEL_VERTEX_FLOATS
        if (model.vertices[o + 8] !== index) continue
        const [x, y, z] = applyHinge(folded, [model.vertices[o], model.vertices[o + 1], model.vertices[o + 2]])
        reach = Math.max(reach, Math.hypot(x, z))
        highest = Math.max(highest, y)
      }
      expect(reach, assembly.id).toBeLessThan(3.3)
      expect(highest, assembly.id).toBeLessThan(top)
    })
    expect(description.assemblies.filter((assembly) => assembly.hinge)).toHaveLength(8)
  })
})
