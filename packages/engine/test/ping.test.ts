import { describe, expect, it } from 'vitest'
import { ping } from '../build/engine.js'

describe('WASM build pipeline', () => {
  it('loads the compiled module and calls an exported function', () => {
    expect(ping()).toBe(42)
  })
})
