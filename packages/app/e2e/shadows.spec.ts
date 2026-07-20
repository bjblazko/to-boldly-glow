import { expect, test } from '@playwright/test'

test('scrubbing time through moon-transit-heavy windows renders shadows without WebGPU errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Jupiter's moons orbit fast (Io: ~1.77 days), so accelerating time is the cheapest way to sweep
  // through many moon-transit/eclipse geometries (moon-on-planet and planet-on-moon shadows) in a
  // short real-time window, exercising the shadow uniform writes (occluders/ringParams) and the
  // WGSL shadow math on every frame. This is a smoke test, not a visual-correctness check — a
  // WebGPU validation error (e.g. a uniform-struct-size mismatch) surfaces as a catchable
  // pageerror via the uncapturederror listener in renderer/webgpu.ts, so an empty errors array is
  // real regression coverage for the Phase 3 body-position-loop restructuring even without
  // pixel-level assertions.
  await page.locator('.hud-dock-btn[data-panel="time"]').click()
  await page.locator('#time-preset-select').selectOption('3') // 1 day/s
  await page.waitForTimeout(3000)

  // Also exercise the Saturn ring shadow's always-on code path (no toggle to flip) and confirm the
  // scene is still rendering (not frozen/crashed) after several seconds of accelerated shadow math.
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  expect(errors).toEqual([])
})
