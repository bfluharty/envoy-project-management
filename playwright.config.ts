import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/snapshots',
  snapshotDir: './tests/snapshots/__screenshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{ext}',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:57098',
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
