import { mat4, vec3 } from 'gl-matrix'
import type { Viewpoint } from '../../camera/viewpoint'
import { actorMatrix, type ActorModel, type ActorPose } from '../../learn/apolloRoute/closeupChoreography'
import { COLUMBIA } from '../../learn/apollo/columbiaVehicle'
import { EAGLE } from '../../learn/apollo/eagleVehicle'
import { SATURN_V } from '../../learn/apollo/saturnVVehicle'
import { loadVehicleModel, type LoadedModel } from '../../learn/vehicle/vehicleAssets'
import type { VehicleModel } from '../../learn/vehicle/vehicleConfig'
import type { Vec3 } from '../../math/tuples'
import { hingeMatrix } from '../../spacecraft/modelHinge'
import { ModelRenderer, type Lamp, type ModelContext } from '../../spacecraft/modelRenderer'
import type { Apollo11Scene, Craft } from './apollo11Scene'
import { craftAt, type CraftCast } from './craftChoreography'
import { eagleAttitude } from './craftAttitude'
import { craftTurns } from './craftTurns'
import { craftViewpoint, squeezedProjection, sunlit } from './craftPass'
import { lunarGround, type Site } from './lunarGround'
import { EnginePlumes, type Plume } from './enginePlume'
import { burnsAt, NOZZLES } from './engineBurns'
import { bounceFrom, EARTH_LIGHT, MOON_LIGHT, SPACE_FILL, type BodyLight } from './spaceLight'

// The craft on the GPU - the vehicle lessons' outside models (shared with them) - placed each frame
// where the reconstruction has them, turned as they flew, lit by the Sun unless Earth or the Moon is
// in the way, and drawn in the metre pass (craftPass.ts).

const MODELS: Record<ActorModel, VehicleModel> = { saturnV: SATURN_V.models[0], csm: COLUMBIA.models[0], lm: EAGLE.models[0] }
const NO_HIGHLIGHT = { assembly: -1, strength: 0 }
const SUN_STRENGTH = 1.15
const GROUND_MATERIAL = { shininess: 4, shine: 0.02 }
// The ground is drawn while the camera is within this of the site (km).
const GROUND_KM = 200

interface SceneLight {
  toSun: Vec3
  // The burning engines' light on the craft.
  lamps: Lamp[]
  shadows: { centreKm: Vec3; radiusKm: number }[]
  bodies: BodyLight[]
}

// The metre pass's planes for what it draws (each as a sphere, camera-relative metres): the near one
// halfway to the nearest hull, the far one past the farthest - so the depth buffer's steps fall
// where the craft are; with the ground, out to its horizon.
export function metrePlanes(spheres: { centre: Vec3; radius: number }[], groundM: number | null): { near: number; far: number } {
  const gaps = spheres.map(({ centre, radius }) => Math.hypot(...centre) - radius)
  const reach = spheres.map(({ centre, radius }) => Math.hypot(...centre) + radius)
  // Halfway to the nearest hull - and with the ground drawn, half the camera's height over it.
  const near = Math.max(0.05, Math.min(Math.min(Infinity, ...gaps) * 0.5, groundM === null ? Infinity : Math.max(0.1, groundM * 0.5)))
  return { near, far: Math.max(near * 100, ...reach.map((r) => r * 1.5), groundM === null ? 0 : 60_000) }
}

type Slot = 'saturnV' | 'csm' | 'lm' | 'eagle' | 'site' | 'ground'
interface Placed {
  slot: Slot
  actor: ActorPose
  // Model frame to camera-relative metres.
  world: mat4
}

export class Apollo11CraftRenderer {
  private loaded: Record<Slot, LoadedModel> | null = null
  private plumes: EnginePlumes | null = null
  private plumesShown = false
  private shown: Slot[] = []

  constructor(private readonly models: ModelContext) {}

