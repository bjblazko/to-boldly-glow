import { type DeepLink, formatDeepLink } from './deepLink'

// Keeps the address bar on where one is - a lesson's chapter, a tour's station - without adding to
// the browser's history (Back still leaves the app, as before).
export class AddressBar {
  private shown: string | null = null

  show(link: DeepLink | null): void {
    const hash = link ? formatDeepLink(link) : ''
    if (hash === this.shown) return
    this.shown = hash
    history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`)
  }
}
