import type { Viewpoint } from '../camera/viewpoint'
import { msg } from '../i18n/i18n'
import type { VoyagerLabels } from '../learn/voyager/voyagerLabels'
import { RouteScene } from '../learn/voyager/routeScene'
import type { VoyagerAssets } from '../learn/voyager/voyagerAssets'
import type { VoyagerProbeId } from '../learn/voyager/voyagerStage'
import type { Vec3 } from '../math/tuples'
import { realPlanetPose } from '../scene/exploreLayout'
import type { SceneLayout } from '../scene/sceneLayout'
import { PLANETS } from '../solarSystem/bodies'
import { ephemerisAt, type Ephemeris } from '../time/ephemeris'
import { EncounterPath } from './encounterPath'
import { EncounterScene } from './encounterScene'
import type { MissionMoment } from './missionPlayer'
import type { Station } from './missionTimeline'
import { FLYBY_MOONS } from './voyagerMissions'

const ENCOUNTERS_URL = 'data/voyager/encounters'
// Every flyby file holds 36 hours either side, every 5 minutes.
const FLYBY_SAMPLES = 865

// The two scenes of a mission tour: the solar system along the route (Compact scale, the date
// running) and a flyby at true scale. The flyby's data loads as the tour nears it.
export class MissionScenes {
  readonly route: RouteScene
  readonly encounter: EncounterScene
  private readonly flybys = new Map<string, Promise<EncounterPath>>()
  private shownFlyby: string | null = null

  constructor(
    gpu: { device: GPUDevice; linePipeline: GPURenderPipeline },
    assets: VoyagerAssets,
    private readonly probe: VoyagerProbeId,
    private readonly labels: VoyagerLabels,
  ) {
    this.route = new RouteScene(gpu, assets.trajectories)
    this.encounter = new EncounterScene(gpu, assets.probe, FLYBY_SAMPLES)
  }

  // Whether the moment shows the flyby (it fades in on the route, out at the flyby).
  static showsFlyby(moment: MissionMoment): boolean {
    return moment.phase === 'encounter' || moment.phase === 'fadeOut'
  }

  // Starts loading a flyby's path (before the tour gets there).
  prefetch(station: Station): void {
    if (station.encounter) void this.flyby(station.encounter)
  }

  // The scene for this moment, ready to draw: the flyby (once its path has loaded) or the route.
  async stage(moment: MissionMoment, station: Station): Promise<void> {
    if (!MissionScenes.showsFlyby(moment) || !station.encounter) {
      this.route.showDay(moment.day, { view: station.view === 'heliosphere' ? 'heliosphere' : 'outer', probes: this.probesShown(moment, station) })
      return
    }
    const key = `${this.probe}-${station.encounter}`
    if (this.shownFlyby !== key) {
      const path = await this.flyby(station.encounter)
      this.encounter.show({ planetId: station.encounter, moonId: FLYBY_MOONS[key], path }, ephemerisAt(new Date(station.date)))
      this.shownFlyby = key
    }
    this.encounter.setMoment(moment.encounterSeconds)
  }

  // A station may show other probes (both, where one overtakes the other) or none (where the camera
  // is the probe); on the way to it the tour's own probe is always shown.
  private probesShown(moment: MissionMoment, station: Station): VoyagerProbeId[] {
    if (moment.phase !== 'flight') return station.probes ?? [this.probe]
    return station.probes?.length ? station.probes : [this.probe]
  }

  isFlybyReady(station: Station): boolean {
    return this.shownFlyby === `${this.probe}-${station.encounter}`
  }

  layout(moment: MissionMoment, station: Station): SceneLayout {
    const ephemeris: Ephemeris = ephemerisAt(new Date(Date.UTC(2000, 0, 1, 12) + moment.day * 86400000))
    if (MissionScenes.showsFlyby(moment) && this.isFlybyReady(station)) return this.encounter.layout(ephemeris)
    return this.route.layout()
  }

  // The planet the probe is heading for, where it is now (Compact scale).
  planetPosition(planetId: string | undefined, day: number): Vec3 | null {
    const definition = PLANETS.find((planet) => planet.id === planetId)
    return definition ? realPlanetPose(definition, ephemerisAt(new Date(Date.UTC(2000, 0, 1, 12) + day * 86400000)), 1).position : null
  }

  updateOverlays(moment: MissionMoment, station: Station, viewpoint: Viewpoint): void {
    if (MissionScenes.showsFlyby(moment) && this.isFlybyReady(station)) {
      this.encounter.updateLines(viewpoint)
      this.labels.begin()
      this.labels.place('flyby-path', { text: msg.voyager.flybyPath(msg.voyager.probes[this.probe]), point: this.encounter.pathLabelPoint, variant: 'region' }, viewpoint)
      this.labels.finish()
      return
    }
    this.route.updateLines(viewpoint)
    this.labels.begin()
    for (const probe of this.route.probes) this.labels.place(probe, { text: msg.voyager.probes[probe], point: this.route.probePosition(probe), variant: 'probe' }, viewpoint)
    if (this.route.showsHeliopause) this.placeBoundaryLabels(viewpoint)
    this.labels.finish()
  }

  private placeBoundaryLabels(viewpoint: Viewpoint): void {
    for (const boundary of ['terminationShock', 'heliopause'] as const) {
      this.labels.place(boundary, { text: msg.voyager[boundary], point: this.route.boundaries.labelPoint(boundary), variant: 'region' }, viewpoint)
    }
  }

  private flyby(planet: string): Promise<EncounterPath> {
    const key = `${this.probe}-${planet}`
    let loading = this.flybys.get(key)
    if (!loading) {
      loading = EncounterPath.load(`${ENCOUNTERS_URL}/${key}.bin`)
      this.flybys.set(key, loading)
    }
    return loading
  }
}
