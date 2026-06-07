import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080'

export default defineConfig({
  testDir: './tests/ui',
  globalSetup: './tests/ui/global_setup.ts',
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL,
    // screenshot: 'only-on-failure',
  },
  webServer: process.env.CI
    ? {
        command: 'node bin/server.js',
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: false,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 1024 },
        colorScheme: 'dark',
      },
    },
  ],
})
