import type { Viewpoint } from '../../camera/viewpoint'
import { LineStrip } from '../../lines/lineStrip'
import { EasedTween } from '../../math/easedTween'
import type { Rgba, Vec3 } from '../../math/tuples'
import { generateOrbitPathPositions, scaleOrbitSamples } from '../../orbitPaths/orbitPath'
import { realPlanetPose, sunPose } from '../../scene/exploreLayout'
import type { SceneLayout } from '../../scene/sceneLayout'
import { PLANETS } from '../../solarSystem/bodies'
import { scaledPosition, type AuPosition } from '../../solarSystem/sceneScale'
import { ephemerisAt } from '../../time/ephemeris'
import type { Trajectory } from '../../spacecraft/trajectory'
import type { RouteStage, VoyagerProbeId } from './voyagerStage'
import { HeliosphereBoundaries } from './heliosphereBoundaries'

// The route is drawn at the app's Compact scale: distances compressed so Neptune and the
// heliopause fit in one view, the planets drawn smaller than the explore view's so the probes'
// close passes don't run through them.
const COMPACT = 1
const ROUTE_PLANET_SIZE = 0.45
// How long a chapter takes to play through its stretch of time.
const PLAY_SECONDS = 12

export const PROBE_COLORS: Record<VoyagerProbeId, Rgba> = { voyager1: [0.4, 0.85, 1, 1], voyager2: [1, 0.72, 0.35, 1] }
const AHEAD_DIMMING = 0.18
const ORBIT_COLOR_DIMMING = 0.35

const MS_PER_DAY = 86400000
const J2000_MS = Date.UTC(2000, 0, 1, 12)

export function dayOf(iso: string): number {
  return (Date.parse(iso) - J2000_MS) / MS_PER_DAY
}

export function dateOfDay(day: number): Date {
  return new Date(J2000_MS + day * MS_PER_DAY)
}

interface ProbeLines {
  travelled: LineStrip
  ahead: LineStrip
}

// The real solar system along the Voyagers' route: the planets where they were on the chapter's
// dates, each probe's path drawn on up to the day shown (and faintly ahead), playing through the
// chapter's stretch of time and then holding at its end.
export class RouteScene {
  private readonly progress = new EasedTween(0, PLAY_SECONDS)
  private progressValue = 0
  // A day set from outside (a mission tour drives the date), instead of the chapter's playback.
  private heldDay: number | null = null
  private route: RouteStage = { from: '1977-09-05', to: '1977-09-05', view: 'launch' }
  private readonly lines: Record<VoyagerProbeId, ProbeLines>
  private readonly orbits: { line: LineStrip; color: Rgba }[]
  // The termination shock and the heliopause, shown in the heliosphere view.
  readonly boundaries: HeliosphereBoundaries

  constructor(
    gpu: { device: GPUDevice; linePipeline: GPURenderPipeline },
    private readonly trajectories: Record<VoyagerProbeId, Trajectory>,
  ) {
    const { device, linePipeline } = gpu
    const lines = (id: VoyagerProbeId): ProbeLines => ({
      travelled: LineStrip.withCapacity(device, linePipeline, `${id} travelled`, trajectories[id].sampleCount + 1),
      ahead: LineStrip.create(device, linePipeline, `${id} whole path`, scaleOrbitSamples(trajectories[id].pathUntil(trajectories[id].lastDay), COMPACT)),
    })
    this.lines = { voyager1: lines('voyager1'), voyager2: lines('voyager2') }
    this.orbits = PLANETS.map((planet) => ({
      line: LineStrip.create(device, linePipeline, `${planet.id} route orbit`, generateOrbitPathPositions(planet, COMPACT)),
      color: [...planet.color.map((value) => value * ORBIT_COLOR_DIMMING), 1] as Rgba,
    }))
    this.boundaries = new HeliosphereBoundaries(gpu, trajectories)
  }

  get stage(): RouteStage {
    return this.route
  }

  // Plays the chapter's stretch of time from its start - or, without motion, shows its end.
  show(route: RouteStage, animate: boolean): void {
    this.route = route
    this.heldDay = null
    this.progressValue = animate ? 0 : 1
    this.progress.retarget(1, this.progressValue)
  }

  update(deltaSeconds: number): void {
    if (this.progress.isAnimating) this.progressValue = this.progress.update(deltaSeconds)
  }

  // The day shown (days since J2000).
  // Shows a given day (a mission tour's clock), with the given probes and view.
  showDay(day: number, route: Pick<RouteStage, 'view' | 'probes'>): void {
    const date = dateOfDay(day).toISOString()
    this.route = { from: date, to: date, ...route }
    this.heldDay = day
  }

  get day(): number {
    if (this.heldDay !== null) return this.heldDay
    const from = dayOf(this.route.from)
    return from + (dayOf(this.route.to) - from) * this.progressValue
  }

  get probes(): VoyagerProbeId[] {
    return this.route.probes ?? ['voyager1', 'voyager2']
  }

  probeAu(probe: VoyagerProbeId): AuPosition {
    return this.trajectories[probe].positionAt(this.day)
  }

  probePosition(probe: VoyagerProbeId): Vec3 {
    return scaledPosition(this.probeAu(probe), COMPACT)
  }

  get showsHeliopause(): boolean {
    return this.route.view === 'heliosphere'
  }

  layout(): SceneLayout {
    const ephemeris = ephemerisAt(dateOfDay(this.day))
    const planets = PLANETS.map((definition) => {
      const pose = realPlanetPose(definition, ephemeris, COMPACT)
      return { ...pose, radius: pose.radius * ROUTE_PLANET_SIZE }
    })
    const sun = sunPose(ephemeris, COMPACT)
    return { sun: { ...sun, radius: sun.radius * ROUTE_PLANET_SIZE }, planets, moons: [], alwaysShowBodyLabels: true }
  }

  updateLines(viewpoint: Viewpoint): void {
    for (const { line, color } of this.orbits) line.setStyle(viewpoint.viewProjection, color)
    for (const probe of this.probes) {
      const { travelled, ahead } = this.lines[probe]
      const color = PROBE_COLORS[probe]
      travelled.setPoints(scaleOrbitSamples(this.trajectories[probe].pathUntil(this.day), COMPACT))
      travelled.setStyle(viewpoint.viewProjection, color)
      ahead.setStyle(viewpoint.viewProjection, [color[0] * AHEAD_DIMMING, color[1] * AHEAD_DIMMING, color[2] * AHEAD_DIMMING, 1])
    }
    this.boundaries.updateLines(viewpoint)
  }

  // Expects the line pipeline to be set on the pass.
  drawLines(pass: GPURenderPassEncoder): void {
    for (const { line } of this.orbits) line.draw(pass)
    for (const probe of this.probes) {
      this.lines[probe].ahead.draw(pass)
      this.lines[probe].travelled.draw(pass)
    }
    if (this.showsHeliopause) this.boundaries.draw(pass)
  }
}
