import { expect, test } from '@playwright/test'

const PRESET_LABELS = ['Real-time', '1 min/s', '1 hr/s', '1 day/s', '1 month/s', '1 year/s']

test('pausing the clock stops the time display from advancing (with a positive control)', async ({ page }) => {
  await page.goto('/')

  // Wait for main() to finish booting (see scaffold.spec.ts) so the clock and UI are wired up.
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Positive control: select the fastest preset so the (minute-granularity) display is guaranteed
  // to advance within a short, reliable wait. Without this half, the test below could pass for the
  // wrong reason — e.g. if refreshDisplay() were dropped from the frame loop entirely, both
  // readings would be identical whether or not pause actually did anything.
  await page.selectOption('#time-preset-select', '5') // "1 year/s" — see TIME_SCALE_PRESETS
  const beforePlaying = await page.locator('#time-display').textContent()
  await expect(page.locator('#time-display')).not.toHaveText(beforePlaying ?? '')

  await page.locator('#time-play-pause').click()
  await expect(page.locator('#time-play-pause')).toHaveText('Play')

  const firstReading = await page.locator('#time-display').textContent()
  await page.waitForTimeout(400)
  const secondReading = await page.locator('#time-display').textContent()

  expect(secondReading).toBe(firstReading)
})

test('preset dropdown lists the expected options in order', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  const optionLabels = await page.locator('#time-preset-select option').allTextContents()
  expect(optionLabels).toEqual(PRESET_LABELS)
})

test('selecting the "1 year/s" preset makes the display advance rapidly', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  const beforeReading = await page.locator('#time-display').textContent()

  // value "5" is the index of the "1 year/s" preset in TIME_SCALE_PRESETS — confirmed structurally
  // by the option-order test above.
  await page.selectOption('#time-preset-select', '5')

  // At ~3.15e7 simulated seconds per real second, the display (which shows whole years) should
  // change well within a couple of real seconds. Poll instead of a fixed sleep to avoid flakiness.
  await expect(page.locator('#time-display')).not.toHaveText(beforeReading ?? '', { timeout: 5000 })

  const afterReading = await page.locator('#time-display').textContent()
  expect(afterReading).not.toBe(beforeReading)

  // Parse each reading ("YYYY-MM-DD HH:MM UTC") back into a Date and confirm the simulated time
  // jumped by a large amount (at least several simulated days), not just that some digit ticked
  // over by the minimum granularity — this distinguishes "1 year/s is really applied" from a
  // display that merely advanced by ordinary real time.
  const parseDisplay = (reading: string | null) => new Date(`${reading?.replace(' UTC', '').replace(' ', 'T')}:00Z`)
  const beforeMs = parseDisplay(beforeReading).getTime()
  const afterMs = parseDisplay(afterReading).getTime()
  const oneDayMs = 24 * 60 * 60 * 1000
  expect(afterMs - beforeMs).toBeGreaterThan(oneDayMs)
})
