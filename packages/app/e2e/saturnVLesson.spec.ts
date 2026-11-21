import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support/appBoot'
import type { CapturedFrame } from './support/frameCapture'
import { openLesson, exitLesson } from './support/hud'
import { captureFrame, countBrightPixels, openRenderedApp, renderFrames } from './support/renderedApp'

const CHAPTERS = ['whole', 'stack', 'sic', 'sii', 'sivb', 'iu', 'spacecraft', 'returns']

async function nextChapter(page: Page, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await page.locator('#lesson-next-chapter').click()
}

// The requests whose path matches, as they are made.
function requests(page: Page, pattern: RegExp): string[] {
  const paths: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (pattern.test(path)) paths.push(path)
  })
  return paths
}

test('the Saturn V lesson loads its model, marks the stage heights and reads every chapter', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  // The lesson's own warning when its model, room or shaders fail to load.
  page.on('console', (message) => {
    if (/Saturn V lesson could not load/.test(message.text())) errors.push(message.text())
  })
  const model = requests(page, /^\/models\/saturnV\//)
  const clips = requests(page, /^\/narration\/lyra\/en\/lessons\/saturnV\//)
  await openApp(page)

  await openLesson(page, 'saturnV')
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'saturnV')
  await expect.poll(() => model).toEqual(expect.arrayContaining(['/models/saturnV/saturnV.json', '/models/saturnV/saturnV.bin']))
  await expect(page.locator('#voyager-labels')).toContainText('Top of the S-IC')
  await expect(page.locator('#voyager-labels')).toContainText('the first stage')

  for (const [index, id] of CHAPTERS.entries()) {
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', id)
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', 'vehicle')
    await expect.poll(() => clips).toContain(`/narration/lyra/en/lessons/saturnV/${id}.webm`)
    if (index < CHAPTERS.length - 1) await nextChapter(page)
  }
  await expect(page.locator('#lesson-next-chapter')).toBeDisabled()
  // Only the command module comes home: the other parts' labels are gone.
  await expect(page.locator('#voyager-labels')).toContainText('Command module')

  await exitLesson(page)
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  expect(errors).toEqual([])
})

// These check what actually lands in the frame - see support/renderedApp.ts.
test.describe('rendered', () => {
  test.use({ viewport: { width: 640, height: 700 } })

  test('the rocket stands in an open blueprint room on black, and its cut shows the kerosene inside', async ({ page }) => {
    test.setTimeout(240_000)
    const errors = await openRenderedApp(page)
    await openLesson(page, 'saturnV')
    await renderFrames(page, 40)
    const whole = await captureFrame(page)
    await nextChapter(page, 2)
    await renderFrames(page, 50)
    const sic = await captureFrame(page)

    const black = countBrightPixels(whole, whole.width - 80, 0, whole.width, 60, 12)
    const blueprint = countPixels(whole, (r, g, b) => b > 40 && b > r + 15)
    const kerosene = countPixels(sic, (r, g, b) => r > 110 && r > g + 25 && g > b + 15)
    console.log('SATURNV frame', JSON.stringify({ black, blueprint, kerosene }))
    expect(black).toBe(0)
    expect(blueprint).toBeGreaterThan(2000)
    expect(kerosene).toBeGreaterThan(100)
    expect(errors).toEqual([])
  })
})

// How many pixels of the frame the test picks out by their color.
function countPixels(frame: CapturedFrame, picks: (r: number, g: number, b: number) => boolean): number {
  let count = 0
  for (let i = 0; i < frame.pixels.length; i += 4) if (picks(frame.pixels[i], frame.pixels[i + 1], frame.pixels[i + 2])) count++
  return count
}
