import { defineConfig, devices } from '@playwright/test'

const UI_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:18080'
process.env.PLAYWRIGHT_BASE_URL = UI_BASE_URL

export default defineConfig({
  testDir: './tests/ui',
  globalSetup: './tests/ui/global_setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  webServer: {
    command: 'node ace serve --no-clear',
    url: `${UI_BASE_URL}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '18080',
      APP_URL: UI_BASE_URL,
      EMAIL_SYNC_WORKER_ENABLED: 'false',
      PASSWORD_AUTH_ENABLED: 'true',
      VITE_HMR_PORT: '24679',
    },
  },
  use: {
    baseURL: UI_BASE_URL,
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
