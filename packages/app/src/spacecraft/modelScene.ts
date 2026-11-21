import type { Viewpoint } from '../camera/viewpoint'
import { StageTween } from '../learn/stageTween'
import { TOWARD_SUN, transformPoint, turntableMatrix } from '../learn/voyager/spacecraftStage'
import type { Vec3 } from '../math/tuples'
import type { ModelData, ModelDescription } from './modelFile'
import { TriangleGrid } from './modelGrid'
import { pickModel } from './modelPick'
import type { Lamp, Material, ModelRenderer } from './modelRenderer'

// What a chapter shows of a model: how far it is taken apart (0 to 1), the part picked out, how far
// it is cut open (0 to 1; models with an inside) and the parts already thrown off (faded out).
export interface ModelStage<Part extends string> {
  explode?: number
  highlight?: Part
  cut?: number
  gone?: readonly Part[]
  // Held at its starting angle, not turning (a cabin seen from inside).
  still?: boolean
}

export interface ModelSceneOptions {
  // Seconds per turn, and the angle it starts at (radians about its up axis).
  secondsPerTurn: number
  startAngle: number
  stageSeconds: number
  // How strong the sunlight and the fill are (see ModelPose.light; sunlit by default).
  light?: { sun: number; fill: number }
  // Lamps that light it from near by, in the model's own frame: they turn with it, and move with the
  // assembly they are fixed to when the model is taken apart.
  lamps?: readonly (Lamp & { fixedTo?: string })[]
  // Materials by part (a soft plastic sheen for the rest).
  materials?: Readonly<Record<string, Material>>
}

// How quickly the model turns its cut toward the camera (per second, of the angle left).
const FACE_RATE = 2.5

// A model on its own (a spacecraft, a rocket), turning slowly - holding still while the user turns
// the view themselves, or while it is cut open, its cut turned toward the camera. It eases from one
// chapter's stage to the next.
export class ModelScene<Part extends string> {
  // The triangles sorted by place, made the first time a step needs them.
  private grid: TriangleGrid | null = null
  private angle: number
  private readonly stage: StageTween<'explode' | 'highlight' | 'cut'>
  private readonly fades: StageTween<string>
  // Stays set while the glow fades out after the chapter that picked it.
  private highlighted: Part | undefined
  // Where the camera stood last frame, seen from the model: the cut turns toward it.
  private cameraAngle: number | null = null
  // The lamps where they are this frame (turned with the model).
  private lampsNow: readonly Lamp[] = []
  private still = false

  constructor(
    private readonly renderer: ModelRenderer,
    private readonly model: ModelDescription,
    private readonly options: ModelSceneOptions,
    // The model's triangles, for finding what a double click points at (none: it can't be picked).
    private readonly geometry: ModelData | null = null,
  ) {
    this.angle = options.startAngle
    this.stage = new StageTween(['explode', 'highlight', 'cut'], options.stageSeconds)
    this.fades = new StageTween(model.assemblies.map((assembly) => assembly.id), options.stageSeconds)
    this.fades.moveTo(this.visibility([]), true)
  }

  start(stage: ModelStage<Part>): void {
    this.angle = this.options.startAngle
    this.show(stage, true)
  }

  show(stage: ModelStage<Part>, snap: boolean): void {
    this.still = stage.still ?? false
    if (stage.highlight) this.highlighted = stage.highlight
    this.stage.moveTo({ explode: stage.explode ?? 0, highlight: stage.highlight ? 1 : 0, cut: stage.cut ?? 0 }, snap)
    this.fades.moveTo(this.visibility(stage.gone ?? []), snap)
  }

  update(deltaSeconds: number, turning = true): void {
    if (this.still) this.turnToward(deltaSeconds, this.options.startAngle)
    else if (this.stage.current.cut > 0 && this.cameraAngle !== null) this.turnToward(deltaSeconds, this.cameraAngle - Math.PI / 4)
    else if (turning) this.angle += (deltaSeconds * 2 * Math.PI) / this.options.secondsPerTurn
    this.stage.update(deltaSeconds)
    this.fades.update(deltaSeconds)
  }

  // Where a part's label points, in the scene (metres; the model stands at the origin).
  anchor(part: Part): Vec3 {
    const offset = this.model.assemblies[this.assemblyIndex(part)].explode
    const point = this.model.anchors[part].map((value, axis) => value + offset[axis] * this.stage.current.explode)
    return transformPoint(turntableMatrix(this.angle, 1), point)
  }

  // Whether the model has this part at all.
  has(part: string): boolean {
    return this.model.assemblies.some((assembly) => assembly.id === part)
  }

  // Whether a part is there to be labelled (not thrown off).
  isShown(part: Part): boolean {
    return (this.fades.current[part] ?? 1) > 0.5
  }

