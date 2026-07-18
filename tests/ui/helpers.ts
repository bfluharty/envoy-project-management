import { Page } from '@playwright/test'

export const PROJECT_ALPHA_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:18080'

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

export async function login(page: Page) {
  const response = await page.request.post('/login', {
    form: {
      email: 'alice@example.com',
      password: 'hashedpassword1',
    },
    maxRedirects: 0,
  })

  const status = response.status()
  const location = response.headers().location
  if (!isRedirect(status)) {
    throw new Error(
      `Login setup failed with status ${status}. Check seeded credentials and PASSWORD_AUTH_ENABLED.`
    )
  }
  if (isLoginRedirect(location)) {
    throw new Error(
      'Login setup redirected to /login. Set PASSWORD_AUTH_ENABLED=true for UI tests.'
    )
  }

  const consentResponse = await page.request.post('/onboarding/consent', {
    data: { termsAccepted: true, modelTrainingOptIn: false },
    maxRedirects: 0,
  })
  if (!consentResponse.ok() && !isRedirect(consentResponse.status())) {
    if (consentResponse.status() === 401) {
      throw new Error('Consent setup failed with status 401. Login did not establish a session.')
    }
    throw new Error(`Consent setup failed with status ${consentResponse.status()}`)
  }

  const preferenceResponse = await page.request.patch('/account/data-preferences', {
    data: { modelTrainingOptIn: false },
    maxRedirects: 0,
  })
  if (!preferenceResponse.ok() && !isRedirect(preferenceResponse.status())) {
    throw new Error(`Data preference setup failed with status ${preferenceResponse.status()}`)
  }

  await page.goto('/dashboard')
  await page.waitForURL('**/dashboard')
}

export async function goToProject(page: Page, uuid: string = PROJECT_ALPHA_UUID) {
  await page.goto(`/projects/${uuid}`)
  await page.waitForLoadState('networkidle')
}
