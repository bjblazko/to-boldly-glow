import { calendarToJulianDay } from '@toboldlyglow/engine'

// Converts a JS Date (UTC) to a Julian Day, preserving sub-hour precision (minutes, seconds,
// milliseconds) in the fractional day - not just whole hours. At fast time scales the simulated
// clock can advance many real-world minutes of simulated time within a single hour between
// animation frames; truncating to whole hours made every frame within that hour resolve to the
// exact same Julian Day (and therefore the exact same body positions/rotations), so motion only
// visibly advanced once per simulated hour crossed - at the "1 hr/s" preset specifically, that's
// once per real second, which is what made the animation look like it was running at ~1fps.
export function currentJulianDay(date: Date): number {
  const fractionalDay =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400 +
    date.getUTCMilliseconds() / 86400000
  return calendarToJulianDay(date.getUTCFullYear(), date.getUTCMonth() + 1, fractionalDay)
}

export interface TimeScalePreset {
  label: string
  secondsPerSecond: number
}

// Average Gregorian calendar month/year lengths, used for the "1 month/s" and "1 year/s" presets.
const AVERAGE_YEAR_SECONDS = 365.2425 * 86400
const AVERAGE_MONTH_SECONDS = AVERAGE_YEAR_SECONDS / 12

export const TIME_SCALE_PRESETS: TimeScalePreset[] = [
  { label: 'Real-time', secondsPerSecond: 1 },
  { label: '1 min/s', secondsPerSecond: 60 },
  { label: '1 hr/s', secondsPerSecond: 3600 },
  { label: '1 day/s', secondsPerSecond: 86400 },
  { label: '1 month/s', secondsPerSecond: AVERAGE_MONTH_SECONDS },
  { label: '1 year/s', secondsPerSecond: AVERAGE_YEAR_SECONDS },
]

// Maps a shuttle slider value in [-100, 100] to a time scale (simulated seconds per real second),
// using a cubic curve so fine control near the center (slow rates) coexists with fast rates at the
// extremes — the "shuttle" feel. Sign of the input controls direction; 0 maps to a stopped clock.
export function shuttleValueToTimeScale(value: number, maxSecondsPerSecond: number): number {
  if (value === 0) return 0
  const magnitude = Math.abs(value) / 100
  const scale = Math.pow(magnitude, 3) * maxSecondsPerSecond
  return Math.sign(value) * scale
}

// Drives a simulated clock forward or backward at a configurable rate, fully decoupled from
// wall-clock time. Call update(realDeltaSeconds) once per animation frame.
export class SimulationClock {
  private simulatedMs: number
  private timeScale: number
  private paused: boolean

  constructor(initialDate: Date = new Date(), initialTimeScale = 1) {
    this.simulatedMs = initialDate.getTime()
    this.timeScale = initialTimeScale
    this.paused = false
  }

  update(realDeltaSeconds: number): void {
    if (this.paused) return
    this.simulatedMs += realDeltaSeconds * 1000 * this.timeScale
  }

  getCurrentDate(): Date {
    return new Date(this.simulatedMs)
  }

  play(): void {
    this.paused = false
  }

  pause(): void {
    this.paused = true
  }

  isPaused(): boolean {
    return this.paused
  }

  setTimeScale(scale: number): void {
    this.timeScale = scale
  }

  getTimeScale(): number {
    return this.timeScale
  }
}
