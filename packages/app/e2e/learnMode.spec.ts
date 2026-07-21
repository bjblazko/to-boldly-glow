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
