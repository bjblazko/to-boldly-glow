import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support/appBoot'
import { exitLesson, openLesson } from './support/hud'

const CHAPTERS = ['whole', 'folded', 'stages', 'descent', 'ascent', 'inside', 'panels', 'liftoff']

// The requests whose path matches, as they are made.
function requests(page: Page, pattern: RegExp): string[] {
  const paths: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (pattern.test(path)) paths.push(path)
  })
  return paths
}

test('the Eagle lesson loads the lunar module and its cockpit, and goes from outside to inside', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (/eagle lesson could not load/.test(message.text())) errors.push(message.text())
  })
  const models = requests(page, /^\/models\/eagle\/.*\.(json|bin)$/)
  await openApp(page)

  await openLesson(page, 'eagle')
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'eagle')
  await expect.poll(() => models).toEqual(expect.arrayContaining(['/models/eagle/lm.json', '/models/eagle/lm.bin', '/models/eagle/cockpit.json', '/models/eagle/cockpit.bin']))
  await expect(page.locator('#voyager-labels')).toContainText('Descent stage')
  await expect(page.locator('#voyager-labels')).toContainText('Top of the descent stage')

  for (const [index, id] of CHAPTERS.entries()) {
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', id)
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', 'vehicle')
    if (id === 'panels') await expect(page.locator('#voyager-labels')).toContainText('Guidance computer keyboard')
    if (index < CHAPTERS.length - 1) await page.locator('#lesson-next-chapter').click()
  }
  await expect(page.locator('#lesson-next-chapter')).toBeDisabled()

  await exitLesson(page)
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  expect(errors).toEqual([])
})
