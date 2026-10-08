import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support/appBoot'
import { meanLuminance, type CapturedFrame } from './support/frameCapture'
import { captureFrame, labelAnchor, luminanceAt, openRenderedApp, renderFrames } from './support/renderedApp'

const CHAPTERS: [id: string, kind: string][] = [
  ['new-moon', 'eclipseOrbit'],
  ['tilted-orbit', 'eclipseOrbit'],
  ['shadow-on-earth', 'eclipseShadow'],
  ['first-contact', 'eclipseSky'],
  ['partial', 'eclipseSky'],
  ['diamond-ring', 'eclipseSky'],
  ['totality', 'eclipseSky'],
  ['annular', 'eclipseSky'],
]

async function openEclipseLesson(page: Page): Promise<void> {
  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="solarEclipse"]').click()
}

async function nextChapter(page: Page, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await page.locator('#lesson-next-chapter').click()
}

test('the solar eclipse lesson goes from space down to the ground and back out to explore mode', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openApp(page)

  await openEclipseLesson(page)
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'solarEclipse')
  // The diagram names the shadow's two parts and the planes it is drawn against.
  await expect(page.locator('#eclipse-umbra-label')).toHaveText('Umbra')
  await expect(page.locator('#eclipse-penumbra-label')).toBeVisible()
  await expect(page.locator('#eclipse-moon-orbit-label')).toBeVisible()
  await expect(page.locator('#eclipse-orbit-plane-label')).toBeVisible()

  for (const [index, [id, kind]] of CHAPTERS.entries()) {
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', id)
    await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-kind', kind)
    if (id === 'partial') await expect(page.locator('#eclipse-glasses-label')).toBeVisible()
    if (index < CHAPTERS.length - 1) await nextChapter(page)
  }
  await expect(page.locator('#lesson-next-chapter')).toBeDisabled()
  await expect(page.locator('#lesson-note')).toContainText('Not to scale')

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  for (const label of ['umbra', 'penumbra', 'moon-orbit', 'orbit-plane', 'glasses', 'corona']) {
    await expect(page.locator(`#eclipse-${label}-label`)).toBeHidden()
  }
  expect(errors).toEqual([])
})

// These check what actually lands in the frame - see support/renderedApp.ts.
test.describe('rendered', () => {
  test.use({ viewport: { width: 640, height: 700 } })

  test("the Moon's shadow darkens Earth: black in the umbra, fading out across the penumbra", async ({ page }) => {
    test.setTimeout(180_000)
    const errors = await openRenderedApp(page)
    await openEclipseLesson(page)
    await nextChapter(page, 2)
    await renderFrames(page, 30)
    const frame = await captureFrame(page)
    const umbra = await labelAnchor(page, '#eclipse-umbra-label')
    const penumbraEdge = await labelAnchor(page, '#eclipse-penumbra-label')
    const inUmbra = meanLuminance(frame, umbra.x, umbra.y, 2)
    const atEdge = meanLuminance(frame, penumbraEdge.x, penumbraEdge.y, 3)
    const halfway = meanLuminance(frame, (umbra.x + penumbraEdge.x) / 2, (umbra.y + penumbraEdge.y) / 2, 3)
    console.log('ECLIPSE shadow', inUmbra.toFixed(1), halfway.toFixed(1), atEdge.toFixed(1))
    expect(inUmbra).toBeLessThan(25)
    expect(halfway).toBeGreaterThan(inUmbra)
    expect(atEdge).toBeGreaterThan(halfway)
    expect(atEdge).toBeGreaterThan(inUmbra * 3)
    expect(errors).toEqual([])
  })

  test('from the ground: a crescent through eclipse glasses, then the corona around the black Moon in a darkened sky', async ({ page }) => {
    test.setTimeout(240_000)
    const errors = await openRenderedApp(page)
    await openEclipseLesson(page)
    await nextChapter(page, 4)
    await renderFrames(page, 30)
    const glasses = await captureFrame(page)
    // The glasses label sits straight under the Sun, 1.6 Sun radii below its center; the corona label
    // 1.8 above and 2.6 to the left. The camera holds still between the ground chapters.
    const underSun = await labelAnchor(page, '#eclipse-glasses-label')

    await nextChapter(page, 2)
    await renderFrames(page, 30)
    const totality = await captureFrame(page)
    const coronaLabel = await labelAnchor(page, '#eclipse-corona-label')
    const sunRadius = (underSun.x - coronaLabel.x) / 2.6
    const sun = { x: underSun.x, y: underSun.y - 1.6 * sunRadius }
    console.log('ECLIPSE sun', sun, sunRadius.toFixed(1))
    expect(sunRadius).toBeGreaterThan(20)

    checkGlassesView(glasses, sun, sunRadius)
    checkTotality(totality, sun, sunRadius)
    expect(errors).toEqual([])
  })
})

// Through the glasses only the Sun shows: the bright crescent the Moon leaves on its east (left)
// side, the Moon's bite black, and the sky black.
function checkGlassesView(frame: CapturedFrame, sun: { x: number; y: number }, radius: number): void {
  const crescent = meanLuminance(frame, sun.x - 0.8 * radius, sun.y, 2)
  const bite = meanLuminance(frame, sun.x + 0.4 * radius, sun.y, 2)
  const sky = meanLuminance(frame, sun.x - 3 * radius, sun.y - radius, 3)
  console.log('ECLIPSE glasses', crescent.toFixed(1), bite.toFixed(1), sky.toFixed(1))
  expect(crescent).toBeGreaterThan(90)
  expect(bite).toBeLessThan(25)
  expect(sky).toBeLessThan(6)
}

// In totality: the corona bright around the Moon, whose disc is no brighter than the darkened sky -
// the only light in front of it is the sky's own.
function checkTotality(frame: CapturedFrame, sun: { x: number; y: number }, radius: number): void {
  const moon = meanLuminance(frame, sun.x, sun.y, 3)
  const ring = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 2 * Math.PI
    return meanLuminance(frame, sun.x + Math.cos(angle) * radius * 1.2, sun.y + Math.sin(angle) * radius * 1.2, 1.5)
  })
  const corona = ring.reduce((sum, value) => sum + value, 0) / ring.length
  const sky = luminanceAt(frame, 8, 8)
  console.log('ECLIPSE totality', moon.toFixed(1), corona.toFixed(1), sky.toFixed(1))
  expect(sky).toBeLessThan(70)
  expect(moon).toBeLessThan(sky + 20)
  expect(corona).toBeGreaterThan(moon + 60)
}
