import { mat4, vec4 } from 'gl-matrix'
import type { Viewpoint } from '../../camera/viewpoint'
import { formatNumber } from '../../i18n/i18n'
import type { Vec3 } from '../../math/tuples'
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
import type { FilmLook } from '../../bloom/filmLook'
import { BlueprintRoom } from './blueprintRoom'
import { LampGlow } from './lampGlow'
import { loadVehicleModel } from './vehicleAssets'
import type { VehicleConfig, VehicleModel } from './vehicleConfig'
import type { VehicleId, VehicleStage } from './vehicleStage'

const VEHICLE_FILM_LOOK: FilmLook = { vignette: 0.45, grain: 0.035, grade: 0.7, occlusion: 0.8, reach: 0, blur: 6 }

// A vehicle on show: its models (sharing one stage and one turn) and its room.
interface OnShow {
  scenes: ModelScene<string>[]
  room: BlueprintRoom
  glow: LampGlow
  marks: Record<string, number>
}

// The vehicle lessons' scene (the Saturn V, Columbia, ...): the vehicle on its own in an open
// blueprint room, taken apart, cut open and - where it has an inside - looked into, chapter by
// chapter. Each vehicle's models (bundled) load the first time one of its chapters opens; until
// then the chapter shows the room's black alone.
export class VehicleLesson implements StagedLessonScene {
  private readonly onShow = new Map<VehicleId, OnShow>()
  private readonly loading = new Map<VehicleId, Promise<void>>()
  private chapter: Chapter | null = null
  // The last frame's camera, for turning a double click into a ray.
  private viewpoint: Viewpoint | null = null

  constructor(
    private readonly gpu: { models: ModelContext },
    private readonly labels: VoyagerLabels,
    private readonly vehicles: Record<VehicleId, VehicleConfig>,
  ) {}

  handles(kind: Chapter['kind']): boolean {
    return kind === 'vehicle'
  }

  start(chapter: Chapter): void {
    this.chapter = chapter
    const { vehicle } = stageOf(chapter)
    if (!this.loading.has(vehicle)) this.loading.set(vehicle, this.load(vehicle).catch((error: unknown) => console.warn(`The ${vehicle} lesson could not load its models.`, error)))
    this.stage(chapter, true)
  }

  showChapter(chapter: Chapter, kindChanged: boolean): void {
    const vehicleChanged = !this.chapter || stageOf(this.chapter).vehicle !== stageOf(chapter).vehicle
    if (vehicleChanged) this.start(chapter)
    else {
      this.chapter = chapter
      this.stage(chapter, kindChanged)
    }
  }

  update(deltaSeconds: number, chapter: Chapter, viewLeft: boolean): void {
    for (const scene of this.current(chapter)?.scenes ?? []) scene.update(deltaSeconds, !viewLeft)
  }

  layout(_chapter: Chapter, ephemeris: Ephemeris): SceneLayout {
    return spacecraftLayout(ephemeris)
  }

  groundShot(): GroundShot | null {
    return null
  }

  shot(chapter: Chapter): LessonShot {
    const stage = stageOf(chapter)
    return this.vehicles[stage.vehicle].shot(stage.shot)
  }

  updateOverlays(_layout: SceneLayout, chapter: Chapter, { viewpoint }: StagedOverlayFrame): void {
    const shown = this.current(chapter)
    if (!shown) return
    const stage = stageOf(chapter)
    this.viewpoint = viewpoint
    for (const scene of shown.scenes) scene.prepare(viewpoint)
    shown.glow.update(viewpoint, shown.scenes.flatMap((scene) => scene.lamps))
    shown.room.update(viewpoint, stage.heights ? Object.values(shown.marks) : [])
    this.labels.begin()
    this.placeParts(shown.scenes, stage, viewpoint)
    if (stage.heights) this.placeHeights(shown, stage.vehicle, viewpoint)
    this.labels.finish()
  }

  hideOverlays(): void {
    this.labels.hideAll()
  }

