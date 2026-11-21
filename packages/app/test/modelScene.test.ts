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

describe('ModelScene with a hinged part', () => {
  // The dish folds a quarter turn about the vertical line through the origin.
  const hinged = {
    assemblies: [{ id: 'dish', explode: [0, 0, 0], hinge: { pivot: [0, 0, 0], axis: [0, 1, 0], angle: Math.PI / 2 } }, { id: 'bus', explode: [0, 0, 0] }],
    anchors: { dish: [3, 0, 0], bus: [0, 0, 0] },
  } as unknown as ModelDescription
  const still = { ...OPTIONS, startAngle: 0 }

  it('eases the fold to the chapter, and back out when the next chapter does not fold', () => {
    const model = new ModelScene<Part>(renderer, hinged, still)
    model.start({ still: true })
    model.show({ fold: 1, still: true }, false)
    model.update(2, false)
    // Turned a quarter about +Y, the point on +X goes to -Z, and its label with it.
    const [x, , z] = model.anchor('dish')
    expect(x).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(-3, 6)
    model.show({ still: true }, false)
    model.update(2, false)
    expect(model.anchor('dish')[0]).toBeCloseTo(3, 6)
  })
})
