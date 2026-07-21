import { searchEntities, type SolarSystemEntity } from '../solarSystem/entities'

const KIND_LABEL: Record<SolarSystemEntity['kind'], string> = {
  sun: 'Sun',
  planet: 'Planet',
  moon: 'Moon',
}

// Wires a text input + live results list to searchEntities, and a small "Following: X ×" indicator
// that main.ts drives via setFollowing() once a fly-to has actually started (kept separate from
// entity selection itself, since the indicator reflects camera-follow state, not search UI state).
export class EntitySearchUI {
  private results: SolarSystemEntity[] = []
  private enabled = true

  constructor(
    private readonly input: HTMLInputElement,
    private readonly resultsContainer: HTMLDivElement,
    private readonly followIndicator: HTMLElement,
    private readonly followLabel: HTMLElement,
    private readonly stopButton: HTMLButtonElement,
    private readonly onSelect: (entity: SolarSystemEntity) => void,
    private readonly onStop: () => void,
  ) {
    this.input.addEventListener('input', this.onInput)
    this.input.addEventListener('keydown', this.onKeyDown)
    this.stopButton.addEventListener('click', this.onStopClick)
  }

  setFollowing(entity: SolarSystemEntity | null): void {
    if (entity) {
      this.followLabel.textContent = `Following: ${entity.name}`
      this.followIndicator.style.display = 'flex'
    } else {
      this.followIndicator.style.display = 'none'
    }
  }

  // Explicitly disables search input/selection (rather than relying solely on the search box
  // being unreachable while the Camera dock panel is hidden, e.g. in learn mode) - blurs and
  // clears the box, drops any pending results, and ignores further input/keydown so a stray
  // focus/hotkey path can't fire a fly-to that would fight a locked chapter framing.
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.input.disabled = !enabled
    if (!enabled) {
      this.input.blur()
      this.input.value = ''
      this.results = []
      this.renderResults()
    }
  }

  private onInput = () => {
    if (!this.enabled) return
    this.results = searchEntities(this.input.value)
    this.renderResults()
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled) return
    if (event.key === 'Enter' && this.results.length > 0) {
      this.choose(this.results[0])
    }
  }

  private onStopClick = () => {
    this.onStop()
  }

  private choose(entity: SolarSystemEntity): void {
    this.onSelect(entity)
    this.input.value = ''
    this.results = []
    this.renderResults()
  }

  private renderResults(): void {
    this.resultsContainer.replaceChildren()
    for (const entity of this.results) {
      const row = document.createElement('div')
      row.textContent = `${entity.name} (${KIND_LABEL[entity.kind]})`
      row.style.cursor = 'pointer'
      row.style.padding = '4px 0'
      row.addEventListener('click', () => this.choose(entity))
      this.resultsContainer.appendChild(row)
    }
  }
}
