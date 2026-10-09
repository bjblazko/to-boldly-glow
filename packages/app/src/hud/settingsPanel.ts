// The settings popover behind the top-right sliders button: how the picture is rendered (bloom,
// lens flares) and the frame-rate readout - set once, unlike the View panel's layers, which change
// what the scene shows. Opens and closes from its button; closes on its close button, Escape, or a
// press anywhere outside it.
export class SettingsPanel {
  constructor(
    private readonly panel: HTMLElement,
    private readonly button: HTMLButtonElement,
    closeButton: HTMLButtonElement,
  ) {
    button.addEventListener('click', () => this.setOpen(Boolean(panel.hidden)))
    closeButton.addEventListener('click', () => {
      this.setOpen(false)
      button.focus()
    })
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) this.setOpen(false)
    })
    window.addEventListener('pointerdown', (event) => {
      const target = event.target as Node | null
      if (!panel.hidden && !panel.contains(target) && !button.contains(target)) this.setOpen(false)
    })
  }

  setOpen(open: boolean): void {
    this.panel.hidden = !open
    this.button.setAttribute('aria-expanded', String(open))
    this.button.classList.toggle('is-active', open)
  }
}
