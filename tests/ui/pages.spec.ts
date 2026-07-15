import { test, expect } from '@playwright/test'
import { login, goToProject } from './helpers.js'

const AVATAR_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn9l1cAAAAASUVORK5CYII=',
  'base64'
)

test('landing page', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('Plan any project')
  await expect(page.getByLabel('What are you planning?')).toBeVisible()
  await expect(page.getByLabel(/ZIP or postal code/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Find vendors' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible()
})

test('login page', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('h2')).toContainText('Sign in to your account')
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(page.locator('main > div.max-w-md').first()).toHaveClass(/bg-surface-50-950\/50/)
  await expect(page.locator('main > div.max-w-md').first()).toHaveClass(/backdrop-blur-md/)
})

test('forgot password page', async ({ page }) => {
  await page.goto('/forgot-password')
  await expect(page.locator('h2')).toContainText('Forgot your password?')
  await expect(page.getByText('If you originally signed in with Google')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()
})

test('register page', async ({ page }) => {
  await page.goto('/register')
  await expect(page.locator('h2')).toContainText('Create your account')
  await expect(page.getByLabel('Full Name')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  await expect(page.locator('main > div.max-w-md').first()).toHaveClass(/bg-surface-50-950\/50/)
  await expect(page.locator('main > div.max-w-md').first()).toHaveClass(/backdrop-blur-md/)
})

test('dashboard page', async ({ page }) => {
  await login(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: '+ New project' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Account' })).toBeVisible()
})

test('project page - chat tab', async ({ page }) => {
  await login(page)
  await goToProject(page)
  await expect(page.getByPlaceholder('Type your message...')).toBeVisible()
})

test('account page', async ({ page }) => {
  await login(page)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  await expect(page.getByTestId('account-avatar')).toBeVisible()
  await expect(page.getByLabel('Upload profile image')).toBeAttached()
  await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Color theme' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Password', exact: true })).toBeVisible()
  await expect(page.getByLabel('Current password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update Password' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Email me a password setup link' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Data & Privacy', exact: true })).toBeVisible()
  await expect(page.locator('#modelTrainingOptIn')).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Save preference' })).toBeDisabled()
  await expect(
    page.getByRole('heading', { name: 'Connected Email Accounts', exact: true })
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Connect Gmail' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
})

test('uploaded avatar is used on account and chat, then falls back after removal', async ({
  page,
}) => {
  await login(page)
  await page.goto('/account')

  const accountAvatar = page.getByTestId('account-avatar')
  await expect(accountAvatar).toHaveAttribute('data-avatar-source', 'generated')
  await expect(accountAvatar).toContainText('AE')

  await page.getByLabel('Upload profile image').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: AVATAR_PNG,
  })

  await expect(accountAvatar).toHaveAttribute('data-avatar-source', 'upload')
  const uploadedAccountAvatarSrc = await accountAvatar.locator('img').getAttribute('src')
  expect(uploadedAccountAvatarSrc).toBeTruthy()

  await page.route('**/projects/*/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: 'Thanks, I can help with that.',
    })
  })

  await goToProject(page)
  await page.getByPlaceholder('Type your message...').fill('Avatar check')
  await page.getByRole('button', { name: 'Send' }).click()

  const chatAvatar = page.getByTestId('chat-user-avatar').last()
  await expect(chatAvatar).toHaveAttribute('data-avatar-source', 'upload')
  await expect(chatAvatar.locator('img')).toBeVisible()
  await expect(chatAvatar.locator('img')).toHaveAttribute('src', uploadedAccountAvatarSrc!)

  await page.goto('/account')
  await page.getByRole('button', { name: 'Remove uploaded photo' }).click()

  await expect(accountAvatar).toHaveAttribute('data-avatar-source', 'generated')
  await expect(accountAvatar).toContainText('AE')

  await goToProject(page)
  await page.getByPlaceholder('Type your message...').fill('Avatar fallback check')
  await page.getByRole('button', { name: 'Send' }).click()

  const fallbackChatAvatar = page.getByTestId('chat-user-avatar').last()
  await expect(fallbackChatAvatar).toHaveAttribute('data-avatar-source', 'generated')
  await expect(fallbackChatAvatar).toContainText('AE')
})
