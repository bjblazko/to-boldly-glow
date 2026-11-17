import { describe, expect, it } from 'vitest'
import type { ModelDescription } from '../src/spacecraft/modelFile'
import type { ModelRenderer } from '../src/spacecraft/modelRenderer'
import { ProbeScene } from '../src/learn/voyager/probeScene'
import type { VoyagerPart } from '../src/learn/voyager/voyagerStage'

const part = 'dish' as VoyagerPart
const model = { assemblies: [{ id: part, explode: [0, 0, 0] }], anchors: { [part]: [3, 0, 0] } } as unknown as ModelDescription

describe('ProbeScene', () => {
  it('turns by itself, and holds still while the user looks around', () => {
    const scene = new ProbeScene({} as ModelRenderer, model)
    scene.start({})
    const start = scene.anchor(part)
    scene.update(1, false)
    expect(scene.anchor(part)).toEqual(start)
    scene.update(1)
    expect(scene.anchor(part)).not.toEqual(start)
  })
})
