import { expect, test } from '@playwright/test'

// Simulates the GPU device being lost (driver reset, GPU process crash) a moment after start.
test('a lost GPU device is reported with a way to reload instead of a silently frozen picture', async ({ page }) => {
  await page.addInitScript(() => {
    const requestDevice = GPUAdapter.prototype.requestDevice
    GPUAdapter.prototype.requestDevice = async function (...args) {
      const device = await requestDevice.apply(this, args)
      const lost = new Promise((resolve) => setTimeout(() => resolve({ reason: 'unknown', message: 'simulated loss' }), 500))
      Object.defineProperty(device, 'lost', { value: lost })
      return device
    }
  })
  await page.goto('/?tour=off')
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('graphics device stopped working')
  await expect(alert).toContainText('simulated loss')
  await expect(alert.getByRole('button', { name: 'Reload' })).toBeVisible()
})
