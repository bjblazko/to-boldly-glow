import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'
import { openLesson, exitLesson } from './support/hud'

test('full seasons lesson flow: enter, all 6 chapters, exit', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await openLesson(page, 'seasons')
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')

  const expectedChapterIds = ['orbit', 'intro', 'march-equinox', 'june-solstice', 'september-equinox', 'december-solstice']
  for (const chapterId of expectedChapterIds) {
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', chapterId)
    if (chapterId !== expectedChapterIds[expectedChapterIds.length - 1]) {
      await page.locator('#lesson-next-chapter').click()
      await page.waitForTimeout(300)
    }
  }
  await expect(page.locator('#lesson-next-chapter')).toBeDisabled()

  await exitLesson(page) // exit
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  expect(errors).toEqual([])
})
