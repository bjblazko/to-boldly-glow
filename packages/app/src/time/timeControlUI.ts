import { SimulationClock, shuttleValueToTimeScale, TIME_SCALE_PRESETS } from './simulationClock'

const MAX_SHUTTLE_SECONDS_PER_SECOND = TIME_SCALE_PRESETS[TIME_SCALE_PRESETS.length - 1].secondsPerSecond

// Wires the play/pause button, reverse button, preset dropdown, and shuttle slider to a
// SimulationClock. The shuttle and the presets are two independent ways to set the same rate —
// touching either one calls clock.setTimeScale() directly; they aren't kept visually in sync with
// each other (see plan Context).
export interface TimeControlElements {
  playPauseButton: HTMLButtonElement
  reverseButton: HTMLButtonElement
  presetSelect: HTMLSelectElement
  shuttleSlider: HTMLInputElement
  dateDisplay: HTMLElement
}

export class TimeControlUI {
  constructor(
    private readonly clock: SimulationClock,
    private readonly elements: TimeControlElements,
  ) {
    this.populatePresetOptions()
    this.elements.playPauseButton.addEventListener('click', this.onPlayPauseClick)
    this.elements.reverseButton.addEventListener('click', this.onReverseClick)
    this.elements.presetSelect.addEventListener('change', this.onPresetChange)
    this.elements.shuttleSlider.addEventListener('input', this.onShuttleInput)
    this.updatePlayPauseLabel()
  }

  // Call once per frame (after clock.update()) to keep the displayed date current.
  refreshDisplay(): void {
    const iso = this.clock.getCurrentDate().toISOString()
    this.elements.dateDisplay.textContent = `${iso.replace('T', ' ').slice(0, 16)} UTC`
  }

  // Builds the preset <option> elements from TIME_SCALE_PRESETS so the dropdown can never drift
  // out of sync with the array — the array is the single source of truth, not the HTML.
  private populatePresetOptions(): void {
    for (const [index, preset] of TIME_SCALE_PRESETS.entries()) {
      const option = document.createElement('option')
      option.value = String(index)
      option.textContent = preset.label
      this.elements.presetSelect.appendChild(option)
    }
  }

  private onPlayPauseClick = () => {
    if (this.clock.isPaused()) {
      this.clock.play()
    } else {
      this.clock.pause()
    }
    this.updatePlayPauseLabel()
  }

  private onReverseClick = () => {
    this.clock.setTimeScale(-this.clock.getTimeScale())
  }

  private onPresetChange = () => {
    const preset = TIME_SCALE_PRESETS[Number(this.elements.presetSelect.value)]
    if (!preset) return
    this.clock.setTimeScale(preset.secondsPerSecond)
  }

  private onShuttleInput = () => {
    const value = Number(this.elements.shuttleSlider.value)
    this.clock.setTimeScale(shuttleValueToTimeScale(value, MAX_SHUTTLE_SECONDS_PER_SECOND))
  }

  private updatePlayPauseLabel(): void {
    const paused = this.clock.isPaused()
    this.elements.playPauseButton.classList.toggle('is-paused', paused)
    const label = this.elements.playPauseButton.querySelector<HTMLElement>('.btn-label')
    if (label) label.textContent = paused ? 'Play' : 'Pause'
  }
}
