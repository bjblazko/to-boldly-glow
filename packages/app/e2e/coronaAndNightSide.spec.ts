import { expect, test } from '@playwright/test'
import { meanLuminance, type CapturedFrame } from './support/frameCapture'
import { captureFrame, diskRadiusAlongRow, followEntity, luminanceAt, openRenderedApp, renderFrames, setDisplaySwitch } from './support/renderedApp'
import { turnSunBehindTarget } from './support/sunAlignment'

// These tests check what actually lands in the frame, not just app state - see support/renderedApp.ts.
test.use({ viewport: { width: 480, height: 300 } })

const CENTER = { x: 240, y: 150 }

// Luminance at points around a circle, sampled every 7.5 degrees.
function ringSamples(frame: CapturedFrame, radius: number): number[] {
  return Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 48) * 2 * Math.PI
    return meanLuminance(frame, CENTER.x + Math.cos(angle) * radius, CENTER.y + Math.sin(angle) * radius, 1.5)
  })
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function pixel(frame: CapturedFrame, x: number, y: number): [number, number, number] {
  const i = (y * frame.width + x) * 4
  return [frame.pixels[i], frame.pixels[i + 1], frame.pixels[i + 2]]
}

// Pixels within the rectangle matching a color test.
function countPixels(frame: CapturedFrame, area: { x0: number; y0: number; x1: number; y1: number }, test: (rgb: [number, number, number]) => boolean): number {
  let count = 0
  for (let y = area.y0; y < area.y1; y++) for (let x = area.x0; x < area.x1; x++) if (test(pixel(frame, x, y))) count++
  return count
}

// A clean sky: only the Sun and planets.
async function hideBackdrop(page: import('@playwright/test').Page): Promise<void> {
  for (const toggle of ['#starfield-toggle', '#milky-way-toggle', '#orbit-paths-toggle', '#asteroids-toggle', '#flares-toggle']) await setDisplaySwitch(page, toggle, false)
}

test('beside the bright disc the corona shows faintly, combed into streamers', async ({ page }) => {
  const errors = await openRenderedApp(page)
  await hideBackdrop(page)
  await setDisplaySwitch(page, '#bloom-toggle', false)
  await setDisplaySwitch(page, '#body-labels-toggle', false)
  await followEntity(page, 'Sun')
  const frame = await captureFrame(page)
  // The disc's edge, darkened as it is, still stands well above the corona just outside it.
  const sunRadius = diskRadiusAlongRow(frame, CENTER.x, CENTER.y, 60)
  const ring = ringSamples(frame, sunRadius * 1.6)
  console.log('CORONA beside disc', [25, 60, 120].map((t) => diskRadiusAlongRow(frame, CENTER.x, CENTER.y, t)), mean(ring).toFixed(1), Math.min(...ring).toFixed(1), Math.max(...ring).toFixed(1), luminanceAt(frame, 10, 10))
  expect(sunRadius).toBeGreaterThan(40)
  expect(mean(ring)).toBeGreaterThan(luminanceAt(frame, 10, 10) + 4)
  expect(mean(ring)).toBeLessThan(60)
  // Brighter along the streamers than between them.
  expect(Math.max(...ring)).toBeGreaterThan(Math.min(...ring) * 1.4)
  expect(errors).toEqual([])
})

test('when Earth covers the Sun, the corona shows in full around its dark disc', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = await openRenderedApp(page)
  await hideBackdrop(page)
  await followEntity(page, 'Earth')
  // Back off until Earth looks just a little larger than the Sun behind it.
  await page.mouse.move(CENTER.x, CENTER.y)
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 97)
  await page.mouse.wheel(0, 47)
  await renderFrames(page, 10)
  await turnSunBehindTarget(page)
  await setDisplaySwitch(page, '#body-labels-toggle', false)
  const frame = await captureFrame(page)
  const earth = luminanceAt(frame, CENTER.x, CENTER.y)
  const inner = mean(ringSamples(frame, 26))
  const outer = mean(ringSamples(frame, 60))
  console.log('CORONA eclipse', earth, inner.toFixed(1), outer.toFixed(1), luminanceAt(frame, 10, 10))
  // A bright ring around the dark disc, fading out over several of its radii.
  expect(inner).toBeGreaterThan(earth + 60)
  expect(outer).toBeGreaterThan(luminanceAt(frame, 10, 10) + 15)
  expect(errors).toEqual([])
})

test("Earth's night side glows with city lights, and the aurora rings its poles", async ({ page }) => {
  test.setTimeout(120_000)
  // 01:00 UTC: night over Europe, Africa and the Americas' east coast.
  const errors = await openRenderedApp(page, new Date('2026-03-21T01:00:00Z'))
  await hideBackdrop(page)
  await followEntity(page, 'Earth')
  await turnSunBehindTarget(page)
  await setDisplaySwitch(page, '#body-labels-toggle', false)
  const frame = await captureFrame(page)
  const disc = { x0: CENTER.x - 50, y0: CENTER.y - 50, x1: CENTER.x + 50, y1: CENTER.y + 50 }
  const cityLights = countPixels(frame, disc, ([r, g, b]) => r > 70 && r > b * 1.3 && g > b)
  const auroraTop = { x0: CENTER.x - 60, y0: 0, x1: CENTER.x + 60, y1: CENTER.y - 40 }
  const auroraBottom = { x0: CENTER.x - 60, y0: CENTER.y + 40, x1: CENTER.x + 60, y1: 300 }
  const green = ([r, g, b]: [number, number, number]) => g > 60 && g > r * 1.3 && g > b * 1.3
  const aurora = countPixels(frame, auroraTop, green) + countPixels(frame, auroraBottom, green)
  console.log('NIGHT', cityLights, aurora)
  expect(cityLights).toBeGreaterThan(100)
  expect(aurora).toBeGreaterThan(15)
  expect(errors).toEqual([])
})
