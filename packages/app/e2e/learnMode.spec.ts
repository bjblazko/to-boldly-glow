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

test('chapter navigation and scrubbing update lesson-panel state', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()

  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'intro')
  await expect(page.locator('#lesson-prev-chapter')).toBeDisabled()

  await page.locator('#lesson-next-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'march-equinox')
  await expect(page.locator('#lesson-prev-chapter')).toBeEnabled()

  await page.locator('#lesson-scrub').fill('0.75')
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-scrub-t', '0.75')

  await page.locator('#lesson-prev-chapter').click()
  // Navigating chapters resets scrub back to 0, per LessonPlayer.nextChapter/previousChapter.
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-scrub-t', '0')

  expect(errors).toEqual([])
})

test('the canvas keeps rendering (camera locked, not frozen) across a chapter change', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.waitForTimeout(2000) // let the initial chapter's camera fly-to tween settle

  await page.locator('#lesson-next-chapter').click()
  await page.waitForTimeout(2000) // let the chapter-change fly-to tween settle

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

test('selecting a latitude preset updates the lesson panel and the displayed text', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.locator('#lesson-next-chapter').click() // march-equinox chapter has non-empty text

  const beforeText = await page.locator('#lesson-chapter-text').textContent()

  await page.locator('.hud-latitude-chip', { hasText: /^Arctic Circle$/ }).click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-latitude-id', 'arctic-circle')

  const afterText = await page.locator('#lesson-chapter-text').textContent()
  expect(afterText).not.toBe(beforeText)

  expect(errors).toEqual([])
})

test('camera target stays centered on Earth across a scrub, not frozen at the chapter-defining date (regression)', async ({ page }) => {
  // Regression coverage for the bug where the camera's target was frozen at the chapter's fixed
  // defining date while Earth's rendered position tracked the scrub position instead - so Earth
  // drifted out of the locked framing across the scrub range, worst at scrubT=0 right after a
  // chapter loads (see main.ts's data-camera-target-earth-offset, written each frame in learn mode
  // as the world-space distance between orbitCamera.target and Earth's actual rendered position).
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.locator('#lesson-next-chapter').click() // march-equinox: a non-intro chapter framing
  await page.waitForTimeout(2000) // let the chapter's camera fly-to tween fully settle

  for (const scrubT of ['0', '0.25', '0.5', '0.75', '1']) {
    await page.locator('#lesson-scrub').fill(scrubT)
    await page.waitForTimeout(150) // let a render frame pick up the new scrub position
    const offset = await page.locator('#scene').getAttribute('data-camera-target-earth-offset')
    expect(Number(offset)).toBeLessThan(0.01)
  }

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

test('globe overlays render without WebGPU errors across a chapter and latitude change', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await page.waitForTimeout(1500)

  await page.locator('#lesson-next-chapter').click()
  // Exact-match regex, not a plain substring: "Arctic Circle" is itself a substring of the
  // "Antarctic Circle" preset's label, so a bare-string hasText filter matches both chips (see
  // the existing latitude-preset test above, which already guards against this the same way).
  await page.locator('.hud-latitude-chip', { hasText: /^Arctic Circle$/ }).click()
  await page.locator('#lesson-scrub').fill('0.9')
  await page.waitForTimeout(1500)

  expect(errors).toEqual([])
})
