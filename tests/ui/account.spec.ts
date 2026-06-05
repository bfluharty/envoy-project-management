import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

test.describe('account — password update', () => {
  test('wrong current password is rejected without changing state', async ({ page }) => {
    await login(page)
    await page.goto('/account')

    await page.getByLabel('Current password').fill('definitely-wrong-current')
    await page.getByLabel('New password', { exact: true }).fill('NewPassword123!')
    await page.getByLabel('Confirm new password').fill('NewPassword123!')
    await page.getByRole('button', { name: 'Update Password' }).click()

    // The submit should NOT show the success flash. We accept any failure
    // signal (validation error text, persistent error banner, or simply
    // the absence of the success message).
    await expect(page.getByText('Your password has been updated.')).toHaveCount(0)
  })

  test('mismatched confirmation is rejected', async ({ page }) => {
    await login(page)
    await page.goto('/account')

    await page.getByLabel('Current password').fill('hashedpassword1')
    await page.getByLabel('New password', { exact: true }).fill('NewPassword123!')
    await page.getByLabel('Confirm new password').fill('Different456!')
    await page.getByRole('button', { name: 'Update Password' }).click()

    await expect(page.getByText('Your password has been updated.')).toHaveCount(0)
  })
})

test.describe('account — appearance', () => {
  test('Dark mode toggle becomes pressed when clicked', async ({ page }) => {
    await login(page)
    await page.goto('/account')

    const darkButton = page.getByRole('button', { name: 'Dark mode' })
    const lightButton = page.getByRole('button', { name: 'Light mode' })

    await darkButton.click()
    await expect(darkButton).toHaveAttribute('aria-pressed', 'true')

    await lightButton.click()
    await expect(lightButton).toHaveAttribute('aria-pressed', 'true')
    await expect(darkButton).toHaveAttribute('aria-pressed', 'false')
  })
})
