import type { Page } from '@playwright/test'
import { dragCamera, labelAnchor } from './renderedApp'

const SUN_LABEL = '#body-labels .body-label:text-is("Sun")'

// Where the Sun's label sits (its projected center, CSS pixels), or null while it is off-screen.
async function sunOnScreen(page: Page): Promise<{ x: number; y: number } | null> {
  const hidden = await page.locator(SUN_LABEL).evaluate((element: HTMLElement) => element.hidden)
  return hidden ? null : labelAnchor(page, SUN_LABEL)
}

// Sweeps the orbit camera around its target until the Sun comes into view.
async function bringSunIntoView(page: Page): Promise<void> {
  for (const dy of [-120, -120, 360, 120]) {
    await dragCamera(page, 0, dy)
    for (let i = 0; i < 6; i++) {
      if (await sunOnScreen(page)) return
      await dragCamera(page, 160, 0)
    }
  }
  throw new Error('The Sun never came into view')
}

// Turns the orbit camera until the Sun lies right behind the followed body, at the screen center -
// from the camera's side the body then eclipses the Sun. Body labels must be on (the Sun's label
// shows where it is). Each round measures how the Sun moves on screen per pixel of drag and drags
// by the amount that should center it.
export async function turnSunBehindTarget(page: Page): Promise<void> {
  const viewport = page.viewportSize()!
  const center = { x: viewport.width / 2, y: viewport.height / 2 }
  const probe = 25
  // Drags this short fall under the gesture's dead zone: they overshoot and come back.
  const overshoot = 40
  for (let round = 0; round < 8; round++) {
    const start = await sunOnScreen(page)
    if (!start) {
      await bringSunIntoView(page)
      continue
    }
    if (Math.hypot(center.x - start.x, center.y - start.y) < 0.7) return
    await dragCamera(page, probe, 0)
    const afterX = (await sunOnScreen(page))!
    await dragCamera(page, 0, probe)
    const afterY = (await sunOnScreen(page))!
    const [a, b, c, d] = [(afterX.x - start.x) / probe, (afterY.x - afterX.x) / probe, (afterX.y - start.y) / probe, (afterY.y - afterX.y) / probe]
    const [ex, ey] = [center.x - afterY.x, center.y - afterY.y]
    const determinant = a * d - b * c
    await dragCamera(page, (d * ex - b * ey) / determinant + overshoot, (-c * ex + a * ey) / determinant + overshoot)
    await dragCamera(page, -overshoot, -overshoot)
  }
  throw new Error('Could not turn the Sun behind the target')
}