  // The nearest point of the vehicle under a double click: a ray from the camera through it.
  pick(ndc: [number, number], chapter: Chapter): Vec3 | null {
    const shown = this.current(chapter)
    if (!shown || !this.viewpoint) return null
    const origin: Vec3 = [this.viewpoint.position[0], this.viewpoint.position[1], this.viewpoint.position[2]]
    const far = vec4.transformMat4(vec4.create(), [ndc[0], ndc[1], 1, 1], mat4.invert(mat4.create(), this.viewpoint.viewProjection) ?? mat4.create())
    const toFar = [far[0] / far[3] - origin[0], far[1] / far[3] - origin[1], far[2] / far[3] - origin[2]]
    const length = Math.hypot(toFar[0], toFar[1], toFar[2])
    const direction: Vec3 = [toFar[0] / length, toFar[1] / length, toFar[2] / length]
    const hits = shown.scenes.map((scene) => scene.pick(origin, direction)).filter((hit): hit is Vec3 => hit !== null)
    const distance = (hit: Vec3) => Math.hypot(hit[0] - origin[0], hit[1] - origin[1], hit[2] - origin[2])
    return hits.sort((a, b) => distance(a) - distance(b))[0] ?? null
  }

  // A vehicle's lessons look like film: contact shadows at the vehicle's scale, a vignette, a fine
  // grain, a warm grade.
  filmLook(chapter: Chapter): FilmLook {
    const config = this.vehicles[stageOf(chapter).vehicle]
    return { ...VEHICLE_FILM_LOOK, reach: config.occlusionReach, ...config.filmLook }
  }

  encodeBeforeScene(encoder: GPUCommandEncoder, chapter: Chapter): void {
    for (const scene of this.current(chapter)?.scenes ?? []) scene.encodeShadow(encoder)
  }

  drawBehindBodies(pass: GPURenderPassEncoder, chapter: Chapter): void {
    this.current(chapter)?.room.draw(pass)
  }

  drawInFrontOfBodies(pass: GPURenderPassEncoder, chapter: Chapter): void {
    const shown = this.current(chapter)
    if (!shown) return
    for (const scene of shown.scenes) scene.draw(pass)
    shown.glow.draw(pass)
  }

  drawOverlays(): void {}

  private current(chapter: Chapter): OnShow | undefined {
    return this.onShow.get(stageOf(chapter).vehicle)
  }

  private stage(chapter: Chapter, snap: boolean): void {
    const stage = stageOf(chapter)
    for (const scene of this.onShow.get(stage.vehicle)?.scenes ?? []) {
      if (snap) scene.start(stage)
      else scene.show(stage, false)
    }
  }

  // The chapter's parts that are still there, each in the model that has it.
  private placeParts(scenes: ModelScene<string>[], stage: VehicleStage, viewpoint: Viewpoint): void {
    const config = this.vehicles[stage.vehicle]
    for (const part of stage.labels ?? []) {
      const scene = scenes.find((candidate) => candidate.has(part))
      if (scene?.isShown(part)) this.labels.place(`${stage.vehicle}-${part}`, { text: config.partName(part), point: scene.anchor(part) }, viewpoint)
    }
  }

  // The heights marked on the walls, labelled in the corner between them.
  private placeHeights({ room, marks }: OnShow, vehicle: VehicleId, viewpoint: Viewpoint): void {
    const { facing, size } = room.shape
    const corner = -size.halfWidth * 0.98
    for (const [name, height] of Object.entries(marks)) {
      const point: Vec3 = [(facing.toward[0] + facing.right[0]) * corner, height, (facing.toward[2] + facing.right[2]) * corner]
      const mark = this.vehicles[vehicle].mark(name)
      this.labels.place(`${vehicle}-height-${name}`, { text: `${formatNumber(height, 1)} m · ${mark.label}`, point, variant: 'mark', note: mark.note }, viewpoint)
    }
  }

  private async load(vehicle: VehicleId): Promise<void> {
    const config = this.vehicles[vehicle]
    const { device, format } = this.gpu.models
    const [loaded, room, glow] = await Promise.all([
      Promise.all(config.models.map((model) => loadVehicleModel(this.gpu.models, model))),
      BlueprintRoom.create(device, format, config.room),
      LampGlow.create(device, format),
    ])
    const scenes = loaded.map(({ model, renderer, data }, index) => new ModelScene<string>(renderer, model, { ...config.turntable, ...pick(config.models[index]) }, data))
    this.onShow.set(vehicle, { scenes, room, glow, marks: loaded[0].model.marks ?? {} })
    if (this.chapter && stageOf(this.chapter).vehicle === vehicle) this.stage(this.chapter, true)
  }
}

// What of a model's config its scene takes: how it is lit and what it is made of.
function pick({ light, lamps, materials }: VehicleModel): Pick<VehicleModel, 'light' | 'lamps' | 'materials'> {
  return { light, lamps, materials }
}

function stageOf(chapter: Chapter): VehicleStage {
  if (!chapter.vehicle) throw new Error(`Chapter ${chapter.id} has no vehicle stage`)
  return chapter.vehicle
}
