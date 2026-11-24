import { expect, test } from '@playwright/test'
import { openApp, waitForFirstFrame } from './support/appBoot'

test('a first visit opens the start page; its Start begins the narrated tour at the Sun; subtitles start off', async ({ page }) => {
  const clips: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/narration/')) clips.push(new URL(request.url()).pathname)
  })
  await page.goto('/')
  await waitForFirstFrame(page)
  const start = page.locator('#start-page')
  await expect(start).toBeVisible()
  await expect(start.locator('#start-language').getByRole('button')).toHaveText(['English', 'Deutsch'])
  await expect(start.locator('#start-voice').getByRole('button')).toHaveText(['Lyra', 'Orion'])

  await start.locator('#start-grand').click()
  await expect(start).toBeHidden()
  await expect(page.locator('body')).toHaveAttribute('data-context', 'tour')
  await expect(page.locator('#narration-bar')).not.toHaveAttribute('hidden')
  await expect(page.locator('#narration-subtitle')).toBeHidden()
  await expect(page.locator('#narration-subtitle')).toContainText('Welcome aboard')
  // Opus where the browser plays it (Chromium does), MP3 otherwise.
  await expect.poll(() => clips).toContain('/narration/lyra/en/tours/grand/sun-approach.webm')

  // Any manual camera input hands control back and silences the narrator.
  await page.locator('#scene').click({ position: { x: 40, y: 300 } })
  await expect(page.locator('body')).toHaveAttribute('data-context', 'explore')
  await expect(page.locator('#narration-bar')).toBeHidden()
})

test('the start page opens by itself only the first time; afterwards from the bar', async ({ page }) => {
  await page.goto('/')
  await waitForFirstFrame(page)
  await expect(page.locator('#start-page')).toBeVisible()
  await page.reload()
  await waitForFirstFrame(page)
  await page.waitForTimeout(500)
  await expect(page.locator('#start-page')).toBeHidden()
  await page.locator('#start-btn').click()
  await expect(page.locator('#start-page')).toBeVisible()
  await expect(page.locator('#start-btn')).toHaveAttribute('aria-expanded', 'true')
})

test('the narrator speaks German in German', async ({ page }) => {
  await page.goto('/?lang=de')
  await waitForFirstFrame(page)
  await page.locator('#start-grand').click()
  await expect(page.locator('#narration-subtitle')).toContainText('Willkommen an Bord')
})

test('left alone, the start page stays and nothing flies: a tour waits for a click', async ({ page }) => {
  await page.goto('/')
  await waitForFirstFrame(page)
  await page.waitForTimeout(5_000)
  await expect(page.locator('#start-page')).toBeVisible()
  await expect(page.locator('body')).toHaveAttribute('data-context', 'explore')
})

test('the start page closes with its close button, with Escape and with a press outside it', async ({ page }) => {
  await openApp(page)
  const start = page.locator('#start-page')
  await page.locator('#start-btn').click()
  await page.locator('#start-close').click()
  await expect(start).toBeHidden()
  await expect(page.locator('#start-btn')).toBeFocused()

  await page.locator('#start-btn').click()
  await page.keyboard.press('Escape')
  await expect(start).toBeHidden()

  await page.locator('#start-btn').click()
  await page.locator('#scene').click({ position: { x: 20, y: 200 } })
  await expect(start).toBeHidden()
})

test('?tour=off opens no start page', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('#start-page')).toBeHidden()
})

test('subtitles and the narrator\'s voice are switched in More\'s Audio tab, and stay so', async ({ page }) => {
  await openApp(page)
  await page.locator('#settings-btn').click()
  await page.locator('#settings-tab-audio').click()
  await expect(page.locator('#settings-audio')).toBeVisible()
  await expect(page.locator('#settings-general')).toBeHidden()
  const subtitles = page.locator('#subtitles-toggle')
  const voice = page.locator('#narration-sound-toggle')
  await expect(subtitles).not.toBeChecked()
  await expect(voice).toBeChecked()
  await subtitles.click({ force: true })
  await voice.click({ force: true })
  await page.reload()
  await waitForFirstFrame(page)
  await expect(page.locator('#subtitles-toggle')).toBeChecked()
  await expect(page.locator('#narration-sound-toggle')).not.toBeChecked()
})

test('the music is off until a track is chosen, and the choice is remembered', async ({ page }) => {
  await openApp(page)
  await page.locator('#settings-btn').click()
  await page.locator('#settings-tab-audio').click()
  const tracks = page.locator('#music-switch').getByRole('button')
  await expect(tracks).toHaveText(['Off', 'Drift', 'Nova', 'Pixel'])
  await expect(tracks.first()).toHaveAttribute('aria-pressed', 'true')
  await tracks.nth(2).click()
  await page.reload()
  await waitForFirstFrame(page)
  await expect(page.locator('#music-switch button[data-music="nova"]')).toHaveAttribute('aria-pressed', 'true')
})

test('Explore on my own turns on the orbit paths and labels', async ({ page }) => {
  await page.goto('/')
  await waitForFirstFrame(page)
  await expect(page.locator('#scene')).toHaveAttribute('data-orbit-paths', 'false')
  await page.locator('#start-explore').click()
  await expect(page.locator('#start-page')).toBeHidden()
  await expect(page.locator('#scene')).toHaveAttribute('data-orbit-paths', 'true')
  await expect(page.locator('#scene')).toHaveAttribute('data-labels-visible', 'true')
})

test('the narrator picked on the start page speaks, and More shows the same choice', async ({ page }) => {
  const clips: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/narration/')) clips.push(new URL(request.url()).pathname)
  })
  await page.goto('/')
  await waitForFirstFrame(page)
  await page.locator('#start-voice').getByRole('button', { name: 'Orion' }).click()
  await page.locator('#start-grand').click()
  await expect.poll(() => clips).toContain('/narration/orion/en/tours/grand/sun-approach.webm')
  await page.locator('#settings-btn').click()
  await page.locator('#settings-tab-audio').click()
  await expect(page.locator('#settings-voice').getByRole('button', { name: 'Orion' })).toHaveAttribute('aria-pressed', 'true')
})

test('a mission tour from the start page puts its controls in the bar; End tour returns to exploring', async ({ page }) => {
  await openApp(page)
  await page.locator('#start-btn').click()
  await expect(page.locator('#start-page [data-tour-id]')).toHaveCount(3)
  await page.locator('#start-page [data-tour-id="voyager1"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-context', 'mission')
  await expect(page.locator('#mission-play')).toBeVisible()
  await expect(page.locator('#search-btn')).toBeHidden()
  await page.locator('#leave-btn').click()
  await expect(page.locator('body')).toHaveAttribute('data-context', 'explore')
  await expect(page.locator('#search-btn')).toBeVisible()
})

test('one menu at a time: the start page closes More, and a panel closes the start page', async ({ page }) => {
  await openApp(page)
  await page.locator('#settings-btn').click()
  await expect(page.locator('#settings-panel')).toBeVisible()
  await page.locator('#start-btn').click()
  await expect(page.locator('#settings-panel')).toBeHidden()
  await page.locator('.hud-bar [data-panel="time"]:visible').click()
  await expect(page.locator('#start-page')).toBeHidden()
})
