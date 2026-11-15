import type { Vec3 } from '../math/tuples'

// A planet flyby at true scale, as the data pipeline fetched it from JPL Horizons
// (fetchVoyagerEncounters.ts): every 5 minutes, [seconds from closest approach, probe x, y, z, moon
// x, y, z] in km from the planet's centre, ecliptic J2000.
const RECORD = 7

export class EncounterPath {
  constructor(private readonly records: Float32Array) {}

  static async load(url: string): Promise<EncounterPath> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`)
    return new EncounterPath(new Float32Array(await response.arrayBuffer()))
  }

  get sampleCount(): number {
    return this.records.length / RECORD
  }

  probeAt(seconds: number): Vec3 {
    return this.at(seconds, 1)
  }

  moonAt(seconds: number): Vec3 {
    return this.at(seconds, 4)
  }

  // Which way the probe is flying at that moment (unit vector).
  directionAt(seconds: number): Vec3 {
    const [a, b] = [this.probeAt(seconds - 60), this.probeAt(seconds + 60)]
    const delta: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const length = Math.hypot(...delta) || 1
    return delta.map((value) => value / length) as Vec3
  }

  // The whole path, in km, as a flat [x0, y0, z0, x1, ...] list.
  probePath(): Float32Array {
    return Float32Array.from({ length: this.sampleCount * 3 }, (_, index) => this.records[Math.floor(index / 3) * RECORD + 1 + (index % 3)])
  }

  // How many samples lie before that moment.
  samplesBefore(seconds: number): number {
    const step = this.seconds(1) - this.seconds(0)
    return Math.min(this.sampleCount, Math.max(0, Math.ceil((seconds - this.seconds(0)) / step)))
  }

  private seconds(index: number): number {
    return this.records[index * RECORD]
  }

  // Linear between the two samples around that moment, held at the path's ends.
  private at(seconds: number, offset: number): Vec3 {
    const last = this.sampleCount - 1
    const step = this.seconds(1) - this.seconds(0)
    const position = Math.min(Math.max((seconds - this.seconds(0)) / step, 0), last)
    const index = Math.min(Math.floor(position), last - 1)
    const t = position - index
    return [0, 1, 2].map((axis) => {
      const a = this.records[index * RECORD + offset + axis]
      return a + (this.records[(index + 1) * RECORD + offset + axis] - a) * t
    }) as Vec3
  }
}
