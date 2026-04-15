import { Page } from '@playwright/test'

export const PROJECT_ALPHA_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

export async function login(page: Page) {
  const response = await page.request.post('/login', {
    form: {
      email: 'alice@example.com',
      password: 'hashedpassword1',
    },
  })

  if (!response.ok() && ![302, 303].includes(response.status())) {
    throw new Error(`Login request failed with status ${response.status()}`)
  }

  await page.goto('/dashboard')
  await page.waitForURL('**/dashboard')
}

export async function goToProject(page: Page, uuid: string = PROJECT_ALPHA_UUID) {
  await page.goto(`/projects/${uuid}`)
  await page.waitForLoadState('networkidle')
}
