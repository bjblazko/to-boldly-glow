import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: {
      // --enable-unsafe-swiftshader lets GPU-less machines (CI runners) fall back to SwiftShader's
      // software Vulkan instead of reporting no WebGPU adapter; machines with a GPU still use it.
      args: [
        '--enable-unsafe-webgpu',
        '--enable-features=Vulkan',
        '--use-gpu-in-tests',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
})
