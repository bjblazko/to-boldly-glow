import type { AuPosition } from '../solarSystem/sceneScale'

// A probe's path around the Sun from JPL Horizons, as the data pipeline thinned it out
// (fetchVoyagerTrajectories.ts): samples of [days since J2000, x, y, z] in AU, heliocentric,
// ecliptic J2000 - the frame of the planets' VSOP87 positions. Between samples the probe moves in a
// straight line (the thinning kept every sample a line would miss by more than 0.001 AU).
export class Trajectory {
  readonly firstDay: number
  readonly lastDay: number

  constructor(private readonly samples: Float32Array) {
    this.firstDay = samples[0]
    this.lastDay = samples[samples.length - 4]
  }

  static async load(url: string): Promise<Trajectory> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`)
    return new Trajectory(new Float32Array(await response.arrayBuffer()))
  }

  get sampleCount(): number {
    return this.samples.length / 4
  }

  // Where the probe is on a day (days since J2000), held at the ends of the path.
  positionAt(day: number): AuPosition {
    const clamped = Math.min(Math.max(day, this.firstDay), this.lastDay)
    const after = Math.min(Math.max(1, this.firstSampleAfter(clamped)), this.sampleCount - 1)
    const t = (clamped - this.day(after - 1)) / (this.day(after) - this.day(after - 1) || 1)
    const [x, y, z] = [1, 2, 3].map((axis) => this.value(after - 1, axis) + (this.value(after, axis) - this.value(after - 1, axis)) * t)
    return { x, y, z, distanceAu: Math.hypot(x, y, z) }
  }

  // The path from launch up to a day: every sample before it, then the probe's place on that day.
  pathUntil(day: number): AuPosition[] {
    const count = Math.min(this.firstSampleAfter(day), this.sampleCount)
    const points = Array.from({ length: count }, (_, index) => this.positionAt(this.day(index)))
    if (day > this.firstDay) points.push(this.positionAt(day))
    return points
  }

  private day(index: number): number {
    return this.samples[index * 4]
  }

  private value(index: number, axis: number): number {
    return this.samples[index * 4 + axis]
  }

  // The index of the first sample later than the day (sampleCount if none is).
  private firstSampleAfter(day: number): number {
    let [low, high] = [0, this.sampleCount]
    while (low < high) {
      const middle = (low + high) >> 1
      if (this.day(middle) <= day) low = middle + 1
      else high = middle
    }
    return low
  }
}
