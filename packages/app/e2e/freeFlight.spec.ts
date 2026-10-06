import { expect, test } from '@playwright/test'
import { captureFrame, labelAnchor, meanAbsoluteDifference, openRenderedApp, renderFrames } from './support/renderedApp'

test.use({ viewport: { width: 480, height: 300 } })

// A still camera changes about 0.002 between frames (planets creep along).
const STILL_VIEW_CHANGE = 0.1

async function switchToFreeFlight(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#camera-mode-toggle').click()
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await expect(page.locator('#camera-mode-toggle .btn-label')).toHaveText('Switch to Orbit Camera')
}

test('free flight flies with the keyboard and looks around with a drag', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = await openRenderedApp(page)
  await switchToFreeFlight(page)
  await expect(page.locator('#camera-hint')).toContainText('WASD')
  const start = await captureFrame(page)

  await page.keyboard.down('KeyW')
  await renderFrames(page, 6)
  await page.keyboard.up('KeyW')
  await renderFrames(page, 4)
  const flown = await captureFrame(page)
  expect(meanAbsoluteDifference(start, flown)).toBeGreaterThan(STILL_VIEW_CHANGE)

  await page.mouse.move(240, 150)
  await page.mouse.down()
  await page.mouse.move(320, 150, { steps: 10 })
  await renderFrames(page, 1)
  await page.mouse.up()
  await renderFrames(page, 3)
  expect(meanAbsoluteDifference(flown, await captureFrame(page))).toBeGreaterThan(STILL_VIEW_CHANGE)
  expect(errors).toEqual([])
})

test('double-clicking a body flies there and follows it', async ({ page }) => {
  const errors = await openRenderedApp(page)
  const sun = await labelAnchor(page, '#body-labels .body-label:text-is("Sun")')
  await page.mouse.dblclick(sun.x, sun.y)
  await renderFrames(page, 2)
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'sun')
  expect(errors).toEqual([])
})

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true })

  test('free flight shows a thumbstick that flies the ship', async ({ page }) => {
    test.setTimeout(120_000)
    const errors = await openRenderedApp(page)
    await expect(page.locator('#touch-flight-pad')).toBeHidden()
    await switchToFreeFlight(page)
    await expect(page.locator('#touch-flight-pad')).toBeVisible()
    const start = await captureFrame(page)

    // Push the stick forward and hold it.
    const stick = (await page.locator('#touch-flight-stick').boundingBox())!
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2)
    await page.mouse.down()
    await page.mouse.move(stick.x + stick.width / 2, stick.y + 4, { steps: 4 })
    await renderFrames(page, 6)
    await page.mouse.up()
    await renderFrames(page, 3)
    expect(meanAbsoluteDifference(start, await captureFrame(page))).toBeGreaterThan(STILL_VIEW_CHANGE)
    expect(errors).toEqual([])
  })
})
