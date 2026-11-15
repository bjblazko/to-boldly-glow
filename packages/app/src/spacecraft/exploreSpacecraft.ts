import { mat4 } from 'gl-matrix'
import type { Viewpoint } from '../camera/viewpoint'
import type { Vec3 } from '../math/tuples'
import type { ScenePlayer } from '../scene/scenePlayers'
import { AU_KM } from '../solarSystem/bodies'
import { scaledBodyRadiusUnits, scaledPosition } from '../solarSystem/sceneScale'
import { dishTowardSun } from './dishTowardSun'
import { loadModel } from './modelFile'
import { ModelRenderer, type ModelContext } from './modelRenderer'
import { SPACECRAFT, spacecraftAuPosition, spacecraftInFlight } from './spacecraftCatalog'

const MODEL_URL = 'models/voyager'

export interface ExploreMoment {
  daysSinceEpoch: number
  scaleBlend: number
}

// The spacecraft in the explore view: NASA's Voyager model at each probe's real place on the
// simulated date, its dish toward the Sun, sized like a body (true size at Realistic scale, drawn
// larger at Compact). Its files load the first time the explore view is shown; a lesson or tour
// staging its own scene hides them.
export class ExploreSpacecraft implements ScenePlayer {
  private renderers: Map<string, ModelRenderer> | null = null
  private loading = false
  private readonly drawn: ModelRenderer[] = []

  constructor(
    private readonly models: ModelContext,
    private readonly scene: { exploring(): boolean; now(): ExploreMoment },
  ) {}

  update(): void {
    if (this.loading || !this.scene.exploring()) return
    this.loading = true
    this.load().catch((error: unknown) => console.warn('The spacecraft model could not load.', error))
  }

  layout(): null {
    return null
  }

  updateOverlays(_layout: unknown, viewpoint: Viewpoint): void {
    this.drawn.length = 0
    if (!this.renderers || !this.scene.exploring()) return
    const { daysSinceEpoch, scaleBlend } = this.scene.now()
    for (const craft of SPACECRAFT) {
      const renderer = this.renderers.get(craft.id)
      const au = spacecraftAuPosition(craft.id, daysSinceEpoch)
      if (!renderer || !au || !spacecraftInFlight(craft.id, daysSinceEpoch)) continue
      const position = scaledPosition(au, scaleBlend)
      const unitsPerMetre = scaledBodyRadiusUnits(craft.radiusKm, craft.compactVisualRadius, scaleBlend, AU_KM) / (craft.radiusKm * 1000)
      renderer.update(viewpoint, { world: placed(position, unitsPerMetre), toSun: position.map((value) => -value) as Vec3, explode: 0, highlight: { assembly: -1, strength: 0 } }, [])
      this.drawn.push(renderer)
    }
  }

  drawBehindBodies(): void {}

  drawInFrontOfBodies(pass: GPURenderPassEncoder): void {
    for (const renderer of this.drawn) renderer.draw(pass)
  }

  drawOverlays(): void {}

  // One renderer per probe: each has its own uniforms, so both can be drawn in the same frame.
  private async load(): Promise<void> {
    const model = await loadModel(`${MODEL_URL}/voyager`)
    const renderers = await Promise.all(SPACECRAFT.map(async (craft) => [craft.id, await ModelRenderer.create(this.models, model, MODEL_URL)] as const))
    this.renderers = new Map(renderers)
  }
}

function placed(position: Vec3, unitsPerMetre: number): mat4 {
  const world = mat4.fromTranslation(mat4.create(), position)
  mat4.multiply(world, world, dishTowardSun(position.map((value) => -value) as Vec3))
  return mat4.scale(world, world, [unitsPerMetre, unitsPerMetre, unitsPerMetre])
}
