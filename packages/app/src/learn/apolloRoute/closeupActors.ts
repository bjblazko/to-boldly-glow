import { mat4, vec3 } from 'gl-matrix'
import type { Viewpoint } from '../../camera/viewpoint'
import { hingeMatrix } from '../../spacecraft/modelHinge'
import type { ModelContext } from '../../spacecraft/modelRenderer'
import { COLUMBIA } from '../apollo/columbiaVehicle'
import { EAGLE } from '../apollo/eagleVehicle'
import { SATURN_V } from '../apollo/saturnVVehicle'
import { loadVehicleModel, type LoadedModel } from '../vehicle/vehicleAssets'
import type { VehicleModel } from '../vehicle/vehicleConfig'
import { actorMatrix, actorPoint, CLOSEUPS, posesAt, type ActorModel, type ActorPose, type CloseupId } from './closeupChoreography'
import { closeupFrame, closeupToSun, frameMatrix, framePoint } from './closeupFrames'
import type { VehicleLabel } from './routeOverlay'

// The outsides only: the vehicle lessons' first model of each.
const MODELS: Record<ActorModel, VehicleModel> = { saturnV: SATURN_V.models[0], csm: COLUMBIA.models[0], lm: EAGLE.models[0] }
const NO_HIGHLIGHT = { assembly: -1, strength: 0 }

type Loaded = Record<ActorModel, LoadedModel>

// The close-ups' vehicles on the GPU (the vehicle lessons' models, shared with them), loaded the
// first time the lesson opens: posed each frame from the close-up's choreography.
export class CloseupActors {
  private loaded: Loaded | null = null
  private loading: Promise<void> | null = null
  private shown: ActorModel[] = []

  constructor(private readonly models: ModelContext) {}

  load(): void {
    this.loading ??= Promise.all((Object.keys(MODELS) as ActorModel[]).map(async (id) => [id, await loadVehicleModel(this.models, MODELS[id])] as const))
      .then((entries) => {
        this.loaded = Object.fromEntries(entries) as Loaded
      })
      .catch((error: unknown) => console.warn('The Apollo 11 lesson could not load its vehicles.', error))
  }

  prepare(viewpoint: Viewpoint, id: CloseupId, seconds: number): void {
    const loaded = this.loaded
    this.shown = []
    if (!loaded) return
    const relative = cameraRelative(viewpoint)
    const frame = frameMatrix(closeupFrame(id), viewpoint.position)
    for (const actor of posesAt(id, seconds)) {
      const { model, renderer } = loaded[actor.model]
      const config = MODELS[actor.model]
      renderer.update(
        relative,
        {
          world: mat4.multiply(mat4.create(), frame, actorMatrix(actor)),
          toSun: closeupToSun(id),
          explode: actor.explode,
          highlight: NO_HIGHLIGHT,
          cut: 0,
          visibility: model.assemblies.map((assembly) => actor.visibility[assembly.id] ?? 1),
          light: config.light,
          materials: model.assemblies.map((assembly) => config.materials?.[assembly.id]),
          hinges: model.assemblies.map((assembly) => hingeMatrix(assembly.hinge, actor.fold)),
        },
        model.assemblies.map((assembly) => assembly.explode),
      )
      this.shown.push(actor.model)
    }
  }

  draw(pass: GPURenderPassEncoder): void {
    if (!this.loaded) return
    for (const model of this.shown) this.loaded[model].renderer.draw(pass)
  }

  // The close-up's labels: where its vehicles are named, in the scene (only those still shown).
  labels(id: CloseupId, seconds: number): VehicleLabel[] {
    const poses = posesAt(id, seconds)
    const frame = closeupFrame(id)
    return CLOSEUPS[id].labels.flatMap(({ name, model, point, assembly }) => {
      const actor = poses.find((candidate) => candidate.model === model)
      if (!actor || !shows(actor, assembly)) return []
      return [{ name, point: framePoint(frame, actorPoint(actor, point, assembly)) }]
    })
  }
}

// The view with the eye at the origin (its turn only, no move): drawn this way the models keep
// float32's precision, small numbers around the eye instead of the scene's hundreds of units.
function cameraRelative(viewpoint: Viewpoint): Viewpoint {
  const view = mat4.clone(viewpoint.view)
  view[12] = 0
  view[13] = 0
  view[14] = 0
  return { ...viewpoint, view, viewProjection: mat4.multiply(mat4.create(), viewpoint.projection, view), position: vec3.create() }
}

function shows(actor: ActorPose, assembly: string): boolean {
  return (actor.visibility[assembly] ?? 1) > 0.5
}
