import { expect, test } from '@playwright/test'
import { captureFrame, countBrightPixels, followEntity, meanAbsoluteDifference, openRenderedApp, setDisplaySwitch } from './support/renderedApp'

// These tests check what actually lands in the frame, not just app state - see support/renderedApp.ts.
test.use({ viewport: { width: 480, height: 300 } })

test('the Milky Way and the asteroid belts show in the frame and switch off with their toggles', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = await openRenderedApp(page)
  for (const toggle of ['#orbit-paths-toggle', '#body-labels-toggle', '#flares-toggle']) await setDisplaySwitch(page, toggle, false)
  const everything = await captureFrame(page)
  await setDisplaySwitch(page, '#milky-way-toggle', false)
  const withoutMilkyWay = await captureFrame(page)
  await setDisplaySwitch(page, '#asteroids-toggle', false)
  const withoutAsteroids = await captureFrame(page)

  expect(meanAbsoluteDifference(everything, withoutMilkyWay)).toBeGreaterThan(0.3)
  expect(meanAbsoluteDifference(withoutMilkyWay, withoutAsteroids)).toBeGreaterThan(0.05)
  await expect(page.locator('#scene')).toHaveAttribute('data-milky-way', 'false')
  expect(errors).toEqual([])
})

// In March 1986 Halley's Comet had just rounded the Sun: following it shows its coma and tails.
test("Halley's Comet can be followed, and shows its tails near the Sun in 1986", async ({ page }) => {
  test.setTimeout(90_000)
  const errors = await openRenderedApp(page, new Date('1986-03-05T00:00:00Z'))
  for (const toggle of ['#orbit-paths-toggle', '#body-labels-toggle', '#flares-toggle', '#milky-way-toggle']) await setDisplaySwitch(page, toggle, false)
  await setDisplaySwitch(page, '#comets-toggle', false)
  // Picking a comet shows the comets again.
  await followEntity(page, 'Halley')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'halley')
  await expect(page.locator('#scene')).toHaveAttribute('data-comets', 'true')
  const withComet = await captureFrame(page)
  await setDisplaySwitch(page, '#comets-toggle', false)
  const withoutComet = await captureFrame(page)

  const bright = (frame: typeof withComet) => countBrightPixels(frame, 0, 0, frame.width, frame.height, 40)
  expect(bright(withComet)).toBeGreaterThan(bright(withoutComet) + 300)
  expect(errors).toEqual([])
})

test('Ceres and Pluto are camera targets too', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = await openRenderedApp(page)
  await setDisplaySwitch(page, '#asteroids-toggle', false)
  await followEntity(page, 'Ceres')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'ceres')
  await expect(page.locator('#scene')).toHaveAttribute('data-asteroids', 'true')
  await followEntity(page, 'Pluto')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'pluto')
  expect(errors).toEqual([])
})
