import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { NASSP_COMMIT } from '../src/apollo/nassp'
import type { ModelDescription } from '../../app/src/spacecraft/modelFile'
import { buildEagle } from '../src/buildEagle'

// Building needs NASSP's files (about 100 MB, downloaded once into the pipeline's cache): the test
// runs where they are there already, and is left out where not (a fresh clone, CI).
const NASSP_CACHED = existsSync(join(__dirname, '../cache/nassp', NASSP_COMMIT, 'Meshes/ProjectApollo/LM_VC.msh'))

describe.skipIf(!NASSP_CACHED)('buildEagle', () => {
  const out = mkdtempSync(join(tmpdir(), 'eagle-'))
  afterAll(() => rmSync(out, { recursive: true, force: true }))

  it('writes the outside with its folding legs, and the cockpit apart, each with every texture it draws with', async () => {
    await buildEagle(out)
    const read = (name: string) => JSON.parse(readFileSync(join(out, `${name}.json`), 'utf8')) as ModelDescription
    const [outside, cockpit] = [read('lm'), read('cockpit')]
    expect(outside.assemblies).toHaveLength(10)
    expect(outside.assemblies.filter((assembly) => assembly.hinge).map((assembly) => assembly.id)).toEqual(['leg0', 'leg1', 'leg2', 'leg3'])
    expect(Object.keys(outside.marks ?? {})).toEqual(['descent', 'ascent'])
    expect(cockpit.assemblies.map((assembly) => [assembly.id, assembly.kind, assembly.explode[1]])).toEqual(['cockpit', 'panels', 'dsky', 'windows'].map((id) => [id, 'inside', 2.5]))
    for (const name of ['panels', 'dsky', 'windows']) expect(cockpit.anchors[name], name).toBeDefined()
    for (const { texture } of [...outside.draws, ...cockpit.draws]) expect(existsSync(join(out, texture)), texture).toBe(true)
  }, 600000)
})
