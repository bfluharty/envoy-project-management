import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/ui',
  globalSetup: './tests/ui/global_setup.ts',
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8080',
    // screenshot: 'only-on-failure',
  },
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
