import { SimulationClock, shuttleValueToTimeScale, TIME_SCALE_PRESETS } from './simulationClock'

const MAX_SHUTTLE_SECONDS_PER_SECOND = TIME_SCALE_PRESETS[TIME_SCALE_PRESETS.length - 1].secondsPerSecond

// Wires the play/pause button, reverse button, preset dropdown, and shuttle slider to a
// SimulationClock. The shuttle and the presets are two independent ways to set the same rate —
// touching either one calls clock.setTimeScale() directly; they aren't kept visually in sync with
// each other (see plan Context).
export class TimeControlUI {
  constructor(
    private readonly clock: SimulationClock,
    private readonly playPauseButton: HTMLButtonElement,
    private readonly reverseButton: HTMLButtonElement,
    private readonly presetSelect: HTMLSelectElement,
    private readonly shuttleSlider: HTMLInputElement,
    private readonly dateDisplay: HTMLElement,
  ) {
    this.playPauseButton.addEventListener('click', this.onPlayPauseClick)
    this.reverseButton.addEventListener('click', this.onReverseClick)
    this.presetSelect.addEventListener('change', this.onPresetChange)
    this.shuttleSlider.addEventListener('input', this.onShuttleInput)
    this.updatePlayPauseLabel()
  }

  // Call once per frame (after clock.update()) to keep the displayed date current.
  refreshDisplay(): void {
    const iso = this.clock.getCurrentDate().toISOString()
    this.dateDisplay.textContent = `${iso.replace('T', ' ').slice(0, 16)} UTC`
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
    const preset = TIME_SCALE_PRESETS[Number(this.presetSelect.value)]
    if (!preset) return
    this.clock.setTimeScale(preset.secondsPerSecond)
  }

  private onShuttleInput = () => {
    const value = Number(this.shuttleSlider.value)
    this.clock.setTimeScale(shuttleValueToTimeScale(value, MAX_SHUTTLE_SECONDS_PER_SECOND))
  }

  private updatePlayPauseLabel(): void {
    this.playPauseButton.textContent = this.clock.isPaused() ? 'Play' : 'Pause'
  }
}
