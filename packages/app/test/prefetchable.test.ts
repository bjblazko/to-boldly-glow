import { describe, expect, it } from 'vitest'
import { prefetchable } from '../src/narration/audioClipPlayer'

describe('prefetchable', () => {
  it('fetches clips ahead from a web server', () => {
    expect(prefetchable('https://toboldlyglow.huepattl.de/')).toBe(true)
    expect(prefetchable('http://localhost:5199/?tour=off')).toBe(true)
  })

  it('not in the download opened from the disk, where fetch() may not read files', () => {
    expect(prefetchable('file:///Users/someone/to-boldly-glow-0.6.0/index.html')).toBe(false)
  })
})
