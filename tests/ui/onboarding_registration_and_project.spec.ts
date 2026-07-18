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

const missingEmailProjectProps = {
  ...activeProjectProps,
  selectedVendors: [
    { ...selectedVendors[0], hasEmail: true },
    { ...selectedVendors[1], hasEmail: false },
  ],
  selectedVendorListingUuids: selectedVendors.map((vendor) => vendor.vendorListingUuid),
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
        href: `/auth/google?flow=registration&accountType=${accountType}`,
      },
      {
        provider: 'microsoft',
        label: 'Microsoft',
        href: `/auth/microsoft?flow=registration&accountType=${accountType}`,
      },
    ],
    passwordAuthEnabled: true,
    accountType,
    errors: {},
  })
}

async function mockConsentPage(page: Page) {
  await mockInertiaPage(page, '/onboarding/consent', 'onboarding/consent', {
    termsVersion: '2026-07-15-terms-v1',
    privacyPolicyVersion: '2026-07-15-privacy-v1',
    modelTrainingNoticeVersion: '2026-07-15-model-training-v1',
    privacyReackOnly: false,
  })
}

async function fillPasswordRegistration(page: Page) {
  await page.getByLabel('Full Name').fill('Jane Consumer')
  await page.getByLabel('Email address').fill('jane@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByLabel('Confirm Password').fill('password123')
}

test.describe('registration handoff', () => {
  test('switches between consumer and pro registration from the top navigation', async ({
    page,
  }) => {
    await mockRegisterPage(page)
    await mockRegisterPage(page, 'vendor', '/register?accountType=vendor')
    await mockRegisterPage(page, 'consumer', '/register?accountType=consumer')
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
    await expect(page.getByText('What brings you to Envoy?')).toHaveCount(0)
    await expect(page.getByRole('radio')).toHaveCount(0)
    await expect(page.getByText('Continue with Google', { exact: true })).toBeVisible()
    await expect(page.getByText('Continue with Microsoft', { exact: true })).toBeVisible()
    const mailboxAuthorization = page.locator('#mailboxAuthorizationAccepted')
    const googleRegistration = page.getByText('Continue with Google', { exact: true })
    const microsoftRegistration = page.getByText('Continue with Microsoft', { exact: true })
    await expect(mailboxAuthorization).not.toBeChecked()
    await expect(googleRegistration).toHaveAttribute('aria-disabled', 'true')
    await expect(microsoftRegistration).toHaveAttribute('aria-disabled', 'true')
    await expect(googleRegistration).toHaveAttribute(
      'href',
      '/auth/google?flow=registration&accountType=consumer'
    )
    await expect(microsoftRegistration).toHaveAttribute(
      'href',
      '/auth/microsoft?flow=registration&accountType=consumer'
    )
    await mailboxAuthorization.check()
    await expect(googleRegistration).not.toHaveAttribute('aria-disabled', 'true')
    await expect(microsoftRegistration).not.toHaveAttribute('aria-disabled', 'true')
    await expect(googleRegistration).toHaveAttribute(
      'href',
      '/auth/google?flow=registration&accountType=consumer&emailTermsAccepted=1'
    )
    await expect(microsoftRegistration).toHaveAttribute(
      'href',
      '/auth/microsoft?flow=registration&accountType=consumer&emailTermsAccepted=1'
    )
    const proRegistration = page.getByRole('link', { name: 'Register as a Pro', exact: true })
    await expect(proRegistration).toHaveAttribute('href', '/register?accountType=vendor')
    await proRegistration.click()

    await expect(page).toHaveURL(/\/register\?accountType=vendor$/)
    await expect(page.getByRole('heading', { name: 'Create your Pro account' })).toBeVisible()
    await expect(page.getByText('Continue with Google', { exact: true })).toHaveAttribute(
      'data-account-type',
      'vendor'
    )
    const consumerRegistration = page.getByRole('link', {
      name: 'Register as a Consumer',
      exact: true,
    })
    await expect(consumerRegistration).toHaveAttribute('href', '/register?accountType=consumer')
    await consumerRegistration.click()
    await expect(page).toHaveURL(/\/register\?accountType=consumer$/)
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  })

  test('preserves the onboarding token through password registration and consent', async ({
    page,
  }) => {
    await page.addInitScript(
      (token) => localStorage.setItem('envoy_onboarding_token', token),
      ONBOARDING_TOKEN
    )
    await mockRegisterPage(page)
    await mockConsentPage(page)
    await mockInertiaPage(page, '/onboarding/project', 'onboarding/project', activeProjectProps)

    let registrationBody: Record<string, unknown> | undefined
    let consentBody: Record<string, unknown> | undefined
    await page.route('/register', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      registrationBody = route.request().postDataJSON()
      await redirectInertia(route, '/onboarding/consent')
    })
    await page.route('/onboarding/consent', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      consentBody = route.request().postDataJSON()
      await redirectInertia(route, '/onboarding/project')
    })

    await page.goto('/register')
    await fillPasswordRegistration(page)
    await page.getByRole('button', { name: 'Create account' }).click()

    await page.waitForURL('**/onboarding/consent')
    await expect(page.locator('#termsAccepted')).not.toBeChecked()
    await page.locator('#termsAccepted').check()
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.waitForURL('**/onboarding/project')
    expect(registrationBody).toEqual({
      fullName: 'Jane Consumer',
      email: 'jane@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
      accountType: 'consumer',
      onboardingToken: ONBOARDING_TOKEN,
    })
    expect(consentBody).toEqual({ termsAccepted: true, modelTrainingOptIn: false })
    await expect(page.getByRole('heading', { name: 'Complete your project' })).toBeVisible()
  })

  test('vendor password registration omits the token and routes to pending after consent', async ({
    page,
  }) => {
    await mockRegisterPage(page, 'vendor', '/register?accountType=vendor')
    await mockConsentPage(page)
    await mockInertiaPage(page, '/vendor/pending', 'vendors/pending', {
      vendorName: 'Jane Consumer',
      user: { ...consumerUser, fullName: 'Jane Consumer' },
    })

    let registrationBody: Record<string, unknown> | undefined
    let consentBody: Record<string, unknown> | undefined
    await page.route('**/register?accountType=vendor', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      registrationBody = route.request().postDataJSON()
      await redirectInertia(route, '/onboarding/consent')
    })
    await page.route('/register', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      registrationBody = route.request().postDataJSON()
      await redirectInertia(route, '/onboarding/consent')
    })
    await page.route('/onboarding/consent', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      consentBody = route.request().postDataJSON()
      await redirectInertia(route, '/vendor/pending')
    })

    await page.goto('/register?accountType=vendor')
    await fillPasswordRegistration(page)
    await page.getByRole('button', { name: 'Create account' }).click()

    await page.waitForURL('**/onboarding/consent')
    await page.locator('#termsAccepted').check()
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.waitForURL('**/vendor/pending')
    expect(registrationBody).toMatchObject({ accountType: 'vendor' })
    expect(registrationBody).not.toHaveProperty('onboardingToken')
    expect(consentBody).toEqual({ termsAccepted: true, modelTrainingOptIn: false })
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
      '**/auth/google?flow=registration&accountType=consumer&emailTermsAccepted=1',
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
    await page.locator('#mailboxAuthorizationAccepted').check()
    await page.getByText('Continue with Google', { exact: true }).click()

    await page.waitForURL(
      '**/auth/google?flow=registration&accountType=consumer&emailTermsAccepted=1'
    )
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
    await page.route('**/auth/google?flow=registration**', async (route) => {
      oauthCalled = true
      await route.abort()
    })

    await page.goto('/register')
    await page.locator('#mailboxAuthorizationAccepted').check()
    await page.getByText('Continue with Google', { exact: true }).click()

    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByRole('alert')).toContainText(/try again|could not/i)
    expect(oauthCalled).toBe(false)
  })
})

