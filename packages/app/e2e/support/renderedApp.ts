import type { Page } from '@playwright/test'
import { captureNextFrame, installOffscreenSwapchain, waitForGpuIdle, type CapturedFrame } from './frameCapture'

// Opens the app with real rendering (see frameCapture.ts) and a frozen, test-controlled clock, so
// every frame is deterministic and only happens when a test asks for it. Software WebGPU is slow
// (around a second per frame), so tests step frames explicitly rather than waiting in real time.
export const DEFAULT_START = new Date('2026-03-20T12:00:00Z')

export async function openRenderedApp(page: Page, start: Date = DEFAULT_START): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await installOffscreenSwapchain(page)
  await page.clock.install({ time: start })
  await page.clock.pauseAt(start)
  await page.goto('/')
  await page.waitForFunction(() => document.querySelector<HTMLElement>('#scene')?.dataset.starCount)
  for (let attempt = 0; attempt < 40; attempt++) {
    await page.clock.runFor(17)
    if (await page.evaluate(() => document.querySelector<HTMLElement>('#scene')?.dataset.rendered === 'true')) break
    await page.waitForTimeout(50)
  }
  return errors
}

// Renders `count` frames, each 100 ms of app time apart - the app's largest animation step (it
// clamps longer gaps), so tweens progress exactly as they would at 10 frames per second.
export async function renderFrames(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await page.clock.fastForward(100)
    await waitForGpuIdle(page)
  }
}

export async function captureFrame(page: Page): Promise<CapturedFrame> {
  const pending = captureNextFrame(page)
  await page.clock.fastForward(100)
  return pending
}

// Where a body label currently sits (its anchor is the body's projected center), in CSS pixels.
export async function labelAnchor(page: Page, selector: string): Promise<{ x: number; y: number }> {
  return page.locator(selector).evaluate((element: HTMLElement) => ({
    x: parseFloat(element.style.left),
    y: parseFloat(element.style.top),
  }))
}

export async function followEntity(page: Page, name: string): Promise<void> {
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#entity-search-input').fill(name)
  await page.locator('#entity-search-input').press('Enter')
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await renderFrames(page, 20)
}

export function luminanceAt(frame: CapturedFrame, x: number, y: number): number {
  const i = (Math.round(y) * frame.width + Math.round(x)) * 4
  return 0.2126 * frame.pixels[i] + 0.7152 * frame.pixels[i + 1] + 0.0722 * frame.pixels[i + 2]
}

// Counts small isolated bright points (stars) inside a rectangle.
export function countBrightPixels(frame: CapturedFrame, x0: number, y0: number, x1: number, y1: number, threshold = 60): number {
  let count = 0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (luminanceAt(frame, x, y) > threshold) count++
  return count
}

// Walks outward from a disk's center along +/-x until the luminance drops to the background, and
// returns the disk's apparent radius in pixels.
export function diskRadiusAlongRow(frame: CapturedFrame, centerX: number, centerY: number, background = 25): number {
  let left = centerX
  while (left > 0 && luminanceAt(frame, left - 1, centerY) > background) left--
  let right = centerX
  while (right < frame.width - 1 && luminanceAt(frame, right + 1, centerY) > background) right++
  return (right - left) / 2
}

// Mean per-channel difference (0-255) between two frames of the same size.
export function meanAbsoluteDifference(a: CapturedFrame, b: CapturedFrame): number {
  let sum = 0
  for (let i = 0; i < a.pixels.length; i += 4) {
    sum += Math.abs(a.pixels[i] - b.pixels[i]) + Math.abs(a.pixels[i + 1] - b.pixels[i + 1]) + Math.abs(a.pixels[i + 2] - b.pixels[i + 2])
  }
  return sum / ((a.pixels.length / 4) * 3)
}

// Drags the orbit camera from the canvas center by (dx, dy) pixels and renders the result.
export async function dragCamera(page: Page, dx: number, dy: number): Promise<void> {
  const viewport = page.viewportSize()!
  const [x, y] = [viewport.width / 2, viewport.height / 2]
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let step = 1; step <= 20; step++) await page.mouse.move(x + (dx * step) / 20, y + (dy * step) / 20)
  // Held still before letting go: the first frame applies the drag, the second sees the hand at
  // rest - so no fling, the view stops where the drag ended.
  await renderFrames(page, 2)
  await page.mouse.up()
  await renderFrames(page, 2)
}

export async function setDisplaySwitch(page: Page, selector: string, on: boolean): Promise<void> {
  await page.locator('.hud-dock-btn[data-panel="display"]').click()
  await page.locator(selector).setChecked(on)
  await page.locator('.hud-dock-btn[data-panel="display"]').click()
}
