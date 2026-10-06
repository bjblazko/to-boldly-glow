import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('entering and exiting learn mode toggles app-mode state and hides/restores the free-roam dock buttons', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()

  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'seasons')
  // The dock itself stays (it holds Display and the Learn/exit button); only the free-roam Camera
  // and Time buttons hide - see hud.css's body[data-app-mode='learn'] rules.
  await expect(page.locator('.hud-dock-btn[data-panel="camera"]')).toBeHidden()
  await expect(page.locator('.hud-dock-btn[data-panel="time"]')).toBeHidden()
  await expect(page.locator('#display-corner-btn')).toBeVisible()
  await expect(page.locator('#learn-mode-btn')).toBeVisible()

  await page.locator('#learn-mode-btn').click()

  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock-btn[data-panel="camera"]')).toBeVisible()
  await expect(page.locator('.hud-dock-btn[data-panel="time"]')).toBeVisible()

  expect(errors).toEqual([])
})

test('the corner Display button still opens and closes its panel while in learn mode', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')

  const displayButton = page.locator('#display-corner-btn')
  const displayPanel = page.locator('.hud-sheet-panel[data-panel="display"]')

  await displayButton.click()
  await expect(displayButton).toHaveClass(/is-active/)
  await expect(displayPanel).toHaveClass(/is-active/)
  await expect(displayPanel).toBeVisible()

  await displayButton.click()
  await expect(displayButton).not.toHaveClass(/is-active/)
  await expect(displayPanel).not.toHaveClass(/is-active/)

  expect(errors).toEqual([])
})

test('chapter navigation updates lesson-panel state, including the kind change at the orbit/staged boundary', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'orbit')
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', 'orbit')
  await expect(page.locator('#lesson-prev-chapter')).toBeDisabled()

  // Step to the orbit/staged boundary (the single orbit chapter's only Next) and confirm the kind
  // flips (a hard camera cut, not an animated one - see LessonSession.goToChapter).
  await page.locator('#lesson-next-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'intro')
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', 'staged')

  await page.locator('#lesson-prev-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'orbit')
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', 'orbit')

  expect(errors).toEqual([])
})

test('orbit paths still render (via the shared, now dash-capable line pipeline) with zero pageerrors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  // Orbit paths are on by default; exercise the toggle off/on to force the (now two-vertex-buffer,
  // dash-uniform-carrying) line pipeline to rebind and redraw in both states, catching any
  // LINE_UNIFORM_FLOAT_COUNT/vertex-layout mismatch introduced by generalizing the pipeline beyond
  // its original orbit-paths-only shape.
  await page.locator('#display-corner-btn').click()
  const orbitPathsToggle = page.locator('#orbit-paths-toggle')

  await orbitPathsToggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-orbit-paths', 'false')
  await page.waitForTimeout(200)

  await orbitPathsToggle.check()
  await expect(page.locator('#scene')).toHaveAttribute('data-orbit-paths', 'true')
  await page.waitForTimeout(200)

  expect(errors).toEqual([])
})

test('lens flares are force-hidden on learn-mode entry and restored to their prior state on exit', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  // canvas.dataset.flares isn't written until the toggle first fires (see moonsAndFlares.spec.ts),
  // so it has no attribute at all pre-toggle even though flares are OFF (the underlying
  // `showFlares` default) - the assertions below only check the attribute from the point learn-mode
  // entry first writes it.

  // Flares start OFF (the default): learn mode must leave them off on exit, not flip them on.
  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')

  // Now turn flares ON (a user preference): entering learn mode must force them off, and exiting
  // must restore ON - not leave them off, which would silently mutate the user's own explore-mode
  // preference (the exact bug class Task 10's out-of-scope fix, commit bcbbdf9, addressed).
  await page.locator('#display-corner-btn').click()
  await page.locator('#flares-toggle').check()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'true')
  await page.locator('#display-corner-btn').click()

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'true')

  expect(errors).toEqual([])
})

test('entity search is explicitly disabled in learn mode, not just unreachable behind the hidden dock', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')

  const searchInput = page.locator('#entity-search-input')
  await expect(searchInput).toBeDisabled()

  // Simulate a hotkey/focus path reaching the (hidden) search box directly, bypassing the hidden
  // Camera dock entirely - dispatchEvent doesn't require the element to be visible/actionable,
  // unlike fill()/type(), so this exercises EntitySearchUI.setEnabled's own guard rather than
  // relying on the dock's hiddenness to keep the input unreachable.
  await searchInput.evaluate((el: HTMLInputElement) => {
    el.value = 'Earth'
    el.dispatchEvent(new Event('input'))
  })
  await expect(page.locator('#entity-search-results')).toBeEmpty()
  await expect(page.locator('#follow-indicator')).toBeHidden()

  expect(errors).toEqual([])
})

