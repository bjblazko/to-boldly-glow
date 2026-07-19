import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadStarCatalog } from '../src/starfield/starCatalog'

describe('loadStarCatalog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips a successful fetch into a Float32Array', async () => {
    const original = new Float32Array([0, 1, 0, 0.8, 1, 0, 0, 0.3])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(original.buffer),
      }),
    )

    const result = await loadStarCatalog('/stars/starCatalog.bin')
    expect(Array.from(result)).toEqual(Array.from(original))
  })

  it('degrades to an empty array (not a thrown error) on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const result = await loadStarCatalog('/stars/starCatalog.bin')
    expect(result.length).toBe(0)
  })

  it('degrades to an empty array (not a thrown error) when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await loadStarCatalog('/stars/starCatalog.bin')
    expect(result.length).toBe(0)
  })
})
