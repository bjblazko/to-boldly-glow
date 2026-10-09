import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support/appBoot'
import { openLesson } from './support/hud'

test('the lesson library lists every lesson by topic and remembers where a lesson was left', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openApp(page)

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('#lesson-library')).toBeVisible()
  await expect(page.locator('.hud-lesson-card')).toHaveCount(4)
  await page.locator('#library-search').fill('eclipse')
  await expect(page.locator('.hud-lesson-card')).toHaveCount(1)
  // Closing the library without a lesson goes back to exploring.
  await page.keyboard.press('Escape')
  await expect(page.locator('#lesson-library')).toBeHidden()
  await expect(page.locator('#explore-mode-btn')).toHaveAttribute('aria-pressed', 'true')

  await openLesson(page, 'moonPhases')
  await page.locator('#lesson-next-chapter').click()
  await page.locator('#lesson-next-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'same-face')
  await page.locator('#explore-mode-btn').click()

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('.hud-lesson-card[data-lesson-id="moonPhases"]')).toContainText('Continue at chapter 3')
  await page.locator('.hud-lesson-card[data-lesson-id="moonPhases"]').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'same-face')
  expect(errors).toEqual([])
})

test('the chapter list jumps straight to a chapter', async ({ page }) => {
  await openApp(page)
  await openLesson(page, 'moonPhases')
  await expect(page.locator('#lesson-chapter-count')).toHaveText('1 / 7')

  await page.locator('#lesson-chapter-btn').click()
  await expect(page.locator('#lesson-chapter-menu')).toBeVisible()
  await page.locator('.hud-chapter-item[data-chapter-index="4"]').click()

  await expect(page.locator('#lesson-chapter-menu')).toBeHidden()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'first-quarter')
  await expect(page.locator('#lesson-chapter-count')).toHaveText('5 / 7')
})

// The distance between two labels of the lesson's diagram, on screen.
async function labelSpread(page: Page): Promise<number> {
  const at = (selector: string) =>
    page.locator(selector).evaluate((element: HTMLElement) => ({ x: parseFloat(element.style.left), y: parseFloat(element.style.top) }))
  const [a, b] = await Promise.all([at('#phases-new-label'), at('#phases-full-label')])
  return Math.hypot(a.x - b.x, a.y - b.y)
}

test("a lesson's scene zooms in and goes back to the lesson's own view", async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openApp(page)
  await openLesson(page, 'moonPhases')
  await expect(page.locator('#phases-full-label')).toBeVisible()
  const framed = await labelSpread(page)

  await page.locator('#lesson-zoom-in').click()
  await page.locator('#lesson-zoom-in').click()
  await expect.poll(() => labelSpread(page), { timeout: 15_000 }).toBeGreaterThan(framed * 1.4)

  await page.locator('#lesson-view-reset').click()
  await expect.poll(() => labelSpread(page), { timeout: 15_000 }).toBeLessThan(framed * 1.05)
  expect(errors).toEqual([])
})

test('graphics switches live in Settings; search everything finds objects, lessons and settings', async ({ page }) => {
  await openApp(page)

  await page.locator('#settings-btn').click()
  await expect(page.locator('#settings-panel')).toBeVisible()
  await page.locator('#bloom-toggle').uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-bloom', 'false')
  await page.keyboard.press('Escape')
  await expect(page.locator('#settings-panel')).toBeHidden()

  await page.keyboard.press('Control+k')
  await expect(page.locator('#command-palette')).toBeVisible()
  await page.locator('#palette-input').fill('bloom')
  await page.keyboard.press('Enter')
  await expect(page.locator('#scene')).toHaveAttribute('data-bloom', 'true')

  await page.keyboard.press('Control+k')
  await page.locator('#palette-input').fill('europa')
  await page.keyboard.press('Enter')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'europa')

  await page.keyboard.press('Control+k')
  await page.locator('#palette-input').fill('seasons')
  await page.keyboard.press('Enter')
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'seasons')
})
