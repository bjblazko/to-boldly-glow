import { searchEntities, type SolarSystemEntity } from '../solarSystem/entities'

const KIND_LABEL: Record<SolarSystemEntity['kind'], string> = {
  sun: 'Sun',
  planet: 'Planet',
  moon: 'Moon',
  comet: 'Comet',
  dwarfPlanet: 'Dwarf planet',
  asteroid: 'Asteroid',
}

export interface EntitySearchElements {
  input: HTMLInputElement
  results: HTMLElement
  followIndicator: HTMLElement
  followLabel: HTMLElement
  stopButton: HTMLButtonElement
}

export interface EntitySearchHandlers {
  onSelect(entity: SolarSystemEntity): void
  onStop(): void
}

// Wires a text input + live results list to searchEntities, and a small "Following: X ×" indicator
// driven via setFollowing() once a fly-to has actually started (kept separate from entity
// selection itself, since the indicator reflects camera-follow state, not search UI state).
export class EntitySearchUI {
  private results: SolarSystemEntity[] = []
  private enabled = true
  private readonly input: HTMLInputElement
  private readonly resultsContainer: HTMLElement

  constructor(
    private readonly elements: EntitySearchElements,
    private readonly handlers: EntitySearchHandlers,
  ) {
    this.input = elements.input
    this.resultsContainer = elements.results
    this.input.addEventListener('input', this.onInput)
    this.input.addEventListener('keydown', this.onKeyDown)
    elements.stopButton.addEventListener('click', () => this.handlers.onStop())
  }

  setFollowing(entity: SolarSystemEntity | null): void {
    if (entity) this.elements.followLabel.textContent = `Following: ${entity.name}`
    this.elements.followIndicator.hidden = !entity
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

  private choose(entity: SolarSystemEntity): void {
    this.handlers.onSelect(entity)
    this.input.value = ''
    this.results = []
    this.renderResults()
  }

  private renderResults(): void {
    this.resultsContainer.replaceChildren()
    for (const entity of this.results) {
      const row = document.createElement('div')
      row.className = 'hud-search-result'
      row.textContent = `${entity.name} (${KIND_LABEL[entity.kind]})`
      row.addEventListener('click', () => this.choose(entity))
      this.resultsContainer.appendChild(row)
    }
  }
}
