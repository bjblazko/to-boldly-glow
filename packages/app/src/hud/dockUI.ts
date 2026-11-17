export type PanelName = 'time' | 'view'

// Wires the bar's panel buttons (Time, View) to the sheet above the bar — only one panel open at a
// time; clicking the already-active button, the panel's close button, or the scene closes it. The
// bar has a View button in each of its groups; whichever is showing opens the same panel.
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

  open(panel: PanelName): void {
    if (this.activePanel !== panel) this.togglePanel(panel)
  }

  // Closes whichever panel is currently open, if any — on a press on the scene, when another menu
  // opens, and when a lesson starts or ends, so a sheet left open doesn't linger.
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