  // The vehicle lessons' models, each with renderers of its own that cast the Sun's shadows (Eagle on
  // its own and the descent stage left behind are two more of the LM), and the ground at the site.
  async load(site: Site): Promise<void> {
    if (this.loaded) return
    const own = async (model: ActorModel): Promise<LoadedModel> => {
      const { data } = await loadVehicleModel(this.models, MODELS[model])
      return { model: data.description, data, renderer: await ModelRenderer.create(this.models, data, MODELS[model].url, { shadows: true }) }
    }
    const [saturnV, csm, lm, eagle, siteStage] = await Promise.all([own('saturnV'), own('csm'), own('lm'), own('lm'), own('lm')])
    const groundData = lunarGround(site)
    const ground = { model: groundData.description, data: groundData, renderer: await ModelRenderer.create(this.models, groundData, 'textures') }
    this.plumes = await EnginePlumes.create(this.models.device, this.models.format)
    this.loaded = { saturnV, csm, lm, eagle, site: siteStage, ground }
  }

  // Before the scene's pass: the Sun's shadow maps of the craft shown.
  encodeShadows(encoder: GPUCommandEncoder): void {
    if (!this.loaded) return
    for (const slot of this.shown) this.loaded[slot].renderer.encodeShadow(encoder)
  }

  // `camera.km`: the camera relative to the scene's origin.
  prepare(world: Viewpoint, scene: Apollo11Scene, camera: { km: Vec3; fov: number; lensShift: { x: number; y: number } }): void {
    this.shown = []
    if (!this.loaded) return
    const items = placed(scene, craftAt(scene.get), camera.km)
    const ground = groundAt(scene, camera.km)
    const planes = metrePlanes(items.map((item) => this.sphereOf(item)), ground ? heightOver(ground) : null)
    const projection = squeezedProjection({ fov: camera.fov, aspect: world.pixels.width / Math.max(1, world.pixels.height), ...planes, lensShift: camera.lensShift })
    const viewpoint = craftViewpoint(world, projection)
    const plumes = plumesAt(scene, camera.km)
    this.plumes?.update(viewpoint, plumes)
    this.plumesShown = plumes.length > 0
    const lamps = plumes.map(plumeLamp)
    const light = { toSun: scene.toSun, lamps, shadows: [{ centreKm: scene.earthKm(), radiusKm: 6378 }, { centreKm: scene.moonKm(), radiusKm: 1737.4 }], bodies: [{ ...EARTH_LIGHT, centreKm: scene.earthKm() }, { ...MOON_LIGHT, centreKm: scene.moonKm() }] }
    for (const item of items) this.prepareOne(viewpoint, item, light, camera.km)
    if (ground) this.prepareGround(viewpoint, ground.world, scene.toSun)
  }

  // An item's bounds as a sphere, camera-relative (metres).
  private sphereOf({ slot, actor, world }: Placed): { centre: Vec3; radius: number } {
    const { min, max } = this.loaded![slot].model.bounds
    const middle = vec3.transformMat4(vec3.create(), [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], mat4.multiply(mat4.create(), world, actorMatrix(actor)))
    return { centre: [middle[0], middle[1], middle[2]], radius: Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 }
  }

  private prepareOne(viewpoint: Viewpoint, { slot, actor, world }: Placed, light: SceneLight, cameraKm: Vec3): void {
    const { renderer, model: description } = this.loaded![slot]
    const config = MODELS[actor.model]
    const at: Vec3 = [world[12] / 1000 + cameraKm[0], world[13] / 1000 + cameraKm[1], world[14] / 1000 + cameraKm[2]]
    renderer.update(
      viewpoint,
      {
        world: mat4.multiply(mat4.create(), world, actorMatrix(actor)),
        toSun: light.toSun,
        explode: actor.explode,
        highlight: NO_HIGHLIGHT,
        cut: 0,
        visibility: description.assemblies.map((assembly) => actor.visibility[assembly.id] ?? 1),
        light: { sun: SUN_STRENGTH * sunlit(at, light.shadows, light.toSun), fill: SPACE_FILL },
        materials: description.assemblies.map((assembly) => config.materials?.[assembly.id]),
        hinges: description.assemblies.map((assembly) => hingeMatrix(assembly.hinge, actor.fold)),
        space: { bounce: bounceFrom(at, light.bodies, light.toSun) },
        lamps: light.lamps,
      },
      description.assemblies.map((assembly) => assembly.explode),
    )
    this.shown.push(slot)
  }

