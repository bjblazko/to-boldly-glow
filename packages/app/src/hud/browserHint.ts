import { msg } from '../i18n/i18n'

export type BrowserEngine = 'chromium' | 'webkit' | 'gecko' | 'other'

const DISMISSED_KEY = 'toBoldlyGlow.browserHintDismissed'

// The engine behind the browser: Chrome, Edge, Chromium, Helium, Brave and the like are Chromium
// (they say so in their client hints, or "Chrome/" in the user agent); Safari is WebKit; Firefox
// is Gecko.
export function browserEngine(nav: Pick<Navigator, 'userAgent'> & { userAgentData?: { brands: { brand: string }[] } }): BrowserEngine {
  if (nav.userAgentData?.brands.some(({ brand }) => brand === 'Chromium')) return 'chromium'
  const ua = nav.userAgent
  if (/Firefox\//.test(ua)) return 'gecko'
  if (/Chrome\/|Chromium\//.test(ua)) return 'chromium'
  if (/AppleWebKit\//.test(ua)) return 'webkit'
  return 'other'
}

// iPhone and iPad: every browser there runs on Safari's engine, so there is nothing to recommend.
export function onAppleMobile(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>): boolean {
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1)
}

// What to say, if anything: the app runs fastest on Chromium; Safari runs it more slowly, Firefox
// only on some systems.
export function browserHintText(engine: BrowserEngine, appleMobile: boolean): string | null {
  if (engine === 'chromium' || appleMobile) return null
  return engine === 'webkit' ? msg.ui.browser.safari : engine === 'gecko' ? msg.ui.browser.firefox : msg.ui.browser.other
}

// A small card saying which browser runs the app best, until the visitor closes it (then for good,
// in this browser).
export function showBrowserHint(elements: { hint: HTMLElement; text: HTMLElement; close: HTMLButtonElement }): void {
  const text = browserHintText(browserEngine(navigator), onAppleMobile(navigator))
  if (!text || stored() === 'yes') return
  elements.text.textContent = text
  elements.hint.hidden = false
  elements.close.addEventListener('click', () => {
    elements.hint.hidden = true
    store('yes')
  })
}

function stored(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

function store(value: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, value)
  } catch {
    // Private mode or storage off: it shows again next time.
  }
}
