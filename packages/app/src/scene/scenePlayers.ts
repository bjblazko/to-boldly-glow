import type { Viewpoint } from '../camera/viewpoint'
import type { Ephemeris } from '../time/ephemeris'
import type { SceneLayout } from './sceneLayout'

export interface ScenePlayerFrame {
  nowSeconds: number
  // The Sun's own brightness this frame (see bodies/sunSurface.ts).
  sunBrightness: number
}

// Something that stages its own scene instead of the explore view's real solar system: a lesson or
// a mission tour. While it runs it gives the frame's layout and draws what it adds; otherwise every
// method does nothing (and layout gives null).
export interface ScenePlayer {
  update(deltaSeconds: number): void
  layout(ephemeris: Ephemeris): SceneLayout | null
  updateOverlays(layout: SceneLayout, viewpoint: Viewpoint, frame: ScenePlayerFrame): void
  // Right after the sky's backdrop, before the Sun, planets and moons.
  drawBehindBodies(pass: GPURenderPassEncoder): void
  // After every body and what surrounds them, before the overlay lines.
  drawInFrontOfBodies(pass: GPURenderPassEncoder): void
  // Expects the line pipeline to be set on the pass.
  drawOverlays(pass: GPURenderPassEncoder): void
}

// Every scene player, as one: the scene renderer and the frame loop ask it once per frame.
export class ScenePlayers implements ScenePlayer {
  constructor(private readonly players: ScenePlayer[]) {}

  update(deltaSeconds: number): void {
    for (const player of this.players) player.update(deltaSeconds)
  }

  layout(ephemeris: Ephemeris): SceneLayout | null {
    for (const player of this.players) {
      const layout = player.layout(ephemeris)
      if (layout) return layout
    }
    return null
  }

  updateOverlays(layout: SceneLayout, viewpoint: Viewpoint, frame: ScenePlayerFrame): void {
    for (const player of this.players) player.updateOverlays(layout, viewpoint, frame)
  }

  drawBehindBodies(pass: GPURenderPassEncoder): void {
    for (const player of this.players) player.drawBehindBodies(pass)
  }

  drawInFrontOfBodies(pass: GPURenderPassEncoder): void {
    for (const player of this.players) player.drawInFrontOfBodies(pass)
  }

  drawOverlays(pass: GPURenderPassEncoder): void {
    for (const player of this.players) player.drawOverlays(pass)
  }
}
