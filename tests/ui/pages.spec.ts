import { test, expect, type Page } from '@playwright/test'
import { login, goToProject } from './helpers.js'

const AVATAR_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn9l1cAAAAASUVORK5CYII=',
  'base64'
)

function isRedirect(status: number) {
  return status === 302 || status === 303
}

async function resetUploadedAvatar(page: Page) {
  const response = await page.request.delete('/account/avatar', { maxRedirects: 0 })
  if (!response.ok() && !isRedirect(response.status())) {
    throw new Error(`Avatar cleanup failed with status ${response.status()}`)
  }
}

async function openProjectChat(page: Page) {
  await page.getByRole('radio', { name: 'chat' }).click({ force: true })
  return page.getByPlaceholder('Type your message...')
}

test('landing page', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('Plan any project')
  await expect(page.getByLabel('What are you planning?')).toBeVisible()
  await expect(page.getByLabel(/ZIP or postal code/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
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
  await expect(await openProjectChat(page)).toBeVisible()
})

test('project chat keeps the composer editable while waiting for an agent response', async ({
  page,
}) => {
  let resolveChatResponse: (() => void) | undefined

  await login(page)
  await page.route('**/projects/*/chat', async (route) => {
    await new Promise<void>((resolve) => {
      resolveChatResponse = resolve
    })
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: 'Thanks, I can help with that.',
    })
  })

  await goToProject(page)
  const chatInput = await openProjectChat(page)
  const sendButton = page.getByRole('button', { name: 'Send' })

  await chatInput.fill('First message')
  await sendButton.click()

  await expect(sendButton).toBeDisabled()
  await expect(page.getByRole('button', { name: /Sending/i })).toHaveCount(0)
  await expect(chatInput).toBeEnabled()
  await expect(chatInput).toBeFocused()

  await chatInput.fill('Draft the next thought')
  await expect(chatInput).toHaveValue('Draft the next thought')

  resolveChatResponse?.()
  await expect(page.getByText('Thanks, I can help with that.')).toBeVisible()
  await expect(chatInput).toBeFocused()
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
  await expect(page.getByRole('link', { name: /Gmail/ })).toHaveAttribute(
    'href',
    '/inbox/connect?provider=gmail'
  )
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
})

test('uploaded avatar is used on account and chat, then falls back after removal', async ({
  page,
}) => {
  await login(page)
  await resetUploadedAvatar(page)

  try {
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
    const chatInput = await openProjectChat(page)
    await chatInput.fill('Avatar check')
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
    const fallbackChatInput = await openProjectChat(page)
    await fallbackChatInput.fill('Avatar fallback check')
    await page.getByRole('button', { name: 'Send' }).click()

    const fallbackChatAvatar = page.getByTestId('chat-user-avatar').last()
    await expect(fallbackChatAvatar).toHaveAttribute('data-avatar-source', 'generated')
    await expect(fallbackChatAvatar).toContainText('AE')
  } finally {
    await resetUploadedAvatar(page)
  }
})
