import type { Viewpoint } from '../camera/viewpoint'
import type { BodyRenderer } from '../bodies/bodyRenderer'
import type { CloudShells } from '../cloudShell/cloudShell'
import type { DisplaySettings } from '../hud/displaySettings'
import type { LensFlare } from '../lensFlare/lensFlare'
import type { LessonSession } from '../learn/lessonSession'
import type { OrbitPaths } from '../orbitPaths/orbitPaths'
import type { SaturnRing } from '../saturnRing/saturnRing'
import type { Starfield } from '../starfield/starfield'
import type { SceneLayout } from './sceneLayout'
import type { SceneTargets } from './sceneTargets'

// Pushes the Sun's own color past the bloom pass's brightness threshold (see bloom/bloomShaders.ts);
// texture samples are clamped to [0, 1], so without it the Sun could never bloom.
const SUN_BLOOM_BRIGHTNESS = 4.0

export interface SceneParts {
  starfield: Starfield
  bodies: BodyRenderer
  saturnRing: SaturnRing
  cloudShells: CloudShells
  orbitPaths: OrbitPaths
  lensFlare: LensFlare
  lessons: LessonSession
}

export interface SceneFrame {
  layout: SceneLayout
  viewpoint: Viewpoint
  nowSeconds: number
}

// Renders one frame of the scene: every feature writes its uniforms for this frame's layout and
// viewpoint, then draws in an order the depth buffer and blending depend on.
export class SceneRenderer {
  constructor(
    private readonly device: GPUDevice,
    private readonly targets: SceneTargets,
    private readonly parts: SceneParts,
    private readonly settings: { display: DisplaySettings; linePipeline: GPURenderPipeline },
  ) {}

  render(frame: SceneFrame): void {
    this.update(frame)
    const encoder = this.device.createCommandEncoder({ label: 'frame encoder' })
    const pass = this.targets.beginScenePass(encoder)
    this.draw(pass, frame.layout)
    pass.end()
    this.drawCameraEffects(encoder)
    this.targets.present(encoder)
    this.device.queue.submit([encoder.finish()])
  }

  private update({ layout, viewpoint, nowSeconds }: SceneFrame): void {
    const { display } = this.settings
    const { starfield, bodies, saturnRing, cloudShells, orbitPaths, lensFlare, lessons } = this.parts
    if (display.starfield.on) starfield.update(viewpoint)
    const sunBrightness = this.targets.bloomSupported && display.bloom.on ? SUN_BLOOM_BRIGHTNESS : 1
    bodies.update(layout, viewpoint, sunBrightness)
    saturnRing.update(layout, viewpoint)
    cloudShells.update(layout, viewpoint)
    if (display.orbitPaths.on) orbitPaths.update(viewpoint)
    lessons.updateOverlays(layout, viewpoint, nowSeconds)
    if (display.flares.on) lensFlare.update(layout, viewpoint)
  }

  private draw(pass: GPURenderPassEncoder, layout: SceneLayout): void {
    const { display, linePipeline } = this.settings
    const { starfield, bodies, saturnRing, cloudShells, orbitPaths, lessons } = this.parts
    // Stars first: they have no depth test, so everything drawn later paints over them.
    if (display.starfield.on) starfield.draw(pass)
    bodies.draw(pass, layout)
    // Translucent geometry after every opaque sphere, so the depth test hides what is behind bodies.
    saturnRing.draw(pass, layout)
    cloudShells.draw(pass, layout)
    pass.setPipeline(linePipeline)
    if (display.orbitPaths.on) orbitPaths.draw(pass)
    lessons.drawOverlays(pass)
  }

  // The lens flare happens inside the camera, so it lies over everything in the picture.
  private drawCameraEffects(encoder: GPUCommandEncoder): void {
    const { lensFlare } = this.parts
    if (!this.settings.display.flares.on || !lensFlare.isVisible) return
    const pass = this.targets.beginCameraEffectsPass(encoder)
    lensFlare.draw(pass)
    pass.end()
  }
}