  private prepareGround(viewpoint: Viewpoint, world: mat4, toSun: Vec3): void {
    const { renderer } = this.loaded!.ground
    renderer.update(viewpoint, { world, toSun, explode: 0, highlight: NO_HIGHLIGHT, cut: 0, light: { sun: SUN_STRENGTH, fill: SPACE_FILL }, materials: [GROUND_MATERIAL], space: { bounce: null } }, [[0, 0, 0]])
    this.shown.push('ground')
  }

  draw(pass: GPURenderPassEncoder): void {
    if (!this.loaded) return
    for (const slot of this.shown) this.loaded[slot].renderer.draw(pass)
    if (this.plumesShown) this.plumes?.draw(pass)
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
  const turns = craftTurns(scene, cast)
  const out: Placed[] = []
  const columbia = turns.columbia ? frameAt(scene, 'columbia', cameraKm, turns.columbia) : null
  if (columbia) for (const actor of cast.columbia) out.push({ slot: actor.model, actor, world: columbia })
  const eagle = cast.eagle && turns.eagle ? frameAt(scene, 'eagle', cameraKm, turns.eagle) : null
  if (cast.eagle && eagle) out.push({ slot: 'eagle', actor: cast.eagle.pose, world: eagle })
  return out.concat(siteStage(scene, cast, cameraKm))
}

// How high the camera is over the ground's level (m): the site seen from the camera, along up.
function heightOver({ world, up }: Ground): number {
  return Math.abs(world[12] * up[0] + world[13] * up[1] + world[14] * up[2])
}

interface Ground {
  world: mat4
  up: Vec3
}

// The engines burning now, in camera-relative metres: each nozzle on its craft as that is placed
// and turned (the J-2 only while the third stage is still on).
function plumesAt(scene: Apollo11Scene, cameraKm: Vec3): Plume[] {
  const cast = craftAt(scene.get)
  const turns = craftTurns(scene, cast)
  return burnsAt(scene.get).flatMap(({ engine, strength }) => {
    const nozzle = NOZZLES[engine]
    const turn = turns[nozzle.craft]
    if (!turn || (engine === 'j2' && !cast.columbia.some((actor) => actor.model === 'saturnV'))) return []
    const frame = frameAt(scene, nozzle.craft, cameraKm, turn)
    if (!frame) return []
    const exit = vec3.transformMat4(vec3.create(), nozzle.exit, frame)
    const way = vec3.normalize(vec3.create(), vec3.transformMat4(vec3.create(), [0, -1, 0], turn))
    return [{ exit: [exit[0], exit[1], exit[2]], way: [way[0], way[1], way[2]], radius: nozzle.radius, length: nozzle.length, color: nozzle.color, strength }]
  })
}

// An engine's light on its own craft: a lamp just behind the exit, warm and strong.
const PLUME_LAMP = 260
function plumeLamp(plume: Plume): Lamp {
  const place: Vec3 = [0, 1, 2].map((k) => plume.exit[k] + plume.way[k] * plume.radius * 1.5) as Vec3
  return { place, reach: 80, color: plume.color.map((c) => c * PLUME_LAMP * plume.strength) as Vec3 }
}

// The ground round the site (in the Moon's axes, camera-relative metres), while the camera is near.
function groundAt(scene: Apollo11Scene, cameraKm: Vec3): Ground | null {
  const site = scene.siteMoonFrameKm()
  if (!site) return null
  const axes = scene.moonAxesNow()
  const moon = scene.moonKm()
  const turned = vec3.transformMat4(vec3.create(), site, axes)
  const siteKm: Vec3 = [moon[0] + turned[0], moon[1] + turned[1], moon[2] + turned[2]]
  if (Math.hypot(siteKm[0] - cameraKm[0], siteKm[1] - cameraKm[1], siteKm[2] - cameraKm[2]) > GROUND_KM) return null
  const m = mat4.fromTranslation(mat4.create(), [(siteKm[0] - cameraKm[0]) * 1000, (siteKm[1] - cameraKm[1]) * 1000, (siteKm[2] - cameraKm[2]) * 1000])
  return { world: mat4.multiply(m, m, axes), up: scene.moonUpAt(siteKm) }
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
