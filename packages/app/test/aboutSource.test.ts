import { describe, expect, it } from 'vitest'
import { sourceUrl } from '../src/about/aboutSource'

describe('the source code link', () => {
  // GPL-3.0 section 6: whoever gets the app can get the source of exactly that version.
  it('points at the release tag of the version shown', () => {
    expect(sourceUrl('0.7.0')).toBe('https://github.com/bjblazko/to-boldly-glow/tree/v0.7.0')
  })
})
