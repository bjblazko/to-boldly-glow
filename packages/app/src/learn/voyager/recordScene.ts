import { mat4 } from 'gl-matrix'
import type { Viewpoint } from '../../camera/viewpoint'
import type { Vec3 } from '../../math/tuples'
import type { ModelRenderer } from '../../spacecraft/modelRenderer'
import { StageTween } from '../stageTween'
import { featureAnchor } from './goldenRecordMesh'
import { TOWARD_SUN, transformPoint } from './spacecraftStage'
import type { RecordFeature, VoyagerStage } from './voyagerStage'

// The record is drawn 20 times its size: the lessons' camera keeps at least 5 units away.
export const RECORD_SCALE = 20
const TURN_SECONDS = 2.4
// A slow sway, so the light glints across the gold.
const SWAY_RADIANS = 0.12
const SWAY_SECONDS = 14
// The record's textures are photos, lit when they were taken: shown nearly as photographed, with a
// little sunlight on top for the gold to glint as it sways.
const PHOTO_LIGHT = { sun: 0.35, fill: 0.85 }
// The record's own speed, given on its cover: one turn in 3.6 seconds.
const PLAY_RADIANS_PER_SECOND = (2 * Math.PI) / 3.6

// The Golden Record facing the camera (along +Z), turned over between its cover and the record.
export class RecordScene {
  private readonly stage = new StageTween(['turn'], TURN_SECONDS)
  private seconds = 0
  private spin = 0
  private spinning = false

  constructor(private readonly renderer: ModelRenderer) {}

  start(stage: VoyagerStage): void {
    this.seconds = 0
    this.show(stage, true)
  }

  show(stage: VoyagerStage, snap: boolean): void {
    this.spinning = stage.spinning ?? false
    this.stage.moveTo({ turn: stage.side === 'label' ? Math.PI : 0 }, snap)
  }

  update(deltaSeconds: number): void {
    this.seconds += deltaSeconds
    if (this.spinning) this.spin += deltaSeconds * PLAY_RADIANS_PER_SECOND
    this.stage.update(deltaSeconds)
  }

  // Where an engraving's label points (only meaningful while the cover faces the camera).
  anchor(feature: RecordFeature): Vec3 {
    return transformPoint(this.world(), featureAnchor(feature))
  }

  // Whether the cover is turned toward the camera far enough to label it.
  get coverShowing(): boolean {
    return Math.cos(this.stage.current.turn) > 0.9
  }

  prepare(viewpoint: Viewpoint): void {
    const pose = { world: this.world(), toSun: TOWARD_SUN, explode: 0, highlight: { assembly: -1, strength: 0 }, light: PHOTO_LIGHT }
    this.renderer.update(viewpoint, pose, [])
  }

  draw(pass: GPURenderPassEncoder): void {
    this.renderer.draw(pass)
  }

  private world(): mat4 {
    const sway = SWAY_RADIANS * Math.sin((2 * Math.PI * this.seconds) / SWAY_SECONDS)
    const matrix = mat4.fromYRotation(mat4.create(), this.stage.current.turn + sway)
    mat4.rotateZ(matrix, matrix, this.spin)
    return mat4.scale(matrix, matrix, [RECORD_SCALE, RECORD_SCALE, RECORD_SCALE])
  }
}
