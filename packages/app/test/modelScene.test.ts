import { describe, expect, it } from 'vitest'
import type { Viewpoint } from '../src/camera/viewpoint'
import type { ModelDescription } from '../src/spacecraft/modelFile'
import type { ModelRenderer } from '../src/spacecraft/modelRenderer'
import { ModelScene } from '../src/spacecraft/modelScene'

type Part = 'dish' | 'bus'
const model = {
  assemblies: [{ id: 'dish', explode: [0, 2, 0] }, { id: 'bus', explode: [0, 0, 0] }],
  anchors: { dish: [3, 0, 0], bus: [0, 0, 0] },
} as unknown as ModelDescription
const OPTIONS = { secondsPerTurn: 90, startAngle: -0.5, stageSeconds: 1 }
const renderer = { update: () => {} } as unknown as ModelRenderer

function scene(): ModelScene<Part> {
  return new ModelScene<Part>(renderer, model, OPTIONS)
}

describe('ModelScene', () => {
  it('turns by itself, and holds still while the user looks around', () => {
    const model = scene()
    model.start({})
    const start = model.anchor('dish')
    model.update(1, false)
    expect(model.anchor('dish')).toEqual(start)
    model.update(1)
    expect(model.anchor('dish')).not.toEqual(start)
  })

  it('turns its cut quarter (between +X and +Z) toward the camera while cut open', () => {
    const model = scene()
    model.start({ cut: 1 })
    const camera = [0, 0, 50] // on +Z
    model.prepare({ position: camera } as unknown as Viewpoint)
    for (let frame = 0; frame < 200; frame++) model.update(0.05)
    // The point on +X, turned so the quarter's middle faces +Z, ends up 45° off to the side.
    const [x, , z] = model.anchor('dish')
    expect(Math.atan2(x, z)).toBeCloseTo(Math.PI / 4, 2)
  })

  it('fades out the parts thrown off, then no longer labels them', () => {
    const model = scene()
    model.start({})
    expect(model.isShown('dish')).toBe(true)
    model.show({ gone: ['dish'] }, false)
    model.update(2)
    expect(model.isShown('dish')).toBe(false)
    expect(model.isShown('bus')).toBe(true)
  })
})
