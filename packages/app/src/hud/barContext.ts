// What the bar is for right now: exploring, or playing a lesson, a mission tour or the grand tour.
export type BarContext = 'explore' | 'lesson' | 'mission' | 'tour'

type Part = Exclude<BarContext, 'explore'>

// A lesson wins (opening one ends a tour anyway), then a mission tour, then the grand tour.
export function barContext(state: Record<Part, boolean>): BarContext {
  if (state.lesson) return 'lesson'
  if (state.mission) return 'mission'
  if (state.tour) return 'tour'
  return 'explore'
}

// Keeps body[data-context] up to date as lessons and tours start and end; hud.css shows the bar's
// groups for that context.
export class BarContextView {
  private readonly state: Record<Part, boolean> = { lesson: false, mission: false, tour: false }
  private readonly listeners: ((context: BarContext) => void)[] = []

  constructor(private readonly body: HTMLElement) {
    this.refresh()
  }

  get current(): BarContext {
    return barContext(this.state)
  }

  // Hears every change of context, starting with the current one.
  onChange(listener: (context: BarContext) => void): void {
    this.listeners.push(listener)
    listener(this.current)
  }

  set(part: Part, on: boolean): void {
    this.state[part] = on
    this.refresh()
  }

  private refresh(): void {
    const context = this.current
    if (this.body.dataset.context === context) return
    this.body.dataset.context = context
    this.listeners.forEach((listener) => listener(context))
  }
}
