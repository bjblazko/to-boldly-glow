const PANEL_NAMES = ['camera', 'time', 'display'] as const
type PanelName = (typeof PANEL_NAMES)[number]

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
