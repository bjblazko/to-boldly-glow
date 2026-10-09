import { expect, test } from '@playwright/test'
import { meanLuminance, type CapturedFrame } from './support/frameCapture'
import { captureFrame, diskRadiusAlongRow, followEntity, openRenderedApp, setDisplaySwitch } from './support/renderedApp'

// These tests check what actually lands in the frame, not just app state - see support/renderedApp.ts.
test.use({ viewport: { width: 480, height: 300 } })

// Mean of (max - min) / max over the pixels inside a circle: 0 for white or gray, 1 for pure color.
function meanSaturation(frame: CapturedFrame, centerX: number, centerY: number, radius: number): number {
  let sum = 0
  let count = 0
  for (let y = Math.round(centerY - radius); y <= Math.round(centerY + radius); y++) {
    for (let x = Math.round(centerX - radius); x <= Math.round(centerX + radius); x++) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 > radius ** 2) continue
      const i = (y * frame.width + x) * 4
      const channels = [frame.pixels[i], frame.pixels[i + 1], frame.pixels[i + 2]]
      const max = Math.max(...channels)
      sum += max === 0 ? 0 : (max - Math.min(...channels)) / max
      count++
    }
  }
  return sum / count
}

// Mean luminance of a thin ring between two radii, sampled at points around it.
function ringLuminance(frame: CapturedFrame, center: { x: number; y: number }, radius: number): number {
  const samples = 48
  let sum = 0
  for (let i = 0; i < samples; i++) {
    const angle = (i / samples) * 2 * Math.PI
    sum += meanLuminance(frame, center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, 1.5)
  }
  return sum / samples
}

test('the over-bright Sun burns out toward white (AgX tonemapping)', async ({ page }) => {
  const errors = await openRenderedApp(page)
  await setDisplaySwitch(page, '#body-labels-toggle', false)
  await followEntity(page, 'Sun')
  const frame = await captureFrame(page)

  // Per-channel tonemapping (Reinhard, the former look) kept it orange: a saturation above 0.37.
  expect(meanSaturation(frame, 240, 150, 10)).toBeLessThan(0.3)
  // The sky stays dark.
  expect(meanLuminance(frame, 20, 20, 15)).toBeLessThan(40)
  expect(errors).toEqual([])
})

test("the Sun's disc darkens toward its edge (limb darkening)", async ({ page }) => {
  const errors = await openRenderedApp(page)
  // Without bloom the Sun isn't over-bright, so its own shading shows unclipped.
  await setDisplaySwitch(page, '#bloom-toggle', false)
  await setDisplaySwitch(page, '#body-labels-toggle', false)
  await setDisplaySwitch(page, '#flares-toggle', false)
  await followEntity(page, 'Sun')
  const frame = await captureFrame(page)
  const center = { x: 240, y: 150 }
  const radius = diskRadiusAlongRow(frame, center.x, center.y)
  expect(radius).toBeGreaterThan(20)

  const middle = meanLuminance(frame, center.x, center.y, radius * 0.4)
  const nearEdge = ringLuminance(frame, center, radius * 0.92)
  expect(nearEdge).toBeLessThan(middle * 0.85)
  expect(errors).toEqual([])
})
