import { describe, expect, it } from 'vitest'
import { sphericalToX, sphericalToY, sphericalToZ } from '../build/engine.js'

describe('spherical to rectangular conversion', () => {
  it('places a point on the reference axis at longitude 0, latitude 0', () => {
    expect(sphericalToX(0, 0, 1)).toBeCloseTo(1, 10)
    expect(sphericalToY(0, 0, 1)).toBeCloseTo(0, 10)
    expect(sphericalToZ(0, 0, 1)).toBeCloseTo(0, 10)
  })

  it('rotates 90 degrees in longitude onto the Y axis', () => {
    const halfPi = Math.PI / 2
    expect(sphericalToX(halfPi, 0, 1)).toBeCloseTo(0, 10)
    expect(sphericalToY(halfPi, 0, 1)).toBeCloseTo(1, 10)
    expect(sphericalToZ(halfPi, 0, 1)).toBeCloseTo(0, 10)
  })

  it('rotates 90 degrees in latitude onto the Z axis', () => {
    const halfPi = Math.PI / 2
    expect(sphericalToX(0, halfPi, 1)).toBeCloseTo(0, 10)
    expect(sphericalToY(0, halfPi, 1)).toBeCloseTo(0, 10)
    expect(sphericalToZ(0, halfPi, 1)).toBeCloseTo(1, 10)
  })

  it('scales all components by the radius', () => {
    expect(sphericalToX(0, 0, 2.5)).toBeCloseTo(2.5, 10)
  })
})
