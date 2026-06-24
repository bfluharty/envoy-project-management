import { test, expect } from '@playwright/test'

test.describe('login form', () => {
  test('shows error banner on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill('alice@example.com')
    await page.getByLabel('Password').fill('definitely-wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('keeps email value after failed submission', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill('keep.me@example.com')
    await page.getByLabel('Password').fill('wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByLabel('Email address')).toHaveValue('keep.me@example.com')
  })
})

test.describe('register form', () => {
  test('rejects mismatched password confirmation', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Full Name').fill('Mismatch User')
    await page.getByLabel('Email address').fill(`mismatch.${Date.now()}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill('Password123!')
    await page.getByLabel('Confirm Password').fill('Different456!')
    await page.getByRole('button', { name: 'Create account' }).click()

    // Either a client-side error or server re-render; the user does NOT
    // get redirected to /login on a failed registration.
    await expect(page).toHaveURL(/\/register$/)
  })

  test('rejects too-short password', async ({ page }) => {
    await page.goto('/register')
    const email = `short.${Date.now()}@example.com`
    await page.getByLabel('Full Name').fill('Short Pw User')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill('short')
    await page.getByLabel('Confirm Password').fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/register$/)
  })
})

test.describe('forgot password', () => {
  test('submitting an email returns to the forgot-password page without error', async ({
    page,
  }) => {
    await page.goto('/forgot-password')
    await page.getByLabel(/email/i).fill('alice@example.com')
    await page.getByRole('button', { name: 'Send reset link' }).click()

    // Server redirects back to /forgot-password (or to /) after flashing.
    // We accept either, but should not see an unhandled error page.
    await expect(page.locator('h1, h2').first()).toBeVisible()
    await expect(page).toHaveURL(/(forgot-password|^http[^\/]+\/$)/)
  })
})
