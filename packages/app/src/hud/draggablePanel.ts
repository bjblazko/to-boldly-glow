import { clamp } from '../math/tuples'

// Lets the user drag a panel aside by its grip. The panel keeps its CSS position until the first
// drag; from then on an explicit pixel position takes over for the rest of the session (across
// chapter changes too, so a panel dragged aside once stays aside), kept inside the window.
export function makePanelDraggable(panel: HTMLElement, grip: HTMLElement): void {
  let pointerOffset: { x: number; y: number } | null = null

  const moveTo = (left: number, top: number) => {
    const rect = panel.getBoundingClientRect()
    panel.style.left = `${clamp(left, 0, Math.max(0, window.innerWidth - rect.width))}px`
    panel.style.top = `${clamp(top, 0, Math.max(0, window.innerHeight - rect.height))}px`
  }
  const endDrag = (event: PointerEvent) => {
    if (!pointerOffset) return
    pointerOffset = null
    panel.classList.remove('is-dragging')
    grip.releasePointerCapture(event.pointerId)
  }

  grip.addEventListener('pointerdown', (event) => {
    // Switch to an explicit position matching where the panel already is, so the drag never jumps.
    const rect = panel.getBoundingClientRect()
    panel.style.left = `${rect.left}px`
    panel.style.top = `${rect.top}px`
    panel.style.transform = 'none'
    pointerOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    panel.classList.add('is-dragging')
    grip.setPointerCapture(event.pointerId)
  })
  grip.addEventListener('pointermove', (event) => {
    if (pointerOffset) moveTo(event.clientX - pointerOffset.x, event.clientY - pointerOffset.y)
  })
  grip.addEventListener('pointerup', endDrag)
  grip.addEventListener('pointercancel', endDrag)
  // A shrinking window must not strand a dragged panel off-screen.
  window.addEventListener('resize', () => {
    if (!panel.style.left) return
    const rect = panel.getBoundingClientRect()
    moveTo(rect.left, rect.top)
  })
}
