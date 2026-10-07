import type { Viewpoint } from '../camera/viewpoint'
import type { BodyRenderer } from '../bodies/bodyRenderer'
import type { AtmosphereShells } from '../atmosphereShell/atmosphereShell'
import type { CloudLayer } from '../earthClouds/cloudLayer'
import type { DisplaySettings } from '../hud/displaySettings'
import type { LensFlare } from '../lensFlare/lensFlare'
import type { LessonSession } from '../learn/lessonSession'
import type { OrbitPaths, ShownOrbits } from '../orbitPaths/orbitPaths'
import type { SaturnRing } from '../saturnRing/saturnRing'
import type { SkyBackdrop } from '../sky/skyBackdrop'
import type { AsteroidBelt, OrbitClock } from '../smallBodies/asteroidBelt'
import type { CometRenderer } from '../smallBodies/cometRenderer'
import type { Starfield } from '../starfield/starfield'
import type { SceneLayout } from './sceneLayout'
import type { SceneTargets } from './sceneTargets'

// Pushes the Sun's own color past the bloom pass's brightness threshold (see bloom/bloomShaders.ts);
// texture samples are clamped to [0, 1], so without it the Sun could never bloom.
const SUN_BLOOM_BRIGHTNESS = 4.0

export interface SceneParts {
  sky: SkyBackdrop
  starfield: Starfield
  bodies: BodyRenderer
  saturnRing: SaturnRing
  atmosphereShells: AtmosphereShells
  clouds: CloudLayer
  asteroids: AsteroidBelt
  comets: CometRenderer
  orbitPaths: OrbitPaths
  lensFlare: LensFlare
  lessons: LessonSession
}

export interface SceneFrame {
  layout: SceneLayout
  viewpoint: Viewpoint
  nowSeconds: number
  // Where the small bodies are: they move on their own orbits, outside the scene layout.
  clock: OrbitClock
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
    if (this.settings.display.asteroids.on) this.parts.asteroids.placeOnOrbits(encoder)
    const pass = this.targets.beginScenePass(encoder)
    this.draw(pass, frame.layout)
    pass.end()
    this.drawCameraEffects(encoder)
    this.targets.present(encoder)
    this.device.queue.submit([encoder.finish()])
  }

  private update(frame: SceneFrame): void {
    const { layout, viewpoint, nowSeconds } = frame
    const { display } = this.settings
    const { bodies, saturnRing, atmosphereShells, clouds, orbitPaths, lensFlare, lessons } = this.parts
    this.updateBackdrop(viewpoint)
    const sunBrightness = this.targets.bloomSupported && display.bloom.on ? SUN_BLOOM_BRIGHTNESS : 1
    bodies.update(layout, viewpoint, { sunBrightness, timeSeconds: nowSeconds, clouds: display.clouds.on })
    this.updateSmallBodies(frame)
    saturnRing.update(layout, viewpoint)
    if (display.clouds.on) clouds.update(layout, viewpoint, nowSeconds)
    atmosphereShells.update(layout, viewpoint)
    if (display.orbitPaths.on || display.smallBodyOrbits.on) orbitPaths.update(viewpoint)
    lessons.updateOverlays(layout, viewpoint, nowSeconds)
    if (display.flares.on) lensFlare.update(layout, viewpoint)
  }

  private updateBackdrop(viewpoint: Viewpoint): void {
    const { display } = this.settings
    if (display.milkyWay.on) this.parts.sky.update(viewpoint)
    if (display.starfield.on) this.parts.starfield.update(viewpoint)
  }

  private updateSmallBodies({ viewpoint, nowSeconds, clock }: SceneFrame): void {
    const { display } = this.settings
    if (display.asteroids.on) this.parts.asteroids.update(viewpoint, clock)
    if (display.comets.on) this.parts.comets.update(viewpoint, clock, nowSeconds)
  }

  private draw(pass: GPURenderPassEncoder, layout: SceneLayout): void {
    const { display, linePipeline } = this.settings
    const { bodies, saturnRing, atmosphereShells, clouds, orbitPaths, lessons } = this.parts
    this.drawBackdrop(pass)
    bodies.draw(pass, layout)
    // Everything after the opaque spheres is depth-tested against them without hiding anything.
    this.drawSmallBodies(pass)
    saturnRing.draw(pass, layout)
    if (display.clouds.on) clouds.draw(pass, layout)
    atmosphereShells.draw(pass, layout)
    pass.setPipeline(linePipeline)
    orbitPaths.draw(pass, this.shownOrbits())
    lessons.drawOverlays(pass)
  }

  // A small body's orbit shows only along with the body itself.
  private shownOrbits(): ShownOrbits {
    const { orbitPaths, smallBodyOrbits, comets, asteroids } = this.settings.display
    return { planets: orbitPaths.on, comets: smallBodyOrbits.on && comets.on, minorPlanets: smallBodyOrbits.on && asteroids.on }
  }

  // The sky and its stars first: they have no depth test, so everything drawn later paints over them.
  private drawBackdrop(pass: GPURenderPassEncoder): void {
    const { display } = this.settings
    if (display.milkyWay.on) this.parts.sky.draw(pass)
    if (display.starfield.on) this.parts.starfield.draw(pass)
  }

  private drawSmallBodies(pass: GPURenderPassEncoder): void {
    const { display } = this.settings
    if (display.asteroids.on) this.parts.asteroids.draw(pass)
    if (display.comets.on) this.parts.comets.draw(pass)
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
