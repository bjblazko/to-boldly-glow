import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support/appBoot'
import { exitLesson, openLesson } from './support/hud'

const CHAPTERS = ['whole', 'serviceModule', 'engine', 'commandModule', 'inside', 'panels', 'seats', 'notes']

// The requests whose path matches, as they are made.
function requests(page: Page, pattern: RegExp): string[] {
  const paths: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (pattern.test(path)) paths.push(path)
  })
  return paths
}

test('the Columbia lesson loads the spacecraft and its scanned cabin, and goes from outside to inside', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (/columbia lesson could not load/.test(message.text())) errors.push(message.text())
  })
  const models = requests(page, /^\/models\/columbia\/.*\.(json|bin)$/)
  await openApp(page)

  await openLesson(page, 'columbia')
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'columbia')
  await expect.poll(() => models).toEqual(expect.arrayContaining(['/models/columbia/csm.json', '/models/columbia/csm.bin', '/models/columbia/cabin.json', '/models/columbia/cabin.bin']))
  await expect(page.locator('#voyager-labels')).toContainText('Command module')
  await expect(page.locator('#voyager-labels')).toContainText('Top of the service module')

  for (const [index, id] of CHAPTERS.entries()) {
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', id)
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', 'vehicle')
    if (id === 'panels') await expect(page.locator('#voyager-labels')).toContainText('Main display console')
    if (index < CHAPTERS.length - 1) await page.locator('#lesson-next-chapter').click()
  }
  await expect(page.locator('#lesson-next-chapter')).toBeDisabled()

  await exitLesson(page)
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  expect(errors).toEqual([])
})
