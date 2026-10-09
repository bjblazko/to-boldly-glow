import { expect, type Page } from '@playwright/test'

// Before its first frame the app uploads every body texture and builds its mipmaps. On software
// WebGPU (SwiftShader, as on CI) that takes seconds - more while the other test worker renders at
// the same time - so the boot gets far longer than Playwright's default 5 s expect timeout.
const BOOT_TIMEOUT_MS = 30_000

// Resolves once the app has booted and submitted its first frame (see scaffold.spec.ts).
export async function waitForFirstFrame(page: Page): Promise<void> {
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true', { timeout: BOOT_TIMEOUT_MS })
}

export async function openApp(page: Page): Promise<void> {
  await page.goto('/?tour=off')
  await waitForFirstFrame(page)
}
