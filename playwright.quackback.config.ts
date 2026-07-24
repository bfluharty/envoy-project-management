import { defineConfig, devices } from '@playwright/test'

const port = process.env.QUACKBACK_LIVE_TEST_PORT ?? '18081'
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/integration',
  testMatch: 'quackback_live.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
