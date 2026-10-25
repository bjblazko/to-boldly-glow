// The settings popover behind the top-right sliders button, in tabs: the language; how the picture
// is rendered (bloom, lens flares) and the frame-rate readout; the narrator and the music - set
// once, unlike the View panel's layers, which change what the scene shows. Opens and closes from
// its button; closes on its close button, Escape, or a press anywhere outside it.
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

// Settings' tabs (General, Video, Audio): each shows its own panel; the arrow keys move between
// them, as in any tab row.
export function bindSettingsTabs(tabList: HTMLElement): void {
  const tabs = [...tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const select = (chosen: HTMLButtonElement) => {
    for (const tab of tabs) {
      const selected = tab === chosen
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
      document.getElementById(tab.getAttribute('aria-controls')!)!.hidden = !selected
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (!step) return
      const next = tabs[(index + step + tabs.length) % tabs.length]
      select(next)
      next.focus()
    })
  })
  select(tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? tabs[0])
}
