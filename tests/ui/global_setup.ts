import { chromium } from '@playwright/test'

/**
 * Warms the Vite dependency optimization cache before tests run.
 *
 * The first navigation to a page that uses @skeletonlabs/skeleton-svelte causes
 * Vite to re-optimize the dependency with a new hash. Any concurrent or subsequent
 * page loads that reference the old hash get a 504, which prevents the load event
 * from firing and causes waitForURL timeouts in tests.
 *
 * This setup runs once before all tests: it logs in, visits the dashboard, and
 * loads the project page so Vite finishes re-optimizing before tests start.
 */
export default async function globalSetup() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // Login
    await page.goto('http://localhost:8080/login')
    await page.waitForLoadState('domcontentloaded')
    await page.fill('input[name=email]', 'alice@example.com')
    await page.fill('input[name=password]', 'hashedpassword1')
    await page.click('button[type=submit]')

    // Wait for the dashboard to fully load — this is when Vite re-optimizes
    // home.svelte's skeleton-svelte imports. Use a long timeout to allow for
    // the automatic full-reload Vite triggers after re-optimization.
    await page.waitForURL('**/dashboard', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 })

    // Navigate to the project page to warm the SegmentedControl (skeleton-svelte)
    // optimization. Wait for the radiogroup to confirm skeleton-svelte loaded.
    await page.goto('http://localhost:8080/projects/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')
    await page.getByRole('radiogroup').waitFor({ timeout: 30000 })
  } finally {
    await browser.close()
  }
}
