import { Page } from '@playwright/test'

export const PROJECT_ALPHA_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

export async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill('alice@example.com')
  await page.getByLabel('Password').fill('hashedpassword1')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard')
}

export async function goToProject(page: Page, uuid: string = PROJECT_ALPHA_UUID) {
  await page.goto(`/projects/${uuid}`)
  await page.waitForLoadState('networkidle')
}
