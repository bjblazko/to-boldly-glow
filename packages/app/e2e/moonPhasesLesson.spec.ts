import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support/appBoot'
import { meanLuminance, type CapturedFrame } from './support/frameCapture'
import { captureFrame, openRenderedApp, renderFrames } from './support/renderedApp'
import { openLesson, exitLesson } from './support/hud'

const CHAPTERS: [id: string, kind: string][] = [
  ['always-half-lit', 'phasesOrbit'],
  ['not-earths-shadow', 'phasesShadow'],
  ['same-face', 'phasesOrbit'],
  ['evening-crescent', 'phasesSky'],
  ['first-quarter', 'phasesSky'],
  ['full-moon', 'phasesSky'],
  ['last-quarter', 'phasesSky'],
]

async function openPhasesLesson(page: Page): Promise<void> {
  await openLesson(page, 'moonPhases')
}

async function nextChapter(page: Page, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await page.locator('#lesson-next-chapter').click()
}

test('the Moon phases lesson goes from the orbit down to the evening sky and back out to explore mode', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openApp(page)

  await openPhasesLesson(page)
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'moonPhases')
  // From above: the sunlight, the four main phases, and the card showing the Moon as seen from Earth -
  // which changes as the Moon goes around.
  await expect(page.locator('#phases-sunlight-label')).toBeVisible()
  await expect(page.locator('#phases-full-label')).toHaveText('Full moon')
  await expect(page.locator('#moon-phase-inset')).toBeVisible()
  const firstName = await page.locator('#moon-phase-name').textContent()
  await expect(page.locator('#moon-phase-name')).not.toHaveText(firstName ?? '', { timeout: 15_000 })
  await expect(page.locator('#camera-hint')).toBeHidden()

  for (const [index, [id, kind]] of CHAPTERS.entries()) {
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', id)
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', kind)
    if (id === 'not-earths-shadow') await expect(page.locator('#phases-earth-shadow-label')).toBeVisible()
    if (id === 'same-face') await expect(page.locator('#phases-near-side-label')).toBeVisible()
    if (kind === 'phasesSky') await expect(page.locator('#moon-phase-inset')).toBeHidden()
    if (index < CHAPTERS.length - 1) await nextChapter(page)
  }
  await expect(page.locator('#lesson-next-chapter')).toBeDisabled()

  await exitLesson(page)
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('#moon-phase-inset')).toBeHidden()
  for (const label of ['sunlight', 'new', 'first-quarter', 'full', 'last-quarter', 'earth-shadow', 'moon-orbit', 'near-side']) {
    await expect(page.locator(`#phases-${label}-label`)).toBeHidden()
  }
  expect(errors).toEqual([])
})

// These check what actually lands in the frame - see support/renderedApp.ts. From the ground the
// camera looks straight toward the Moon, so it sits on the middle column of the picture.
test.describe('rendered', () => {
  test.use({ viewport: { width: 640, height: 700 } })

  test('from the ground, the first-quarter Moon is lit on its right and the last-quarter Moon on its left', async ({ page }) => {
    test.setTimeout(240_000)
    const errors = await openRenderedApp(page)
    await openPhasesLesson(page)
    await nextChapter(page, 4)
    await renderFrames(page, 30)
    const firstQuarter = await captureFrame(page)
    await nextChapter(page, 2)
    await renderFrames(page, 30)
    const lastQuarter = await captureFrame(page)

    const first = halves(firstQuarter, 1)
    const last = halves(lastQuarter, -1)
    console.log('PHASES quarters', JSON.stringify({ first, last }))
    expect(first.lit).toBeGreaterThan(first.dark + 20)
    expect(last.lit).toBeGreaterThan(last.dark + 20)
    expect(errors).toEqual([])
  })
})

// The Moon's two halves, on the row where the half that should be lit is brightest: `litSide` is
// +1 for the right half, -1 for the left. The dark half shows only the sky in front of it.
function halves(frame: CapturedFrame, litSide: number): { lit: number; dark: number } {
  const at = (offset: number, y: number) => meanLuminance(frame, frame.width / 2 + offset, y, 3)
  let row = 0
  for (let y = 4; y < frame.height * 0.6; y += 2) if (at(22 * litSide, y) > at(22 * litSide, row)) row = y
  return { lit: at(22 * litSide, row), dark: at(-22 * litSide, row) }
}