test.describe('first project completion', () => {
  test('prefills the intake fields without rendering a selected-vendor review', async ({
    page,
  }) => {
    await mockInertiaPage(page, '/onboarding/project', 'onboarding/project', activeProjectProps)
    await page.goto('/onboarding/project')

    await expect(page.getByRole('heading', { name: 'Complete your project' })).toBeVisible()
    await expect(page.getByLabel('Description')).toHaveValue(
      'I need to renovate a small restaurant space before opening.'
    )
    await expect(page.getByPlaceholder('Search city or address…')).toHaveValue('23220')
    await expect(page.getByText('Vendors you selected')).toHaveCount(0)
    await expect(page.getByText('Richmond Build Co')).toHaveCount(0)
    await expect(page.getByText('Consumer Managed Design')).toHaveCount(0)
    await expect(page.getByText(/No email on file/i)).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
  })

  test('requires missing vendor emails before continuing and submits them with completion', async ({
    page,
  }) => {
    await mockInertiaPage(
      page,
      '/onboarding/project',
      'onboarding/project',
      missingEmailProjectProps
    )
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
    await expect(
      page.getByRole('heading', { name: 'Additional contact details required' })
    ).toBeVisible()
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true })
    await expect(continueButton).toBeDisabled()

    await page.getByLabel('Title').fill('Restaurant Renovation')
    await page.getByLabel('Email for Consumer Managed Design').fill('design@example.com')
    await expect(continueButton).toBeEnabled()
    await continueButton.click()
    await page.getByRole('button', { name: /Skip & create/i }).click()

    await page.waitForURL(`**/projects/${PROJECT_UUID}`)
    expect(completionBody).toMatchObject({
      selectedVendorListingUuids: selectedVendors.map((vendor) => vendor.vendorListingUuid),
      vendorEmailUpdates: [
        {
          vendorListingUuid: selectedVendors[1].vendorListingUuid,
          email: 'design@example.com',
        },
      ],
    })
  })

  test('warns before removing the only selected vendor without contact details', async ({
    page,
  }) => {
    await mockInertiaPage(page, '/onboarding/project', 'onboarding/project', {
      ...activeProjectProps,
      selectedVendors: [{ ...selectedVendors[1], hasEmail: false }],
      selectedVendorListingUuids: [selectedVendors[1].vendorListingUuid],
    })

    await page.goto('/onboarding/project')
    await page.getByRole('button', { name: 'Remove' }).click()

    await expect(page.getByRole('alert')).toContainText(
      'At least one selection needs contact details. Add an email before removing.'
    )
    await expect(page.getByLabel('Email for Consumer Managed Design')).toBeVisible()
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
    await expect(page.getByRole('link', { name: 'Start a new search' })).toHaveAttribute(
      'href',
      '/'
    )
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
