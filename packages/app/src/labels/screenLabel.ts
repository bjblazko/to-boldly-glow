import type { ScreenPosition } from '../camera/screenProjection'

// Moves a DOM label to a projected scene point (CSS pixels), or hides it while the point is off-screen.
export function placeLabel(label: HTMLElement, screen: ScreenPosition): void {
  if (!screen.visible) {
    hideLabel(label)
    return
  }
  label.hidden = false
  label.style.left = `${screen.x}px`
  label.style.top = `${screen.y}px`
}

export function hideLabel(label: HTMLElement): void {
  label.hidden = true
}
