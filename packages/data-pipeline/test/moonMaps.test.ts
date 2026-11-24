import { describe, expect, it } from 'vitest'
import { regionPixels } from '../src/apollo/moonMaps'

describe('the region of the Moon maps the tour uses', () => {
  it('cuts 70 by 22 degrees out of a whole-Moon map', () => {
    const p = regionPixels(36000, 18000)
    expect(p).toEqual({ left: 17000, top: 7800, width: 7000, height: 2200 })
  })
})
