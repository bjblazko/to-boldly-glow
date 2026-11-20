import type { Viewpoint } from '../../camera/viewpoint'
import { formatNumber, msg } from '../../i18n/i18n'
import type { SceneLayout } from '../../scene/sceneLayout'
import type { ModelContext } from '../../spacecraft/modelRenderer'
import { ModelScene } from '../../spacecraft/modelScene'
import type { Ephemeris } from '../../time/ephemeris'
import type { GroundShot } from '../ground/groundShot'
import type { LessonShot } from '../lessonShot'
import type { Chapter } from '../lessonTypes'
import type { StagedLessonScene, StagedOverlayFrame } from '../stagedLessonScene'
import { spacecraftLayout } from '../voyager/spacecraftStage'
import type { VoyagerLabels } from '../voyager/voyagerLabels'
import { BlueprintRoom, ROOM_HALF_WIDTH } from './blueprintRoom'
import { loadSaturnVAssets } from './saturnVAssets'
import { SATURN_V_AZIMUTH, SATURN_V_ROOM, saturnVShot } from './saturnVShots'
import type { SaturnVPart, SaturnVStage } from './saturnVStage'

// The lettering's side, as an angle about the rocket's axis (from +X toward +Z): -X/-Z.
const LETTERING_ANGLE = (5 * Math.PI) / 4
// One turn every two minutes; it starts with the lettering toward the camera (turning by `angle`
// moves a side at angle φ to φ - angle, and the camera stands at -azimuth).
const TURNTABLE = { secondsPerTurn: 120, startAngle: LETTERING_ANGLE + SATURN_V_AZIMUTH, stageSeconds: 2.6 }

const WHOLE: SaturnVStage = { shot: 'whole' }

function stageOf(chapter: Chapter): SaturnVStage {
  return chapter.saturnV ?? WHOLE
}

// The Saturn V lesson's scene: the rocket on its own, in sunlight, taken apart and cut open chapter
// by chapter. Its model (built from the rocket's dimensions, bundled) loads the first time the
// lesson opens; until then the chapter shows the sky alone.
export class SaturnVLesson implements StagedLessonScene {
  private rocket: ModelScene<SaturnVPart> | null = null
  private room: BlueprintRoom | null = null
  private marks: Record<string, number> = {}
  private loading: Promise<void> | null = null
  private chapter: Chapter | null = null

  constructor(
    private readonly gpu: { models: ModelContext },
    private readonly labels: VoyagerLabels,
  ) {}

  handles(kind: Chapter['kind']): boolean {
    return kind === 'saturnV'
  }

  start(chapter: Chapter): void {
    this.chapter = chapter
    this.loading ??= this.load().catch((error: unknown) => console.warn('The Saturn V lesson could not load its model.', error))
    this.rocket?.start(stageOf(chapter))
  }

  showChapter(chapter: Chapter, kindChanged: boolean): void {
    this.chapter = chapter
    if (kindChanged) this.rocket?.start(stageOf(chapter))
    else this.rocket?.show(stageOf(chapter), false)
  }

  update(deltaSeconds: number, _chapter: Chapter, viewLeft: boolean): void {
    this.rocket?.update(deltaSeconds, !viewLeft)
  }

  layout(_chapter: Chapter, ephemeris: Ephemeris): SceneLayout {
    return spacecraftLayout(ephemeris)
  }

  groundShot(): GroundShot | null {
    return null
  }

  shot(chapter: Chapter): LessonShot {
    return saturnVShot(chapter.saturnV?.shot ?? 'whole')
  }

  updateOverlays(_layout: SceneLayout, chapter: Chapter, { viewpoint }: StagedOverlayFrame): void {
    const rocket = this.rocket
    if (!rocket) return
    rocket.prepare(viewpoint)
    const stage = stageOf(chapter)
    this.room?.update(viewpoint, stage.heights ? Object.values(this.marks) : [])
    this.labels.begin()
    this.placeParts(rocket, stage.labels ?? [], viewpoint)
    if (stage.heights) this.placeHeights(viewpoint)
    this.labels.finish()
  }

  // The chapter's parts, those still there.
  private placeParts(rocket: ModelScene<SaturnVPart>, parts: SaturnVPart[], viewpoint: Viewpoint): void {
    for (const part of parts) {
      if (rocket.isShown(part)) this.labels.place(`saturnV-${part}`, { text: msg.lessons.saturnV.parts[part], point: rocket.anchor(part) }, viewpoint)
    }
  }

  // The stage tops' heights, in the corner between the walls (their lines run along the walls).
  private placeHeights(viewpoint: Viewpoint): void {
    const { toward, right } = SATURN_V_ROOM
    const corner = -ROOM_HALF_WIDTH + 0.5
    for (const [name, height] of Object.entries(this.marks)) {
      const point: [number, number, number] = [(toward[0] + right[0]) * corner, height, (toward[2] + right[2]) * corner]
      const mark = msg.lessons.saturnV.marks[name] ?? { label: name }
      const text = `${formatNumber(height, 1)} m · ${mark.label}`
      this.labels.place(`saturnV-height-${name}`, { text, point, variant: 'mark', note: mark.note }, viewpoint)
    }
  }

  hideOverlays(): void {
    this.labels.hideAll()
  }

  drawBehindBodies(pass: GPURenderPassEncoder): void {
    this.room?.draw(pass)
  }

  drawInFrontOfBodies(pass: GPURenderPassEncoder): void {
    this.rocket?.draw(pass)
  }

  drawOverlays(): void {}

  private async load(): Promise<void> {
    const { device, format } = this.gpu.models
    const [{ renderer, model }, room] = await Promise.all([loadSaturnVAssets(this.gpu.models), BlueprintRoom.create(device, format, SATURN_V_ROOM)])
    this.room = room
    this.marks = model.marks ?? {}
    this.rocket = new ModelScene<SaturnVPart>(renderer, model, TURNTABLE)
    if (this.chapter) this.rocket.start(stageOf(this.chapter))
  }
}
