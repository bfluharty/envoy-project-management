import { chromium } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:18080'

function appUrl(path: string) {
  return new URL(path, BASE_URL).toString()
}

function isRedirect(status: number) {
  return status === 302 || status === 303
}

function isLoginRedirect(location: string | undefined) {
  if (!location) return false

  try {
    return new URL(location, BASE_URL).pathname === '/login'
  } catch {
    return location.startsWith('/login')
  }
}

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
    // Public feature specs do not require seeded users. Warm the two public
    // entry pages first so they remain runnable against a clean development DB.
    await page.goto(appUrl('/'))
    await page.locator('h1').waitFor({ timeout: 30000 })
    await page.goto(appUrl('/register'))
    await page.locator('h2').waitFor({ timeout: 30000 })

    // Login through HTTP to avoid UI render flakiness on /login.
    const loginResponse = await page.request.post(appUrl('/login'), {
      form: {
        email: 'alice@example.com',
        password: 'hashedpassword1',
      },
      maxRedirects: 0,
    })

    if (!isRedirect(loginResponse.status())) return
    if (isLoginRedirect(loginResponse.headers().location)) return

    const consentResponse = await page.request.post(appUrl('/onboarding/consent'), {
      data: { termsAccepted: true, modelTrainingOptIn: false },
      maxRedirects: 0,
    })
    if (!consentResponse.ok() && !isRedirect(consentResponse.status())) return

    // Wait for the dashboard to fully load — this is when Vite re-optimizes
    // home.svelte's skeleton-svelte imports. Use a long timeout to allow for
    // the automatic full-reload Vite triggers after re-optimization.
    const dashboardResponse = await page.goto(appUrl('/dashboard'))
    if (!dashboardResponse || new URL(page.url()).pathname !== '/dashboard') return

    await page.waitForURL('**/dashboard', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 })

    // Navigate to the project page to warm the SegmentedControl (skeleton-svelte)
    // optimization. Wait for the radiogroup to confirm skeleton-svelte loaded.
    await page.goto(appUrl('/projects/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'))
    await page.getByRole('radiogroup').waitFor({ timeout: 30000 })
  } finally {
    await browser.close()
  }
}
