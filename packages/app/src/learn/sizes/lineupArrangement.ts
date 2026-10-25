import { EasedTween } from '../../math/easedTween'
import { lerp } from '../../math/easing'
import type { Vec3 } from '../../math/tuples'
import { GLIDE_SECONDS } from '../lessonCamera'
import { lineupSlots, OUT_FROM_SUN, type LineupSlot } from './sizesLineup'

// A planet passing over or under the row keeps this many times the largest planet's radius plus
// its own from the row's middle, so it clears even Jupiter.
const ARC_CLEARANCE = 1.2
const LARGEST_RADIUS = Math.max(...[...lineupSlots(OUT_FROM_SUN).values()].map((slot) => slot.radius))

interface Move {
  from: Vec3
  toX: number
  // How far it rises above the row (below it, if negative) halfway there.
  lift: number
}

// Where the lineup's planets stand, and their way to their places in a new order. The way takes
// as long as the camera's flight (see lessonCamera's GLIDE_SECONDS), with the same easing, so a
// planet in focus and the camera following it arrive together. That one keeps to the row; the
// others pass in an arc - over the row going away from the Sun, under it coming back - so none
// goes through another.
export class LineupArrangement {
  private currentOrder: readonly string[] = OUT_FROM_SUN
  private moves = new Map<string, Move>()
  private progress: EasedTween | null = null
  private eased = 1

  constructor() {
    this.arrange(OUT_FROM_SUN)
  }

  // The order the planets stand in, or are on their way to.
  get order(): readonly string[] {
    return this.currentOrder
  }

  // Without `animate`, the planets stand in their new places at once.
  arrange(order: readonly string[], { animate = false, focusPlanetId }: { animate?: boolean; focusPlanetId?: string } = {}): void {
    const slots = [...lineupSlots(order)]
    this.moves = new Map(slots.map(([id, slot]) => [id, this.moveTo(id, slot, { animate, keepsToRow: id === focusPlanetId })]))
    this.currentOrder = [...order]
    this.progress = animate ? new EasedTween(0, GLIDE_SECONDS) : null
    this.progress?.retarget(1, 0)
    this.eased = animate ? 0 : 1
  }

  private moveTo(id: string, slot: LineupSlot, { animate, keepsToRow }: { animate: boolean; keepsToRow: boolean }): Move {
    const from: Vec3 = animate ? this.position(id) : [slot.x, 0, 0]
    const lift = keepsToRow ? 0 : Math.sign(from[0] - slot.x) * ARC_CLEARANCE * (LARGEST_RADIUS + slot.radius)
    return { from, toX: slot.x, lift }
  }

  update(deltaSeconds: number): void {
    if (!this.progress) return
    this.eased = this.progress.update(deltaSeconds)
    if (!this.progress.isAnimating) this.progress = null
  }

  position(planetId: string): Vec3 {
    const move = this.moves.get(planetId)
    if (!move) throw new Error(`No planet "${planetId}" in the size lineup`)
    const t = this.eased
    return [lerp(move.from[0], move.toX, t), 0, lerp(move.from[2], 0, t) + move.lift * Math.sin(Math.PI * t)]
  }
}
