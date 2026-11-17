import type { Viewpoint } from '../../camera/viewpoint'
import type { Vec3 } from '../../math/tuples'
import type { ModelDescription } from '../../spacecraft/modelFile'
import type { ModelRenderer } from '../../spacecraft/modelRenderer'
import { StageTween } from '../stageTween'
import { TOWARD_SUN, transformPoint, turntableMatrix } from './spacecraftStage'
import type { VoyagerPart, VoyagerStage } from './voyagerStage'

// One turn every 90 seconds: slow enough to read the labels while it turns.
const TURN_RADIANS_PER_SECOND = (2 * Math.PI) / 90
// Starts turned so the dish, the booms and the record all face the camera.
const START_ANGLE = -0.5
const STAGE_SECONDS = 2.2

// The Voyager spacecraft on its own, turning slowly (holding still while the user turns the view
// themselves): taken apart for the exploded view, one part
// picked out with a glow.
export class ProbeScene {
  private angle = START_ANGLE
  private readonly stage = new StageTween(['explode', 'highlight'], STAGE_SECONDS)
  // Stays set while the glow fades out after the chapter that picked it.
  private highlighted: VoyagerPart | undefined

  constructor(
    private readonly renderer: ModelRenderer,
    private readonly model: ModelDescription,
  ) {}

  start(stage: VoyagerStage): void {
    this.angle = START_ANGLE
    this.show(stage, true)
  }

  show(stage: VoyagerStage, snap: boolean): void {
    if (stage.highlight) this.highlighted = stage.highlight
    this.stage.moveTo({ explode: stage.explode ?? 0, highlight: stage.highlight ? 1 : 0 }, snap)
  }

  update(deltaSeconds: number, turning = true): void {
    if (turning) this.angle += deltaSeconds * TURN_RADIANS_PER_SECOND
    this.stage.update(deltaSeconds)
  }

  // Where a part's label points, in the scene (metres; the probe stands at the origin).
  anchor(part: VoyagerPart): Vec3 {
    const index = this.assemblyIndex(part)
    const offset = this.model.assemblies[index].explode
    const point = this.model.anchors[part].map((value, axis) => value + offset[axis] * this.stage.current.explode)
    return transformPoint(turntableMatrix(this.angle, 1), point)
  }

  // Before the frame's render pass: the probe's pose for this frame.
  prepare(viewpoint: Viewpoint): void {
    const { explode, highlight: strength } = this.stage.current
    const highlight = { assembly: this.highlighted ? this.assemblyIndex(this.highlighted) : -1, strength }
    const pose = { world: turntableMatrix(this.angle, 1), toSun: TOWARD_SUN, explode, highlight }
    this.renderer.update(viewpoint, pose, this.model.assemblies.map((assembly) => assembly.explode))
  }

  draw(pass: GPURenderPassEncoder): void {
    this.renderer.draw(pass)
  }

  private assemblyIndex(part: VoyagerPart): number {
    return this.model.assemblies.findIndex((assembly) => assembly.id === part)
  }
}
