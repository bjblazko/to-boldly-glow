import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support/appBoot'

// The orbit camera's distance and pivot, as the app writes them on the canvas each frame.
async function orbit(page: Page): Promise<{ radius: number; pivot: number[] }> {
  const scene = page.locator('#scene')
  return { radius: Number(await scene.getAttribute('data-orbit-radius')), pivot: (await scene.getAttribute('data-pivot'))!.split(',').map(Number) }
}

test('a mouse wheel zooms, and a right-drag moves the pivot', async ({ page }) => {
  await openApp(page)
  const start = await orbit(page)
  await page.mouse.move(640, 300)
  await page.mouse.wheel(0, -300)
  await expect.poll(async () => (await orbit(page)).radius).toBeLessThan(start.radius * 0.9)
  // The zoom glides in; let it settle before moving the pivot.
  await page.waitForTimeout(600)

  const zoomed = await orbit(page)
  await page.mouse.move(400, 300)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(600, 300, { steps: 10 })
  await page.mouse.up({ button: 'right' })
  const panned = await orbit(page)
  expect(Math.hypot(...panned.pivot.map((value, i) => value - zoomed.pivot[i]))).toBeGreaterThan(0.1)
  expect(Math.abs(panned.radius / zoomed.radius - 1)).toBeLessThan(0.01)
})