  // Before the frame's render pass: the model's pose for this frame.
  prepare(viewpoint: Viewpoint): void {
    const { explode, highlight: strength, cut } = this.stage.current
    const highlight = { assembly: this.highlighted ? this.assemblyIndex(this.highlighted) : -1, strength }
    const visibility = this.model.assemblies.map((assembly) => this.fades.current[assembly.id])
    const world = turntableMatrix(this.angle, 1)
    const lamps = this.options.lamps?.map(({ fixedTo, ...lamp }) => ({ ...lamp, place: transformPoint(world, this.moved(lamp.place, fixedTo)) }))
    this.lampsNow = lamps ?? []
    const materials = this.model.assemblies.map((assembly) => this.options.materials?.[assembly.id])
    const pose = { world, toSun: TOWARD_SUN, explode, highlight, cut, visibility, light: this.options.light, lamps, materials }
    this.renderer.update(viewpoint, pose, this.model.assemblies.map((assembly) => assembly.explode))
    this.cameraAngle = Math.atan2(viewpoint.position[0], viewpoint.position[2])
  }

  // Where a ray (world space) first meets what the picture shows of the model, or null.
  pick(origin: Vec3, direction: Vec3): Vec3 | null {
    const distance = this.hitDistance(origin, direction)
    if (distance === null) return null
    return [origin[0] + direction[0] * distance, origin[1] + direction[1] * distance, origin[2] + direction[2] * distance]
  }

  // How far along a ray (world space, unit direction) the model first stands in the way, or null;
  // `within` limits the look to a short stretch (a step), which then tests only nearby triangles.
  hitDistance(origin: Vec3, direction: Vec3, within?: number): number | null {
    if (!this.geometry) return null
    // The turntable only turns about +Y (no move, no scale): its inverse turns back, and it turns
    // directions as it turns points (and keeps distances).
    const toModel = turntableMatrix(-this.angle, 1)
    const from = transformPoint(toModel, origin)
    const along = transformPoint(toModel, direction)
    const state = this.pickState()
    const resting = state.moved.every((offset) => offset.every((value) => value === 0))
    if (within === undefined || !resting) return pickModel(this.geometry, from, along, state)
    const to = from.map((value, axis) => value + along[axis] * within) as Vec3
    const lo = from.map((value, axis) => Math.min(value, to[axis])) as Vec3
    const hi = from.map((value, axis) => Math.max(value, to[axis])) as Vec3
    this.grid ??= new TriangleGrid(this.geometry)
    const distance = pickModel(this.geometry, from, along, { ...state, triangles: this.grid.near(lo, hi) })
    return distance !== null && distance <= within ? distance : null
  }

  // What the picture shows this frame, as pickModel tests it (the shader's rules: faded parts and
  // closed insides don't show, and a shell loses the quarter between +X and +Z below the cut).
  private pickState() {
    const { explode, cut } = this.stage.current
    const { min, max } = this.model.bounds
    const highest = Math.max(0, ...this.model.assemblies.map((assembly) => assembly.explode[1]))
    const cutHeight = min[1] + cut * (max[1] + highest - min[1])
    const kind = (index: number) => this.model.assemblies[index]?.kind ?? 'solid'
    return {
      moved: this.model.assemblies.map((assembly) => assembly.explode.map((value) => value * explode) as Vec3),
      shown: (index: number) => (this.fades.current[this.model.assemblies[index]?.id] ?? 1) > 0.5 && !(kind(index) === 'inside' && cut <= 0),
      cutAway: (index: number, [x, y, z]: Vec3) => kind(index) === 'shell' && cut > 0 && x > 0 && z > 0 && y < cutHeight,
    }
  }

  // The model's lamps as they were placed for this frame (see prepare).
  get lamps(): readonly Lamp[] {
    return this.lampsNow
  }

  // Before the scene's pass: the model's lamp shadow map, if it has one.
  encodeShadow(encoder: GPUCommandEncoder): void {
    this.renderer.encodeShadow(encoder)
  }

  draw(pass: GPURenderPassEncoder): void {
    this.renderer.draw(pass)
  }

  // Eases the turn toward an angle. The cut quarter (between the model's +X and +Z) faces the
  // camera at the camera's angle less 45°: turned by `angle` about the up axis, its middle points
  // along (sin(angle + 45°), cos(angle + 45°)) in x and z.
  private turnToward(deltaSeconds: number, target: number): void {
    const left = Math.atan2(Math.sin(target - this.angle), Math.cos(target - this.angle))
    this.angle += left * Math.min(1, deltaSeconds * FACE_RATE)
  }

  // A point fixed to an assembly, moved as far as that assembly is taken apart.
  private moved(point: Vec3, assembly: string | undefined): Vec3 {
    const offset = this.model.assemblies.find((candidate) => candidate.id === assembly)?.explode ?? [0, 0, 0]
    const amount = this.stage.current.explode
    return [point[0] + offset[0] * amount, point[1] + offset[1] * amount, point[2] + offset[2] * amount]
  }

  private visibility(gone: readonly Part[]): Record<string, number> {
    return Object.fromEntries(this.model.assemblies.map((assembly) => [assembly.id, gone.includes(assembly.id as Part) ? 0 : 1]))
  }

  private assemblyIndex(part: Part): number {
    return this.model.assemblies.findIndex((assembly) => assembly.id === part)
  }
}
