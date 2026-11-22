import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support/appBoot'
import { exitLesson, openLesson } from './support/hud'

const CHAPTERS = ['whole', 'tower', 'arms', 'crewArm', 'whiteRoom', 'escape', 'platform', 'holddown', 'crawler', 'crawlerParts', 'liftoff']

// The requests whose path matches, as they are made.
function requests(page: Page, pattern: RegExp): string[] {
  const paths: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (pattern.test(path)) paths.push(path)
  })
  return paths
}

test('the launch tower lesson loads the launcher and the crawler, and steps through its chapters', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (/launcher lesson could not load/.test(message.text())) errors.push(message.text())
  })
  const models = requests(page, /^\/models\/launcher\/.*\.(json|bin)$/)
  await openApp(page)

  await openLesson(page, 'launcher')
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'launcher')
  await expect.poll(() => models).toEqual(expect.arrayContaining(['/models/launcher/launcher.json', '/models/launcher/launcher.bin', '/models/launcher/crawler.json', '/models/launcher/crawler.bin']))
  await expect(page.locator('#voyager-labels')).toContainText('Umbilical tower')
  await expect(page.locator('#voyager-labels')).toContainText('Top of the tower')

  for (const [index, id] of CHAPTERS.entries()) {
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', id)
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', 'vehicle')
    if (id === 'crawler') await expect(page.locator('#voyager-labels')).toContainText('Crawler-transporter')
    if (index < CHAPTERS.length - 1) await page.locator('#lesson-next-chapter').click()
  }
  await expect(page.locator('#lesson-next-chapter')).toBeDisabled()

  await exitLesson(page)
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  expect(errors).toEqual([])
})
