import { mat4 } from 'gl-matrix'
import type { Viewpoint } from '../../camera/viewpoint'
import { actorMatrix, type ActorModel, type ActorPose } from '../../learn/apolloRoute/closeupChoreography'
import { COLUMBIA } from '../../learn/apollo/columbiaVehicle'
import { EAGLE } from '../../learn/apollo/eagleVehicle'
import { SATURN_V } from '../../learn/apollo/saturnVVehicle'
import { loadVehicleModel, type LoadedModel } from '../../learn/vehicle/vehicleAssets'
import type { VehicleModel } from '../../learn/vehicle/vehicleConfig'
import type { Vec3 } from '../../math/tuples'
import { hingeMatrix } from '../../spacecraft/modelHinge'
import { ModelRenderer, type ModelContext } from '../../spacecraft/modelRenderer'
import type { Apollo11Scene, Craft } from './apollo11Scene'
import { craftAt, type CraftCast } from './craftChoreography'
import { columbiaAttitude, eagleAttitude } from './craftAttitude'
import { craftViewpoint, squeezedProjection, sunlit } from './craftPass'

// The craft on the GPU - the vehicle lessons' outside models (shared with them) - placed each frame
// where the reconstruction has them, turned as they flew, lit by the Sun unless Earth or the Moon is
// in the way, and drawn in the metre pass (craftPass.ts).

const MODELS: Record<ActorModel, VehicleModel> = { saturnV: SATURN_V.models[0], csm: COLUMBIA.models[0], lm: EAGLE.models[0] }
const NO_HIGHLIGHT = { assembly: -1, strength: 0 }
// The metre pass's planes (m): close enough for a camera against the hull, far enough for a craft
// several kilometres off.
const NEAR_M = 0.2
const FAR_M = 60_000

type Slot = 'saturnV' | 'csm' | 'lm' | 'eagle' | 'site'
interface Placed {
  slot: Slot
  actor: ActorPose
  // Model frame to camera-relative metres.
  world: mat4
}

export class Apollo11CraftRenderer {
  private loaded: Record<Slot, LoadedModel> | null = null
  private shown: Slot[] = []

  constructor(private readonly models: ModelContext) {}

  async load(): Promise<void> {
    if (this.loaded) return
    const one = (model: ActorModel) => loadVehicleModel(this.models, MODELS[model])
    const [saturnV, csm, lm] = await Promise.all([one('saturnV'), one('csm'), one('lm')])
    // Eagle on its own and the descent stage left behind are two more of the LM.
    const copy = async (): Promise<LoadedModel> => ({ ...lm, renderer: await ModelRenderer.create(this.models, lm.data, MODELS.lm.url) })
    const [eagle, site] = await Promise.all([copy(), copy()])
    this.loaded = { saturnV, csm, lm, eagle, site }
  }

  // `cameraKm`: the camera relative to the scene's origin.
  prepare(world: Viewpoint, scene: Apollo11Scene, camera: { km: Vec3; fov: number; lensShift: { x: number; y: number } }): void {
    this.shown = []
    if (!this.loaded) return
    const projection = squeezedProjection({ fov: camera.fov, aspect: world.pixels.width / Math.max(1, world.pixels.height), near: NEAR_M, far: FAR_M, lensShift: camera.lensShift })
    const viewpoint = craftViewpoint(world, projection)
    const toSun = scene.toSun
    const bodies = [{ centreKm: scene.earthKm(), radiusKm: 6378 }, { centreKm: scene.moonKm(), radiusKm: 1737.4 }]
    for (const { slot, actor, world: model } of placed(scene, craftAt(scene.get), camera.km)) {
      const { renderer, model: description } = this.loaded[slot]
      const config = MODELS[actor.model]
      const at: Vec3 = [model[12] / 1000 + camera.km[0], model[13] / 1000 + camera.km[1], model[14] / 1000 + camera.km[2]]
      const light = config.light ? { ...config.light, sun: (config.light.sun ?? 1) * sunlit(at, bodies, toSun) } : { sun: sunlit(at, bodies, toSun), fill: 0.08 }
      renderer.update(
        viewpoint,
        {
          world: mat4.multiply(mat4.create(), model, actorMatrix(actor)),
          toSun,
          explode: actor.explode,
          highlight: NO_HIGHLIGHT,
          cut: 0,
          visibility: description.assemblies.map((assembly) => actor.visibility[assembly.id] ?? 1),
          light,
          materials: description.assemblies.map((assembly) => config.materials?.[assembly.id]),
          hinges: description.assemblies.map((assembly) => hingeMatrix(assembly.hinge, actor.fold)),
        },
        description.assemblies.map((assembly) => assembly.explode),
      )
      this.shown.push(slot)
    }
  }

  draw(pass: GPURenderPassEncoder): void {
    if (!this.loaded) return
    for (const slot of this.shown) this.loaded[slot].renderer.draw(pass)
  }
}

// Each craft's frame: at its place (camera-relative, metres) turned by its attitude.
function frameAt(scene: Apollo11Scene, craft: Craft, cameraKm: Vec3, turn: mat4): mat4 | null {
  const km = scene.craftKm(craft)
  if (!km) return null
  const m = mat4.fromTranslation(mat4.create(), [(km[0] - cameraKm[0]) * 1000, (km[1] - cameraKm[1]) * 1000, (km[2] - cameraKm[2]) * 1000])
  return mat4.multiply(m, m, turn)
}

function placed(scene: Apollo11Scene, cast: CraftCast, cameraKm: Vec3): Placed[] {
  const motion = scene.motion('columbia')
  const eagleMotion = scene.motion('eagle')
  if (!motion) return []
  const [columbiaKm, eagleKm] = [scene.craftKm('columbia'), scene.craftKm('eagle')]
  const toward = (from: Vec3 | null, to: Vec3 | null): Vec3 | null => (from && to && Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) > 1e-6 ? [to[0] - from[0], to[1] - from[1], to[2] - from[2]] : null)
  const columbiaTurn = columbiaAttitude({ get: scene.get, ...motion, toOther: toward(columbiaKm, eagleKm) })
  const columbia = frameAt(scene, 'columbia', cameraKm, columbiaTurn)
  const out: Placed[] = []
  if (columbia) for (const actor of cast.columbia) out.push({ slot: actor.model, actor, world: columbia })
  if (cast.eagle && eagleMotion) {
    const turn = cast.eagle.frame === 'columbia' ? columbiaTurn : eagleAttitude({ get: scene.get, ...eagleMotion, toOther: toward(eagleKm, columbiaKm) })
    const frame = frameAt(scene, 'eagle', cameraKm, turn)
    if (frame) out.push({ slot: 'eagle', actor: cast.eagle.pose, world: frame })
  }
  return out.concat(siteStage(scene, cast, cameraKm))
}

// The descent stage stands where Eagle landed, upright on the ground.
function siteStage(scene: Apollo11Scene, cast: CraftCast, cameraKm: Vec3): Placed[] {
  if (!cast.site) return []
  const site = scene.siteKm()
  if (!site) return []
  const up = scene.moonUpAt(site)
  const m = mat4.fromTranslation(mat4.create(), [(site[0] - cameraKm[0]) * 1000, (site[1] - cameraKm[1]) * 1000, (site[2] - cameraKm[2]) * 1000])
  mat4.multiply(m, m, eagleAttitude({ get: 1e9, velocity: [1, 0, 0], up, toOther: null, altitudeKm: 0 }))
  return [{ slot: 'site', actor: cast.site, world: m }]
}
