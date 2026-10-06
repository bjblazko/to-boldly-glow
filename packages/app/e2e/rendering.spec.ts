import { expect, test } from '@playwright/test'
import { meanLuminance } from './support/frameCapture'
import {
  captureFrame,
  countBrightPixels,
  diskRadiusAlongRow,
  dragCamera,
  followEntity,
  labelAnchor,
  meanAbsoluteDifference,
  openRenderedApp,
  renderFrames,
  setDisplaySwitch,
} from './support/renderedApp'

// These tests check what actually lands in the frame, not just app state - see support/renderedApp.ts.
test.use({ viewport: { width: 480, height: 300 } })

test('the default view shows a bright Sun at its labelled position against a dark, starry sky', async ({ page }) => {
  const errors = await openRenderedApp(page)
  const frame = await captureFrame(page)
  const sun = await labelAnchor(page, '#body-labels .body-label:text-is("Sun")')

  expect(meanLuminance(frame, sun.x, sun.y, 4)).toBeGreaterThan(150)
  // A corner patch away from the Sun's glow: mostly black sky...
  expect(meanLuminance(frame, 20, 20, 15)).toBeLessThan(40)
  // ...with stars in it.
  expect(countBrightPixels(frame, 0, 0, 120, 80)).toBeGreaterThan(3)
  expect(errors).toEqual([])
})

test('turning the starfield off removes the stars from the frame', async ({ page }) => {
  const errors = await openRenderedApp(page)
  // Orbit paths off first, so only stars can light up the empty corner being counted.
  await page.locator('.hud-dock-btn[data-panel="display"]').click()
  await page.locator('#orbit-paths-toggle').uncheck()
  const withStars = countBrightPixels(await captureFrame(page), 0, 0, 120, 80)
  await page.locator('#starfield-toggle').uncheck()
  const withoutStars = countBrightPixels(await captureFrame(page), 0, 0, 120, 80)

  expect(withStars).toBeGreaterThan(3)
  expect(withoutStars).toBe(0)
  expect(errors).toEqual([])
})

test('planets in the size lineup are lit on the side facing the Sun', async ({ page }) => {
  const errors = await openRenderedApp(page)
  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="planetSizes"]').click()
  await renderFrames(page, 3)
  const frame = await captureFrame(page)
  // The Sun bulges in from one side edge of the lineup view (its label is off-screen there).
  const leftEdge = meanLuminance(frame, 3, frame.height / 2, 3)
  const rightEdge = meanLuminance(frame, frame.width - 4, frame.height / 2, 3)
  const sunOnLeft = leftEdge > rightEdge
  expect(Math.max(leftEdge, rightEdge)).toBeGreaterThan(120)

  for (const name of ['Jupiter', 'Saturn']) {
    const planet = await labelAnchor(page, `#body-labels .body-label:text-is("${name}")`)
    const radius = diskRadiusAlongRow(frame, planet.x, planet.y)
    const towardSun = sunOnLeft ? -1 : 1
    const sunSide = meanLuminance(frame, planet.x + towardSun * radius * 0.6, planet.y, radius * 0.15)
    const farSide = meanLuminance(frame, planet.x - towardSun * radius * 0.6, planet.y, radius * 0.15)
    expect(sunSide, name).toBeGreaterThan(farSide * 2)
  }
  expect(errors).toEqual([])
})

test('a followed planet fills the view and its visible face is lit', async ({ page }) => {
  const errors = await openRenderedApp(page)
  await followEntity(page, 'Mars')
  const frame = await captureFrame(page)
  const mars = await labelAnchor(page, '#body-labels .body-label:text-is("Mars")')

  expect(diskRadiusAlongRow(frame, mars.x, mars.y)).toBeGreaterThan(frame.height * 0.08)
  expect(meanLuminance(frame, mars.x, mars.y, frame.height * 0.06)).toBeGreaterThan(35)
  expect(errors).toEqual([])
})

