import { describe, expect, it } from 'vitest'
import { WheelClassifier } from '../src/camera/input/wheelKind'

const wheel = (timeStamp: number, delta: Partial<{ deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean }>) => ({ deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, timeStamp, ...delta })

describe('WheelClassifier', () => {
  it('reads a trackpad pinch (ctrlKey) as a pinch', () => {
    expect(new WheelClassifier().classify(wheel(0, { deltaY: 3, ctrlKey: true }))).toBe('pinch')
  })

  it('zooms on a mouse wheel notch, in pixels or in lines', () => {
    expect(new WheelClassifier().classify(wheel(0, { deltaY: 100 }))).toBe('zoom')
    expect(new WheelClassifier().classify(wheel(0, { deltaY: 3, deltaMode: 1 }))).toBe('zoom')
  })

  it('pans on a trackpad: fractional, sideways or small deltas', () => {
    expect(new WheelClassifier().classify(wheel(0, { deltaY: 2.5 }))).toBe('pan')
    expect(new WheelClassifier().classify(wheel(0, { deltaX: 4 }))).toBe('pan')
    expect(new WheelClassifier().classify(wheel(0, { deltaY: 6 }))).toBe('pan')
  })

  it('keeps a trackpad gesture panning when it speeds up', () => {
    const classifier = new WheelClassifier()
    classifier.classify(wheel(0, { deltaY: 2 }))
    expect(classifier.classify(wheel(16, { deltaY: 60 }))).toBe('pan')
  })

  it('decides afresh after a pause', () => {
    const classifier = new WheelClassifier()
    classifier.classify(wheel(0, { deltaY: 2 }))
    expect(classifier.classify(wheel(200, { deltaY: 100 }))).toBe('zoom')
  })
})
