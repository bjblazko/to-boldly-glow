type PanelName = 'camera' | 'time' | 'display'

// Wires the bottom dock's buttons to the sheet above it — only one panel open at a time; clicking
// the already-active dock button closes the sheet instead of re-opening the same panel.
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
  }

  // Closes whichever panel is currently open, if any — used when entering learn mode, so a sheet
  // left open from free-roam use (e.g. the Display panel) doesn't linger open behind the lesson
  // panel that now occupies the same screen position.
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
  }
}
