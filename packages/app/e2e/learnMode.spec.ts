import { expect, test } from '@playwright/test'

test('entering and exiting learn mode toggles app-mode state and hides/restores the free-roam dock', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()

  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'seasons')
  await expect(page.locator('.hud-dock')).toBeHidden()
  await expect(page.locator('#display-corner-btn')).toBeVisible()

  await page.locator('#learn-mode-btn').click()

  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  expect(errors).toEqual([])
})

test('the corner Display button still opens and closes its panel while in learn mode', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

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

test('chapter navigation updates lesson-panel state', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'intro')

  await page.locator('#lesson-next-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'march-equinox')

  await page.locator('#lesson-prev-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'intro')
  await expect(page.locator('#lesson-prev-chapter')).toBeDisabled()

  expect(errors).toEqual([])
})

test('orbit paths still render (via the shared, now dash-capable line pipeline) with zero pageerrors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

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

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // canvas.dataset.flares isn't written until the toggle first fires (see moonsAndFlares.spec.ts),
  // so it has no attribute at all pre-toggle even though flares are ON (the underlying `showFlares`
  // default) - the assertions below only check the attribute from the point learn-mode entry first
  // writes it.

  // Flares start ON (the default): entering learn mode must force them off, and exiting must
  // restore ON - not leave them off, which would silently mutate the user's own explore-mode
  // preference (the exact bug class Task 10's out-of-scope fix, commit bcbbdf9, addressed).
  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'true')

  // Now start from flares OFF (a user preference) and confirm learn mode doesn't flip it to true.
  await page.locator('#display-corner-btn').click()
  await page.locator('#flares-toggle').uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')
  await page.locator('#display-corner-btn').click()

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')

  expect(errors).toEqual([])
})

test('entity search is explicitly disabled in learn mode, not just unreachable behind the hidden dock', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

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

test('globe overlays and both location markers render without WebGPU errors across a chapter change', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.waitForTimeout(1500) // let the initial season-phase tween settle

  await expect(page.locator('#location-a-label')).toBeVisible()
  await expect(page.locator('#location-b-label')).toBeVisible()
  await expect(page.locator('#axis-tilt-label')).toBeVisible()

  await page.locator('#lesson-next-chapter').click() // intro -> march-equinox
  await page.locator('#lesson-next-chapter').click() // march-equinox -> june-solstice's tilt tween begins
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'june-solstice')
  await page.waitForTimeout(1500) // let the tween settle

  await expect(page.locator('#location-a-label')).toBeVisible()
  await expect(page.locator('#location-b-label')).toBeVisible()
  // June solstice: the axis leans the full 23.4 degrees away from the vertical reference line.
  await expect(page.locator('#axis-tilt-label')).toHaveText('23.4°')
  expect(errors).toEqual([])
})
