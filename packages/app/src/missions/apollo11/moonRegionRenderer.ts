import { mat4 } from 'gl-matrix'
import type { Viewpoint } from '../../camera/viewpoint'
import type { Vec3 } from '../../math/tuples'
import { ModelRenderer, type ModelContext } from '../../spacecraft/modelRenderer'
import { KM_PER_UNIT, type Apollo11Scene } from './apollo11Scene'
import { moonRegion, regionMiddle, type RegionDescription } from './moonRegion'
import { fromMoonFrame, moonAxes64 } from './moonOrientation'

// The region of the Moon the tour flies over low, drawn with the Moon in the world's pass (scene
// units, its near plane kept by the ground): mountains and craters on the horizon from lunar orbit.

const URL = 'data/apollo11'
// Drawn while the camera is within this of the Moon's centre (km).
const NEAR_MOON_KM = 6000
const NO_HIGHLIGHT = { assembly: -1, strength: 0 }

export class MoonRegionRenderer {
  private renderer: ModelRenderer | null = null
  private middle: Vec3 = [0, 0, 0]
  private shown = false

  constructor(private readonly models: ModelContext) {}

  async load(hole: { latitude: number; longitude: number; radius: number }): Promise<void> {
    if (this.renderer) return
    try {
      const [region, heights] = await Promise.all([fetch(`${URL}/moon-region.json`).then((r) => r.json() as Promise<RegionDescription>), fetch(`${URL}/moon-region-heights.bin`).then((r) => r.arrayBuffer())])
      const data = moonRegion(region, new Uint16Array(heights), hole)
      this.middle = regionMiddle(region)
      this.renderer = await ModelRenderer.create(this.models, data, URL)
    } catch (error) {
      console.warn('The Apollo 11 tour could not load the region of the Moon round Tranquility Base.', error)
    }
  }

  // `cameraKm`: the eye from the scene's origin.
  prepare(viewpoint: Viewpoint, scene: Apollo11Scene, cameraKm: Vec3): void {
    const moon = scene.moonKm()
    const fromCentre = Math.hypot(moon[0] - cameraKm[0], moon[1] - cameraKm[1], moon[2] - cameraKm[2])
    this.shown = this.renderer !== null && fromCentre < NEAR_MOON_KM
    if (!this.shown) return
    const axes = scene.moonAxesNow()
    // The region's middle in double precision, the rest a small turn and the metres to units.
    const middle = fromMoonFrame(moonAxes64(scene.julianDay()), this.middle.map((m) => m / 1000))
    const world = mat4.fromTranslation(mat4.create(), [(moon[0] + middle[0]) / KM_PER_UNIT, (moon[1] + middle[1]) / KM_PER_UNIT, (moon[2] + middle[2]) / KM_PER_UNIT])
    mat4.multiply(world, world, axes)
    mat4.scale(world, world, [1 / (KM_PER_UNIT * 1000), 1 / (KM_PER_UNIT * 1000), 1 / (KM_PER_UNIT * 1000)])
    this.renderer!.update(viewpoint, { world, toSun: scene.toSun, explode: 0, highlight: NO_HIGHLIGHT, cut: 0, light: { sun: 1.15, fill: 0.012 }, materials: [{ shininess: 2, shine: 0 }], space: { bounce: null } }, [[0, 0, 0]])
  }

  draw(pass: GPURenderPassEncoder): void {
    if (this.shown) this.renderer?.draw(pass)
  }
}
