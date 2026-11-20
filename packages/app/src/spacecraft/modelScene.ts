import type { Viewpoint } from '../camera/viewpoint'
import { StageTween } from '../learn/stageTween'
import { TOWARD_SUN, transformPoint, turntableMatrix } from '../learn/voyager/spacecraftStage'
import type { Vec3 } from '../math/tuples'
import type { ModelDescription } from './modelFile'
import type { ModelRenderer } from './modelRenderer'

// What a chapter shows of a model: how far it is taken apart (0 to 1), the part picked out, how far
// it is cut open (0 to 1; models with an inside) and the parts already thrown off (faded out).
export interface ModelStage<Part extends string> {
  explode?: number
  highlight?: Part
  cut?: number
  gone?: readonly Part[]
}

export interface ModelSceneOptions {
  // Seconds per turn, and the angle it starts at (radians about its up axis).
  secondsPerTurn: number
  startAngle: number
  stageSeconds: number
}

// How quickly the model turns its cut toward the camera (per second, of the angle left).
const FACE_RATE = 2.5

// A model on its own (a spacecraft, a rocket), turning slowly - holding still while the user turns
// the view themselves, or while it is cut open, its cut turned toward the camera. It eases from one
// chapter's stage to the next.
export class ModelScene<Part extends string> {
  private angle: number
  private readonly stage: StageTween<'explode' | 'highlight' | 'cut'>
  private readonly fades: StageTween<string>
  // Stays set while the glow fades out after the chapter that picked it.
  private highlighted: Part | undefined
  // Where the camera stood last frame, seen from the model: the cut turns toward it.
  private cameraAngle: number | null = null

  constructor(
    private readonly renderer: ModelRenderer,
    private readonly model: ModelDescription,
    private readonly options: ModelSceneOptions,
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
    if (stage.highlight) this.highlighted = stage.highlight
    this.stage.moveTo({ explode: stage.explode ?? 0, highlight: stage.highlight ? 1 : 0, cut: stage.cut ?? 0 }, snap)
    this.fades.moveTo(this.visibility(stage.gone ?? []), snap)
  }

  update(deltaSeconds: number, turning = true): void {
    if (this.stage.current.cut > 0 && this.cameraAngle !== null) this.faceCamera(deltaSeconds, this.cameraAngle)
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

  // Whether a part is there to be labelled (not thrown off).
  isShown(part: Part): boolean {
    return (this.fades.current[part] ?? 1) > 0.5
  }

  // Before the frame's render pass: the model's pose for this frame.
  prepare(viewpoint: Viewpoint): void {
    const { explode, highlight: strength, cut } = this.stage.current
    const highlight = { assembly: this.highlighted ? this.assemblyIndex(this.highlighted) : -1, strength }
    const visibility = this.model.assemblies.map((assembly) => this.fades.current[assembly.id])
    const pose = { world: turntableMatrix(this.angle, 1), toSun: TOWARD_SUN, explode, highlight, cut, visibility }
    this.renderer.update(viewpoint, pose, this.model.assemblies.map((assembly) => assembly.explode))
    this.cameraAngle = Math.atan2(viewpoint.position[0], viewpoint.position[2])
  }

  draw(pass: GPURenderPassEncoder): void {
    this.renderer.draw(pass)
  }

  // The cut quarter (between the model's +X and +Z) turned toward the camera: about the up axis
  // by `angle`, its middle points along (sin(angle + 45°), cos(angle + 45°)) in x and z.
  private faceCamera(deltaSeconds: number, cameraAngle: number): void {
    const target = cameraAngle - Math.PI / 4
    const left = Math.atan2(Math.sin(target - this.angle), Math.cos(target - this.angle))
    this.angle += left * Math.min(1, deltaSeconds * FACE_RATE)
  }

  private visibility(gone: readonly Part[]): Record<string, number> {
    return Object.fromEntries(this.model.assemblies.map((assembly) => [assembly.id, gone.includes(assembly.id as Part) ? 0 : 1]))
  }

  private assemblyIndex(part: Part): number {
    return this.model.assemblies.findIndex((assembly) => assembly.id === part)
  }
}
