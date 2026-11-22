import { describe, expect, it } from 'vitest'
import { csmParts, SM_PAINT_TEXTURE } from '../src/apollo/csmParts'

describe('the service module’s paint', () => {
  it('wraps once round the module and runs from its top to its base', () => {
    const [shell] = csmParts().get('sm')!
    expect(shell.texture).toBe(SM_PAINT_TEXTURE)
    const vs = Array.from(shell.uvs).filter((_, i) => i % 2 === 1)
    expect(Math.min(...vs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...vs)).toBeLessThanOrEqual(1)
  })
})
