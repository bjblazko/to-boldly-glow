import { msg } from '../i18n/i18n'
import type { GrandTourRemote } from './grandTourRemote'
import { GRAND_TOUR } from '../camera/tour/grandTour'

type Find = <T extends HTMLElement>(selector: string) => T

const REFRESH_MS = 400

// The bar's back, next and play/pause while the grand tour flies.
export class GrandTourBar {
  private remote: GrandTourRemote | null = null
  private readonly previous: HTMLButtonElement
  private readonly next: HTMLButtonElement
  private readonly play: HTMLButtonElement
  private ticker: ReturnType<typeof setInterval> | undefined
  private shownStop = -1

  // `place`: hears which stop of the route the tour is at (null: none, it ended) - the address
  // bar's link.
  constructor(
    find: Find,
    private readonly place: (stop: string | null) => void = () => {},
  ) {
    this.previous = find<HTMLButtonElement>('#tour-prev')
    this.next = find<HTMLButtonElement>('#tour-next')
    this.play = find<HTMLButtonElement>('#tour-play')
    this.previous.addEventListener('click', () => this.act((remote) => remote.previous()))
    this.next.addEventListener('click', () => this.act((remote) => remote.next()))
    this.play.addEventListener('click', () => this.act((remote) => remote.togglePause()))
  }

  attach(remote: GrandTourRemote): void {
    this.detach()
    this.remote = remote
    this.ticker = setInterval(() => this.refresh(), REFRESH_MS)
    this.refresh()
  }

  // The tour has ended: a pause is let go (the clock runs on as it did).
  detach(): void {
    if (this.remote) this.place(null)
    this.shownStop = -1
    if (this.remote?.paused) this.remote.togglePause()
    this.remote = null
    clearInterval(this.ticker)
    this.ticker = undefined
  }

  private act(action: (remote: GrandTourRemote) => void): void {
    if (!this.remote) return
    action(this.remote)
    this.refresh()
  }

  private refresh(): void {
    const remote = this.remote
    if (!remote) return
    if (remote.stopIndex !== this.shownStop && remote.stopIndex >= 0) {
      this.shownStop = remote.stopIndex
      this.place(GRAND_TOUR[remote.stopIndex].stop)
    }
    this.previous.disabled = !remote.canGoBack
    this.next.disabled = !remote.canGoOn
    const label = remote.paused ? msg.ui.dock.play : msg.ui.dock.pause
    this.play.dataset.state = remote.paused ? 'paused' : 'playing'
    this.play.setAttribute('aria-label', label)
    const text = this.play.querySelector('.hud-dock-label')
    if (text && text.textContent !== label) text.textContent = label
  }
}
