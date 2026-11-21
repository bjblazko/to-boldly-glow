import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { ModelDescription } from '../../app/src/spacecraft/modelFile'
import { buildEagle } from '../src/buildEagle'

describe('buildEagle', () => {
  const out = mkdtempSync(join(tmpdir(), 'eagle-'))
  afterAll(() => rmSync(out, { recursive: true, force: true }))

  it('writes the model with its folding legs, its labelled parts and every texture it draws with', async () => {
    await buildEagle(out)
    const model = JSON.parse(readFileSync(join(out, 'lm.json'), 'utf8')) as ModelDescription
    expect(model.assemblies).toHaveLength(14)
    expect(model.assemblies.filter((assembly) => assembly.hinge).map((assembly) => assembly.id)).toEqual(['leg0', 'leg1', 'leg2', 'leg3'])
    for (const name of ['panels', 'dsky', 'windows', 'ascent', 'descent']) expect(model.anchors[name], name).toBeDefined()
    for (const { texture } of model.draws) expect(existsSync(join(out, texture)), texture).toBe(true)
    expect(model.marks).toEqual({ descent: expect.any(Number), ascent: expect.any(Number) })
  }, 120000)
})
