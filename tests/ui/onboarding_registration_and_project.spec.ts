import { expect, test, type Page } from '@playwright/test'
import { fulfillInertiaPage, mockInertiaPage, redirectInertia } from './inertia_fixture.js'

const ONBOARDING_TOKEN = '7d9b5f0a-79b9-4b73-8b25-79677e31c2c5'
const PROJECT_UUID = '99999999-9999-4999-8999-999999999999'

const consumerUser = {
  uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  fullName: 'Jane Consumer',
  email: 'jane@example.com',
  avatar: null,
}

const selectedVendors = [
  {
    vendorListingUuid: '11111111-1111-4111-8111-111111111111',
    name: 'Richmond Build Co',
    categories: ['Commercial Contractor', 'Construction'],
    location: {
      address: '456 Broad St',
      locality: 'Richmond',
      region: 'VA',
      postcode: '23220',
      country: 'US',
      formatted_address: '456 Broad St, Richmond, VA 23220',
    },
    onboardedToEnvoy: true,
    consumerOwned: false,
    ownershipWarning: null,
  },
  {
    vendorListingUuid: '22222222-2222-4222-8222-222222222222',
    name: 'Consumer Managed Design',
    categories: ['Interior Designer'],
    location: null,
    onboardedToEnvoy: false,
    consumerOwned: true,
    ownershipWarning: 'This listing is not verified by the vendor.',
  },
]

const activeProjectProps = {
  state: 'active',
  project: {
    title: '',
    description: 'I need to renovate a small restaurant space before opening.',
    location: {
      postalCode: '23220',
      formatted_address: '23220',
    },
  },
  selectedVendors,
  selectedVendorListingUuids: selectedVendors.map((vendor) => vendor.vendorListingUuid),
  currencies: [
    { code: 'USD', name: 'US Dollar' },
    { code: 'CAD', name: 'Canadian Dollar' },
  ],
  recovery: null,
  user: consumerUser,
}

const projectPageProps = {
  project: {
    uuid: PROJECT_UUID,
    name: 'Restaurant Renovation',
    description: 'I need to renovate a small restaurant space before opening.',
    location: { city: 'Richmond', state: 'VA', formatted_address: 'Richmond, VA' },
    startDate: null,
    endDate: null,
    deadline: null,
    budgetAmount: null,
    budgetCurrency: 'USD',
    goals: null,
  },
  linkedVendors: [],
  allVendors: [],
  hasPriorConversation: true,
  conversationHistory: [],
  user: consumerUser,
}

async function mockRegisterPage(
  page: Page,
  accountType: 'consumer' | 'vendor' = 'consumer',
  path = '/register'
) {
  await mockInertiaPage(page, path, 'auth/register', {
    flashMessage: null,
    socialAuthProviders: [
      {
        provider: 'google',
        label: 'Google',
        href: `/auth/google/redirect?intent=register&accountType=${accountType}`,
      },
      {
        provider: 'microsoft',
        label: 'Microsoft',
        href: `/auth/microsoft/redirect?intent=register&accountType=${accountType}`,
      },
    ],
    passwordAuthEnabled: true,
    accountType,
    errors: {},
  })
}

