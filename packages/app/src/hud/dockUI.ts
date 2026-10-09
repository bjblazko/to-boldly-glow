export type PanelName = 'find' | 'camera' | 'time' | 'view'

// Wires the dock buttons to the sheet above them — only one panel open at a time; clicking the
// already-active dock button, or the panel's close button, closes the sheet. Both docks (explore
// and lesson) have a View button; whichever is showing opens the same panel.
export class DockUI {
  private activePanel: PanelName | null = null

  constructor(
    private readonly dockButtons: NodeListOf<HTMLButtonElement>,
    private readonly sheet: HTMLElement,
    private readonly sheetPanels: NodeListOf<HTMLElement>,
  ) {
    this.dockButtons.forEach((button) => {
      button.addEventListener('click', () => this.togglePanel(button.dataset.panel as PanelName))
    })
    // Each panel's own close button; focus returns to the dock button that opened it.
    this.sheet.querySelectorAll<HTMLButtonElement>('[data-sheet-close]').forEach((button) => {
      button.addEventListener('click', () => {
        const opener = this.visibleButtonFor(this.activePanel)
        this.closeActivePanel()
        opener?.focus()
      })
    })
  }

  // Closes whichever panel is currently open, if any — used when switching between explore and
  // learn, so a sheet left open doesn't linger behind the other mode's dock.
  closeActivePanel(): void {
    if (this.activePanel === null) return
    this.togglePanel(this.activePanel)
  }

  private togglePanel(panel: PanelName): void {
    const opening = this.activePanel !== panel
    this.activePanel = opening ? panel : null

    this.dockButtons.forEach((button) => {
      button.classList.toggle('is-active', opening && button.dataset.panel === panel)
    })
    this.sheetPanels.forEach((section) => {
      section.classList.toggle('is-active', opening && section.dataset.panel === panel)
    })
    this.sheet.classList.toggle('is-open', opening)
    if (opening) this.focusOnOpen(panel)
  }

  // A panel built around typing (Find) takes the keyboard focus when it opens - but not on a touch
  // screen, where focusing a text field pops up the on-screen keyboard over the scene.
  private focusOnOpen(panel: PanelName): void {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const section = Array.from(this.sheetPanels).find((candidate) => candidate.dataset.panel === panel)
    section?.querySelector<HTMLElement>('[data-focus-on-open]')?.focus()
  }

  private visibleButtonFor(panel: PanelName | null): HTMLButtonElement | undefined {
    return Array.from(this.dockButtons).find((button) => button.dataset.panel === panel && button.offsetParent !== null)
  }
}
