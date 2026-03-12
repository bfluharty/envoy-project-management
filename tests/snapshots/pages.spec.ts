import { test, expect, Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill('alice@example.com')
  await page.getByLabel('Password').fill('hashedpassword1')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard')
}

test('landing page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveScreenshot('landing.png', { fullPage: true })
})

test('login page', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveScreenshot('login.png', { fullPage: true })
})

test('register page', async ({ page }) => {
  await page.goto('/register')
  await expect(page).toHaveScreenshot('register.png', { fullPage: true })
})

test('dashboard page', async ({ page }) => {
  await login(page)
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('dashboard.png')
})

test('chat page', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  // Navigate to the first project from the sidebar
  // Project links match /projects/{uuid} — note the trailing slash excludes the /projects JSON link
  const firstProject = page.locator('a[href^="/projects/"]').first()
  await firstProject.waitFor({ timeout: 10000 })
  const href = await firstProject.getAttribute('href')
  if (!href) throw new Error('No project links found in sidebar')
  await page.goto(href)
  await page.waitForLoadState('networkidle')
  // Wait for the initial AI response to arrive before snapshotting
  await page.waitForFunction(() => document.querySelectorAll('.card').length > 1, {
    timeout: 30000,
  })
  await expect(page).toHaveScreenshot('chat.png')
})
