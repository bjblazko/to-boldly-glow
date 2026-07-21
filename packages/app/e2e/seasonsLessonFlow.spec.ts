import { expect, test } from '@playwright/test'

test('full seasons lesson flow: enter, all 5 chapters, latitude change, scrub, exit', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')

  const expectedChapterIds = ['intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice']
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', expectedChapterIds[0])

  for (let i = 1; i < expectedChapterIds.length; i++) {
    await page.locator('#lesson-next-chapter').click()
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', expectedChapterIds[i])
    await page.waitForTimeout(300) // let each chapter's camera fly-to tween start without piling up
  }
  await expect(page.locator('#lesson-next-chapter')).toBeDisabled()

  await page.locator('.hud-latitude-chip', { hasText: 'Tropic of Capricorn' }).click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-latitude-id', 'tropic-of-capricorn')

  await page.locator('#lesson-scrub').fill('0.3')
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-scrub-t', '0.3')

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  expect(errors).toEqual([])
})