async function fillPasswordRegistration(page: Page) {
  await page.getByLabel('Full Name').fill('Jane Consumer')
  await page.getByLabel('Email address').fill('jane@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByLabel('Confirm Password').fill('password123')
}

async function expectAccountTypeSelected(page: Page, name: RegExp) {
  const radio = page.getByRole('radio', { name })
  await expect(radio).toBeChecked()
}

test.describe('registration handoff', () => {
  test('defaults to consumer and preselects vendor from the For pros route', async ({ page }) => {
    await mockRegisterPage(page)
    await page.goto('/register')
    await expectAccountTypeSelected(page, /I am planning a project/i)

    await page.unroute('/register')
    await mockRegisterPage(page, 'vendor', '/register?accountType=vendor')
    await page.goto('/register?accountType=vendor')
    await expectAccountTypeSelected(page, /^I am a pro or vendor/i)
  })

  test('submits account type and onboarding token in the password body, then auto-login redirects', async ({
    page,
  }) => {
    await page.addInitScript(
      (token) => localStorage.setItem('envoy_onboarding_token', token),
      ONBOARDING_TOKEN
    )
    await mockRegisterPage(page)
    await mockInertiaPage(page, '/onboarding/project', 'onboarding/project', activeProjectProps)

    let registrationBody: Record<string, unknown> | undefined
    await page.route('/register', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      registrationBody = route.request().postDataJSON()
      await redirectInertia(route, '/onboarding/project')
    })

    await page.goto('/register')
    await fillPasswordRegistration(page)
    await page.getByRole('button', { name: 'Create account' }).click()

    await page.waitForURL('**/onboarding/project')
    expect(registrationBody).toEqual({
      fullName: 'Jane Consumer',
      email: 'jane@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
      accountType: 'consumer',
      onboardingToken: ONBOARDING_TOKEN,
    })
    await expect(page.getByRole('heading', { name: 'Complete your project' })).toBeVisible()
  })

  test('vendor password registration omits onboarding token and redirects to pending verification', async ({
    page,
  }) => {
    await mockRegisterPage(page, 'vendor', '/register?accountType=vendor')
    await mockInertiaPage(page, '/vendor/pending', 'vendors/pending', {
      vendorName: 'Jane Consumer',
      user: { ...consumerUser, fullName: 'Jane Consumer' },
    })

    let registrationBody: Record<string, unknown> | undefined
    await page.route('**/register?accountType=vendor', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      registrationBody = route.request().postDataJSON()
      await redirectInertia(route, '/vendor/pending')
    })
    await page.route('/register', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      registrationBody = route.request().postDataJSON()
      await redirectInertia(route, '/vendor/pending')
    })

    await page.goto('/register?accountType=vendor')
    await fillPasswordRegistration(page)
    await page.getByRole('button', { name: 'Create account' }).click()

    await page.waitForURL('**/vendor/pending')
    expect(registrationBody).toMatchObject({ accountType: 'vendor' })
    expect(registrationBody).not.toHaveProperty('onboardingToken')
    await expect(page.getByRole('heading', { name: /on the list/i })).toBeVisible()
  })

  test('hands off the token before starting social registration', async ({ page }) => {
    await page.addInitScript(
      (token) => localStorage.setItem('envoy_onboarding_token', token),
      ONBOARDING_TOKEN
    )
    await mockRegisterPage(page)
    const calls: string[] = []
    let handoffBody: unknown

    await page.route('/onboarding/registration-handoff', async (route) => {
      calls.push('handoff')
      handoffBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ redirectTo: '/register?accountType=consumer' }),
      })
    })
    await page.route(
      '**/auth/google/redirect?intent=register&accountType=consumer',
      async (route) => {
        calls.push('oauth')
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<h1>Google OAuth</h1>',
        })
      }
    )

    await page.goto('/register')
    await page.getByText('Continue with Google', { exact: true }).click()

    await page.waitForURL('**/auth/google/redirect?intent=register&accountType=consumer')
    expect(calls).toEqual(['handoff', 'oauth'])
    expect(handoffBody).toEqual({ onboardingToken: ONBOARDING_TOKEN })
    expect(page.url()).not.toContain(ONBOARDING_TOKEN)
  })

  test('keeps the user on registration when the social handoff fails', async ({ page }) => {
    await page.addInitScript(
      (token) => localStorage.setItem('envoy_onboarding_token', token),
      ONBOARDING_TOKEN
    )
    await mockRegisterPage(page)
    let oauthCalled = false
    await page.route('/onboarding/registration-handoff', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"failed"}' })
    )
    await page.route('**/auth/google/redirect**', async (route) => {
      oauthCalled = true
      await route.abort()
    })

    await page.goto('/register')
    await page.getByText('Continue with Google', { exact: true }).click()

    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByRole('alert')).toContainText(/try again|could not/i)
    expect(oauthCalled).toBe(false)
  })
})