test('globe overlays and both location markers render without WebGPU errors across the orbit-to-staged transition', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.waitForTimeout(1500) // let the orbit chapter's continuous revolution get going

  // Location A/B are staged-chapter-only - hidden during the orbit chapter.
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'orbit')
  await expect(page.locator('#location-a-label')).toBeHidden()
  await expect(page.locator('#location-b-label')).toBeHidden()
  await expect(page.locator('#axis-tilt-label')).toBeVisible()

  await page.locator('#lesson-next-chapter').click() // orbit -> intro (the only orbit/staged boundary now)
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'intro')
  await page.waitForTimeout(1500) // let the tilt tween settle

  await expect(page.locator('#location-a-label')).toBeVisible()
  await expect(page.locator('#location-b-label')).toBeVisible()

  await page.locator('#lesson-next-chapter').click() // intro -> march-equinox
  await page.locator('#lesson-next-chapter').click() // march-equinox -> june-solstice's tilt tween begins
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'june-solstice')
  await page.waitForTimeout(1500) // let the tween settle

  await expect(page.locator('#location-a-label')).toBeVisible()
  await expect(page.locator('#location-b-label')).toBeVisible()
  // June solstice: the north end of the axis leans its full 23.4 degrees toward the Sun.
  await expect(page.locator('#axis-tilt-label')).toHaveText('23.4° toward the Sun')

  await page.locator('#lesson-next-chapter').click() // june-solstice -> september-equinox
  await page.waitForTimeout(1500)
  // The tilt is still 23.4 degrees, but none of it points at the Sun.
  await expect(page.locator('#axis-tilt-label')).toHaveText('0.0° (tilt points sideways)')

  await page.locator('#lesson-next-chapter').click() // september-equinox -> december-solstice
  await page.waitForTimeout(1500)
  await expect(page.locator('#axis-tilt-label')).toHaveText('23.4° away from the Sun')
  expect(errors).toEqual([])
})

test('the lesson panel can be dragged by its grip handle, clamped to the viewport, and stays put across chapter navigation', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()

  const panel = page.locator('#lesson-panel')
  const grip = page.locator('#lesson-panel-grip')
  const beforeBox = await panel.boundingBox()
  if (!beforeBox) throw new Error('lesson panel has no bounding box')

  // Drag the grip a good distance up and to the left - the panel starts anchored near the bottom
  // center, so this should land it clearly away from its starting position (not clamped there).
  const gripBox = await grip.boundingBox()
  if (!gripBox) throw new Error('lesson panel grip has no bounding box')
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(60, 60, { steps: 10 })
  await page.mouse.up()

  const afterDragBox = await panel.boundingBox()
  if (!afterDragBox) throw new Error('lesson panel has no bounding box after drag')
  expect(afterDragBox.x).toBeLessThan(beforeBox.x)
  expect(afterDragBox.y).toBeLessThan(beforeBox.y)
  // Clamped to the viewport, not dragged off the top-left edge.
  expect(afterDragBox.x).toBeGreaterThanOrEqual(0)
  expect(afterDragBox.y).toBeGreaterThanOrEqual(0)

  // The dragged position must persist across chapter navigation, not reset.
  await page.locator('#lesson-next-chapter').click()
  const afterNavBox = await panel.boundingBox()
  if (!afterNavBox) throw new Error('lesson panel has no bounding box after navigation')
  expect(Math.round(afterNavBox.x)).toBe(Math.round(afterDragBox.x))
  expect(Math.round(afterNavBox.y)).toBe(Math.round(afterDragBox.y))

  expect(errors).toEqual([])
})

test('opening a lesson while following a body ends the follow, so it cannot drag the lesson camera away', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#entity-search-input').fill('Mars')
  await page.locator('#entity-search-input').press('Enter')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'mars')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('#scene')).not.toHaveAttribute('data-following-id')

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('#follow-indicator')).toBeHidden()

  expect(errors).toEqual([])
})

test('each lesson says what is and is not to scale', async ({ page }) => {
  await openApp(page)

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('#lesson-note')).toBeVisible()
  await expect(page.locator('#lesson-note')).toContainText('All angles shown are true')
  await page.locator('#learn-mode-btn').click()

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="planetSizes"]').click()
  await expect(page.locator('#lesson-note')).toContainText('Sizes are to scale')
})

test('the seasons lesson keeps working when the explore view is at Realistic scale', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)
  await page.locator('#display-corner-btn').click()
  await page.locator('#scale-mode-realistic-btn').click()
  await expect(page.locator('#scene')).toHaveAttribute('data-scale-mode', 'realistic')
  await page.locator('#display-corner-btn').click()

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.locator('#lesson-next-chapter').click() // orbit -> intro (staged)
  await page.waitForTimeout(1500)
  await expect(page.locator('#axis-tilt-label')).toHaveText('23.4° toward the Sun')
  await expect(page.locator('#location-a-label')).toBeVisible()
  await expect(page.locator('#location-b-label')).toBeVisible()
  expect(errors).toEqual([])
})
