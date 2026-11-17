import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FlyCamera } from '../src/camera/flyCamera'
import { CameraInputController } from '../src/camera/inputController'
import { OrbitCamera } from '../src/camera/orbitCamera'

// A canvas that only keeps its listeners, so the test can hand it pointer events.
function fakeCanvas() {
  const listeners = new Map<string, (event: object) => void>()
  const canvas = {
    clientWidth: 1280,
    clientHeight: 800,
    addEventListener: (type: string, listener: (event: object) => void) => listeners.set(type, listener),
    setPointerCapture: () => {},
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
  }
  const fire = (type: string, event: object) => listeners.get(type)?.({ pointerId: 1, pointerType: 'mouse', button: 0, shiftKey: false, timeStamp: 0, ...event })
  return { canvas: canvas as unknown as HTMLCanvasElement, fire }
}

describe('CameraInputController in free flight', () => {
  beforeEach(() => vi.stubGlobal('window', { addEventListener: () => {} }))
  afterEach(() => vi.unstubAllGlobals())

  it('looks around on a Shift- or right-drag, as Shift is the boost there', () => {
    const { canvas, fire } = fakeCanvas()
    const fly = new FlyCamera()
    const look = vi.spyOn(fly, 'look')
    const input = new CameraInputController(canvas, new OrbitCamera(), fly)
    input.setMode('fly')
    fire('pointerdown', { clientX: 100, clientY: 100, shiftKey: true })
    fire('pointermove', { clientX: 120, clientY: 100 })
    fire('pointerup', { clientX: 120, clientY: 100 })
    fire('pointerdown', { clientX: 100, clientY: 100, button: 2, pointerId: 2 })
    fire('pointermove', { clientX: 120, clientY: 100, pointerId: 2 })
    expect(look).toHaveBeenCalledTimes(2)
  })
})