// A lens flare happens inside the camera: only whether the Sun itself is hidden matters. Behind
// Earth it vanishes; above Earth, its ghosts lie over the planet instead of being cut off by it.
test("the lens flare follows the Sun's visibility and lies over planets, not behind them", async ({ page }) => {
  test.setTimeout(120_000)
  const errors = await openRenderedApp(page)
  await setDisplaySwitch(page, '#orbit-paths-toggle', false)
  await setDisplaySwitch(page, '#body-labels-toggle', false)
  await followEntity(page, 'Earth')
  // Round to Earth's night side, level with its equator: on this date the Sun is right behind it.
  await dragCamera(page, 628, -234)
  const eclipsed = await captureFrame(page)
  await setDisplaySwitch(page, '#flares-toggle', true)
  expect(meanAbsoluteDifference(eclipsed, await captureFrame(page))).toBeLessThan(0.3)

  // Tilt up until the Sun stands above Earth: a ghost now falls next to the screen center, on Earth.
  await dragCamera(page, 0, 82)
  const withFlare = await captureFrame(page)
  await setDisplaySwitch(page, '#flares-toggle', false)
  const withoutFlare = await captureFrame(page)
  const [centerX, centerY] = [withFlare.width / 2, withFlare.height * 0.58]
  expect(meanLuminance(withFlare, centerX, centerY, 8)).toBeGreaterThan(meanLuminance(withoutFlare, centerX, centerY, 8) + 15)
  expect(errors).toEqual([])
})

// The tour flies continuously, and stopping it hands the view to the free-fly camera exactly as it
// was - same position, direction and roll - instead of jumping or levelling the horizon.
// Thresholds, as mean pixel differences: a still camera changes about 0.002 between frames (planets
// creep along), three seconds of touring about 0.5, and the handover itself about 0.001.
const STILL_VIEW_CHANGE = 0.1
const NO_JUMP = 0.05
test('the tour moves the view smoothly and hands over to free-fly without a jump', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = await openRenderedApp(page)
  await page.locator('.hud-dock-btn[data-panel="display"]').click()
  await page.locator('#orbit-paths-toggle').uncheck()
  await page.locator('.hud-dock-btn[data-panel="display"]').click()
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#camera-tour-toggle').click()
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()

  await renderFrames(page, 60)
  const flying = await captureFrame(page)
  await renderFrames(page, 30)
  const threeSecondsLater = await captureFrame(page)
  expect(meanAbsoluteDifference(flying, threeSecondsLater)).toBeGreaterThan(STILL_VIEW_CHANGE)

  const lastTourFrame = await captureFrame(page)
  await page.keyboard.press('Escape')
  const firstFreeFlyFrame = await captureFrame(page)
  expect(meanAbsoluteDifference(lastTourFrame, firstFreeFlyFrame)).toBeLessThan(NO_JUMP)
  await expect(page.locator('#camera-mode-toggle .btn-label')).toHaveText('Switch to Orbit Camera')
  expect(errors).toEqual([])
})

// Runs the whole app through its main features with the real GPU path, so any WebGPU validation
// error (thrown from the device's uncapturederror handler) fails the test.
test('a full session renders without GPU errors', async ({ page }) => {
  test.setTimeout(240_000)
  const errors = await openRenderedApp(page)

  await page.locator('.hud-dock-btn[data-panel="display"]').click()
  await page.locator('#flares-toggle').check()
  await page.locator('#scale-mode-realistic-btn').click()
  await page.locator('.hud-dock-btn[data-panel="display"]').click()
  await renderFrames(page, 18)
  await followEntity(page, 'Saturn')
  await followEntity(page, 'Europa')

  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#camera-tour-toggle').click()
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await renderFrames(page, 10)
  await page.keyboard.press('KeyW')
  await renderFrames(page, 3)

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  for (let chapter = 0; chapter < 5; chapter++) {
    await renderFrames(page, 4)
    await page.locator('#lesson-next-chapter').click()
  }
  await renderFrames(page, 4)
  await page.locator('#learn-mode-btn').click()
  await renderFrames(page, 3)

  expect(errors).toEqual([])
})