test.describe('first project completion', () => {
  test('prefills the intake fields and renders selected vendors as read-only review', async ({
    page,
  }) => {
    await mockInertiaPage(page, '/onboarding/project', 'onboarding/project', activeProjectProps)
    await page.goto('/onboarding/project')

    await expect(page.getByRole('heading', { name: 'Complete your project' })).toBeVisible()
    await expect(page.getByLabel('Description')).toHaveValue(
      'I need to renovate a small restaurant space before opening.'
    )
    await expect(page.getByPlaceholder('Search city or address…')).toHaveValue('23220')
    await expect(page.getByText('Richmond Build Co')).toBeVisible()
    await expect(page.getByText('Onboarded to Envoy')).toBeVisible()
    await expect(page.getByText('Consumer Managed Design')).toBeVisible()
    await expect(page.getByText(/Unverified listing/i)).toBeVisible()
    await expect(page.getByText(/No email on file/i)).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
  })

  test('submits the canonical project payload without a token, clears browser state, and opens Chat', async ({
    page,
  }) => {
    await mockInertiaPage(page, '/onboarding/project', 'onboarding/project', activeProjectProps)
    await mockInertiaPage(page, `/projects/${PROJECT_UUID}`, 'projects/project', projectPageProps)

    let completionBody: Record<string, unknown> | undefined
    await page.route('/onboarding/project', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      completionBody = route.request().postDataJSON()
      await fulfillInertiaPage(
        route,
        'projects/project',
        `/projects/${PROJECT_UUID}`,
        projectPageProps
      )
    })

    await page.goto('/onboarding/project')
    await page.evaluate((token) => {
      localStorage.setItem('envoy_onboarding_token', token)
      localStorage.setItem('envoy_seen', 'true')
    }, ONBOARDING_TOKEN)
    await page.getByLabel('Title').fill('Restaurant Renovation')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: /Skip & create/i }).click()

    await page.waitForURL(`**/projects/${PROJECT_UUID}`)
    expect(completionBody).toMatchObject({
      title: 'Restaurant Renovation',
      description: 'I need to renovate a small restaurant space before opening.',
      location: {
        city: '23220',
        state: '',
        postcode: '23220',
        formatted_address: '23220',
        lat: null,
        lon: null,
      },
      budgetCurrency: 'USD',
    })
    expect(completionBody).not.toHaveProperty('onboardingToken')
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => ({
          token: localStorage.getItem('envoy_onboarding_token'),
          seen: localStorage.getItem('envoy_seen'),
        }))
      )
      .toEqual({ token: null, seen: null })
  })

  test('shows partial-success warnings after unavailable selections are skipped', async ({
    page,
  }) => {
    await mockInertiaPage(page, `/projects/${PROJECT_UUID}`, 'projects/project', {
      ...projectPageProps,
      flash: {
        success: null,
        error: null,
        partial_success:
          'Project created, but 1 selected vendor was unavailable and could not be attached.',
      },
    })

    await page.goto(`/projects/${PROJECT_UUID}`)
    await expect(
      page.getByRole('status').filter({ hasText: /vendor was unavailable/i })
    ).toBeVisible()
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible()
  })

  test('shows authenticated recovery actions for an expired draft without a project form', async ({
    page,
  }) => {
    await mockInertiaPage(page, '/onboarding/project', 'onboarding/project', {
      state: 'expired',
      project: null,
      selectedVendors: [],
      selectedVendorListingUuids: [],
      currencies: [],
      recovery: { dashboardUrl: '/dashboard', vendorSearchUrl: '/' },
      user: consumerUser,
    })

    await page.goto('/onboarding/project')

    await expect(page.getByRole('heading', { name: /expired/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to Dashboard', exact: true })).toHaveAttribute(
      'href',
      '/dashboard'
    )
    await expect(page.getByRole('link', { name: /vendor search/i })).toHaveAttribute('href', '/')
    await expect(page.getByRole('button', { name: /Create project/i })).toHaveCount(0)
  })
})

test('pending vendor page explains the approval state and next steps', async ({ page }) => {
  await mockInertiaPage(page, '/vendor/pending', 'vendors/pending', {
    vendorName: 'Richmond Pro',
    user: { ...consumerUser, fullName: 'Richmond Pro' },
  })

  await page.goto('/vendor/pending')
  await expect(page.getByRole('heading', { name: /on the list/i })).toBeVisible()
  await expect(page.getByText(/Richmond Pro/)).toBeVisible()
  await expect(page.getByText(/pending approval/i)).toBeVisible()
  await expect(page.getByText(/What happens next/i)).toBeVisible()
})
