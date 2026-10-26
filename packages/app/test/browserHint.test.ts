import { describe, expect, it } from 'vitest'
import { browserEngine, browserHintText, onAppleMobile } from '../src/hud/browserHint'

const UA = {
  chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:155.0) Gecko/20100101 Firefox/155.0',
  firefoxAndroid: 'Mozilla/5.0 (Android 15; Mobile; rv:155.0) Gecko/155.0 Firefox/155.0',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0 Mobile/15E148 Safari/604.1',
}

describe('the browser engine', () => {
  it('tells Chromium by its client hints, or by Chrome in the user agent', () => {
    expect(browserEngine({ userAgent: 'anything', userAgentData: { brands: [{ brand: 'Helium' }, { brand: 'Chromium' }] } })).toBe('chromium')
    expect(browserEngine({ userAgent: UA.chrome })).toBe('chromium')
    expect(browserEngine({ userAgent: UA.edge })).toBe('chromium')
  })

  it('tells Safari and Firefox apart', () => {
    expect(browserEngine({ userAgent: UA.safari })).toBe('webkit')
    expect(browserEngine({ userAgent: UA.firefox })).toBe('gecko')
    expect(browserEngine({ userAgent: UA.firefoxAndroid })).toBe('gecko')
  })
})

describe('the browser hint', () => {
  it('says nothing in a Chrome-based browser, nor on an iPhone or iPad, where every browser is Safari underneath', () => {
    expect(browserHintText('chromium', false)).toBeNull()
    expect(onAppleMobile({ userAgent: UA.iphoneChrome, maxTouchPoints: 5 })).toBe(true)
    expect(onAppleMobile({ userAgent: UA.safari, maxTouchPoints: 5 })).toBe(true)
    expect(onAppleMobile({ userAgent: UA.safari, maxTouchPoints: 0 })).toBe(false)
    expect(browserHintText('webkit', true)).toBeNull()
  })

  it('recommends a Chrome-based browser to Safari, Firefox and anything else', () => {
    for (const engine of ['webkit', 'gecko', 'other'] as const) expect(browserHintText(engine, false)).toContain('Chrome')
    expect(browserHintText('gecko', false)).toContain('Android')
  })
})
