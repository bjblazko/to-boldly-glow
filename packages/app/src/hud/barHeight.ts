// The bar's height changes with what it holds (a route's timeline adds a row): it is measured, kept
// as --hud-bar-height for the CSS of what stands on it (the side column), and read by the lesson
// camera to fit scenes above it.

// Before the first measurement: the bar with one row of buttons.
const ONE_ROW_PX = 68
let measured = ONE_ROW_PX

export function barHeight(): number {
  return measured
}

// Measures the bar whenever it changes size and calls `changed` after a change.
export function watchBarHeight(bar: HTMLElement, changed: () => void): void {
  const root = document.documentElement
  new ResizeObserver(() => {
    const height = bar.offsetHeight
    if (height === 0 || height === measured) return
    measured = height
    root.style.setProperty('--hud-bar-height', `${height}px`)
    changed()
  }).observe(bar)
}
