import type { SolarSystemEntity } from '../solarSystem/entities'
import { msg } from '../i18n/i18n'

export interface FollowChipElements {
  chip: HTMLElement
  label: HTMLElement
  stopButton: HTMLButtonElement
}

// "Following: Jupiter ×" just above the bar, while the camera follows a body (set once a fly-to
// has actually started); its button lets go.
export class FollowChip {
  constructor(
    private readonly elements: FollowChipElements,
    onStop: () => void,
  ) {
    elements.stopButton.addEventListener('click', onStop)
  }

  setFollowing(entity: SolarSystemEntity | null): void {
    if (entity) this.elements.label.textContent = msg.ui.find.following(entity.name)
    this.elements.chip.hidden = !entity
  }
}
