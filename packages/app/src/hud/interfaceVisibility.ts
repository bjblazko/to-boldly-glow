import { isTextEntryTarget } from '../camera/input/keyboardState'

// Hides the whole interface in Explore, leaving the scene and its labels, and one quiet button in
// the hide button's spot to bring it back. H toggles, Escape brings it back, and Ctrl/Cmd+K brings
// it back with the palette open (so the palette never opens unseen).
export class InterfaceVisibility {
  constructor(
    private readonly body: HTMLElement,
    private readonly buttons: { hide: HTMLButtonElement; show: HTMLButtonElement },
  ) {
    buttons.hide.addEventListener('click', () => this.hide())
    buttons.show.addEventListener('click', () => this.show())
    window.addEventListener('keydown', this.onKeyDown)
  }

  get isHidden(): boolean {
    return this.body.dataset.uiHidden !== undefined
  }

  hide(): void {
    if (this.body.dataset.appMode === 'learn') return
    this.body.dataset.uiHidden = ''
    this.buttons.show.hidden = false
    this.buttons.show.focus()
  }

  show(): void {
    if (!this.isHidden) return
    this.reveal()
    this.buttons.hide.focus()
  }

  private reveal(): void {
    delete this.body.dataset.uiHidden
    this.buttons.show.hidden = true
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const command = event.ctrlKey || event.metaKey
    if (command && event.key.toLowerCase() === 'k') {
      if (this.isHidden) this.reveal()
    } else if (event.key === 'Escape') {
      this.show()
    } else if (this.isToggleKey(event)) {
      if (this.isHidden) this.show()
      else this.hide()
    }
  }

  private isToggleKey(event: KeyboardEvent): boolean {
    if (event.key.toLowerCase() !== 'h' || event.repeat) return false
    if (event.ctrlKey || event.metaKey || event.altKey) return false
    return !isTextEntryTarget(event.target)
  }
}
