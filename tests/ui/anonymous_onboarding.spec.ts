import { expect, test, type Page } from '@playwright/test'

const ONBOARDING_TOKEN = '7d9b5f0a-79b9-4b73-8b25-79677e31c2c5'
const PROJECT_DESCRIPTION = 'Renovate a neighborhood restaurant dining room before opening.'

type VendorRecommendation = {
  vendorListingUuid: string
  name: string
  categories: string[]
  location: {
    address?: string
    locality?: string
    region?: string
    postcode?: string
    country?: string
    formatted_address?: string
  } | null
  hasEmail: boolean
  onboardedToEnvoy: boolean
  consumerOwned: boolean
  ownershipWarning: string | null
}

const recommendations: VendorRecommendation[] = [
  {
    vendorListingUuid: '11111111-1111-4111-8111-111111111111',
    name: 'Email First Electric',
    categories: ['Electrician', 'Commercial Contractor'],
    location: {
      address: '456 Broad St',
      locality: 'Richmond',
      region: 'VA',
      postcode: '23220',
      country: 'US',
      formatted_address: '456 Broad St, Richmond, VA 23220',
    },
    hasEmail: true,
    onboardedToEnvoy: true,
    consumerOwned: false,
    ownershipWarning: null,
  },
  {
    vendorListingUuid: '22222222-2222-4222-8222-222222222222',
    name: 'Unverified Build Co',
    categories: ['General Contractor'],
    location: {
      locality: 'Richmond',
      region: 'VA',
      postcode: '23220',
    },
    hasEmail: true,
    onboardedToEnvoy: false,
    consumerOwned: true,
    ownershipWarning: 'This listing is consumer-managed and has not been verified by the vendor.',
  },
  {
    vendorListingUuid: '33333333-3333-4333-8333-333333333333',
    name: 'No Email Plumbing',
    categories: ['Plumber'],
    location: null,
    hasEmail: false,
    onboardedToEnvoy: false,
    consumerOwned: false,
    ownershipWarning: null,
  },
]

async function setStoredDraft(page: Page, seen = true) {
  await page.addInitScript(
    ({ token, hasSeen }) => {
      localStorage.setItem('envoy_onboarding_token', token)
      if (hasSeen) localStorage.setItem('envoy_seen', 'true')
    },
    { token: ONBOARDING_TOKEN, hasSeen: seen }
  )
}

async function mockSearch(page: Page, vendors: VendorRecommendation[] = recommendations) {
  let releaseSearch: (() => void) | undefined
  const held = new Promise<void>((resolve) => {
    releaseSearch = resolve
  })

  await page.route('/onboarding/vendor-search', async (route) => {
    await held
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        onboardingToken: ONBOARDING_TOKEN,
        draftUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        vendorSearches: [],
        vendors,
        ...(vendors.length === 0 ? { emptyStateReason: 'NO_VENDOR_RESULTS' } : {}),
        expiresAt: '2026-07-14T12:00:00.000Z',
      }),
    })
  })

  await page.goto('/')
  await page.getByLabel('What are you planning?').fill(PROJECT_DESCRIPTION)
  await page.getByLabel(/ZIP or postal code/i).fill('23220')

  return {
    release: () => releaseSearch?.(),
    submit: () => page.getByRole('button', { name: 'Search' }).click(),
  }
}

async function completeSearch(page: Page, vendors: VendorRecommendation[] = recommendations) {
  const search = await mockSearch(page, vendors)
  await search.submit()
  search.release()
  await expect(page.getByRole('heading', { name: 'Contacts for your project' })).toBeVisible()
}

test.describe('anonymous vendor discovery', () => {
  test('shows the intake on a first visit without creating browser state', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Plan any project')
    await expect(page.getByLabel('What are you planning?')).toBeVisible()
    await expect(page.getByLabel(/ZIP or postal code/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Join Envoy as a pro/i })).toHaveAttribute(
      'href',
      '/register?accountType=vendor'
    )

    await expect
      .poll(() =>
        page.evaluate(() => ({
          token: localStorage.getItem('envoy_onboarding_token'),
          seen: localStorage.getItem('envoy_seen'),
        }))
      )
      .toEqual({ token: null, seen: null })
  })

  test('validates the description length and postal code accessibly', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('What are you planning?').fill('Nope')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByText(/at least 5 characters/i)).toBeVisible()
    await expect(page.getByText(/postal code is required/i)).toBeVisible()
    await expect(page.getByLabel('What are you planning?')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel(/ZIP or postal code/i)).toHaveAttribute('aria-invalid', 'true')
  })

  test('uses the specified request contract and marks the browser seen only after success', async ({
    page,
  }) => {
    let requestBody: unknown
    const search = await mockSearch(page)
    page.on('request', (request) => {
      if (request.url().endsWith('/onboarding/vendor-search')) requestBody = request.postDataJSON()
    })

    await search.submit()
    await expect(page.getByRole('button', { name: /Searching/i })).toBeDisabled()
    expect(await page.evaluate(() => localStorage.getItem('envoy_seen'))).toBeNull()

    search.release()
    await expect(page.getByRole('button', { name: /Email First Electric/i })).toBeVisible()

    expect(requestBody).toEqual({
      projectDescription: PROJECT_DESCRIPTION,
      postalCode: '23220',
    })
    await expect
      .poll(() =>
        page.evaluate(() => ({
          token: localStorage.getItem('envoy_onboarding_token'),
          seen: localStorage.getItem('envoy_seen'),
        }))
      )
      .toEqual({ token: ONBOARDING_TOKEN, seen: 'true' })
  })

  test('shows an empty state and prevents registration when no vendors are found', async ({
    page,
  }) => {
    const search = await mockSearch(page, [])
    await search.submit()
    search.release()

    await expect(page.getByText('No matches found for your search.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Continue with/i })).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('envoy_seen'))).toBe('true')
  })

  test('renders server priority order, status flags, locations, and no contact fields', async ({
    page,
  }) => {
    await completeSearch(page)

    const cards = page.getByRole('button').filter({ has: page.locator('[aria-pressed]') })
    const names = await page
      .locator(
        'section[aria-label="Recommendations"] section[data-vendor-classification] li button'
      )
      .allTextContents()
    expect(names[0]).toContain('Email First Electric')
    expect(names[2]).toContain('No Email Plumbing')
    const groups = page.locator(
      'section[aria-label="Recommendations"] section[data-vendor-classification]'
    )
    await expect(groups).toHaveCount(3)
    expect(
      await groups.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-vendor-classification'))
      )
    ).toEqual(['Electrician', 'General Contractor', 'Plumber'])
    await expect(
      page
        .getByRole('button', { name: /Email First Electric/i })
        .getByText('456 Broad St, Richmond, VA 23220')
    ).toBeVisible()
    await expect(page.getByText('Onboarded to Envoy')).toBeVisible()
    await expect(page.getByText(/Unverified listing/i)).toBeVisible()
    await expect(page.getByText('Additional contact details required')).toHaveCount(2)
    await expect(page.getByText('Electrician · Commercial Contractor')).toBeVisible()
    await expect(page.getByText(/@example\.com|555-0100|https:\/\//)).toHaveCount(0)
    expect(await cards.count()).toBeGreaterThanOrEqual(0)
  })

  test('selects vendors without email and persists UUIDs with the canonical token field', async ({
    page,
  }) => {
    let selectionBody: Record<string, unknown> | undefined
    await page.route('/onboarding/vendor-selection', async (route) => {
      selectionBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ selectedCount: 1, expiresAt: '2026-07-14T12:00:00.000Z' }),
      })
    })
    await completeSearch(page, recommendations)

    const noEmailVendor = page.getByRole('button', { name: /No Email Plumbing/i })
    await page.getByRole('button', { name: 'Deselect all' }).click()
    await noEmailVendor.click()

    await expect(noEmailVendor).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: 'Continue with 1 contact', exact: true })
    ).toBeEnabled()
    await expect
      .poll(() => selectionBody)
      .toEqual({
        onboardingToken: ONBOARDING_TOKEN,
        selectedVendorListingUuids: [recommendations[2].vendorListingUuid],
      })
  })

  test('caps a malformed oversized recommendation response at eight selectable results', async ({
    page,
  }) => {
    const vendors = Array.from({ length: 9 }, (_, index) => ({
      ...recommendations[0],
      vendorListingUuid: `0000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
      name: `Vendor ${index + 1}`,
      onboardedToEnvoy: false,
    }))
    await page.route('/onboarding/vendor-selection', async (route) => {
      const body = route.request().postDataJSON() as { selectedVendorListingUuids: string[] }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ selectedCount: body.selectedVendorListingUuids.length }),
      })
    })
    await completeSearch(page, vendors)

    await expect(page.getByRole('button', { name: /Vendor 9/i })).toHaveCount(0)
    for (let index = 1; index <= 8; index += 1) {
      const card = page.getByRole('button', { name: new RegExp(`Vendor ${index}`) })
      await expect(card).toHaveAttribute('aria-pressed', 'true')
    }
    await expect(page.getByText('8 of 8 selected')).toBeVisible()
  })

  test('persists the final selection before handing off and never puts the token in the URL', async ({
    page,
  }) => {
    const calls: Array<{ path: string; body: unknown }> = []
    await page.route('/onboarding/vendor-selection', async (route) => {
      calls.push({ path: '/onboarding/vendor-selection', body: route.request().postDataJSON() })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"selectedCount":1}',
      })
    })
    await page.route('/onboarding/registration-handoff', async (route) => {
      calls.push({ path: '/onboarding/registration-handoff', body: route.request().postDataJSON() })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"redirectTo":"/register?accountType=consumer"}',
      })
    })
    await page.route('**/register?accountType=consumer', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Register</h1>' })
    )
    await completeSearch(page, recommendations)

    await page.getByRole('button', { name: 'Continue with 3 contacts', exact: true }).click()

    await page.waitForURL('**/register?accountType=consumer')
    expect(calls.map((call) => call.path)).toEqual([
      '/onboarding/vendor-selection',
      '/onboarding/registration-handoff',
    ])
    expect(calls.at(-1)?.body).toEqual({ onboardingToken: ONBOARDING_TOKEN })
    expect(page.url()).not.toContain(ONBOARDING_TOKEN)
  })

  test('does not leave the intake when the registration handoff fails', async ({ page }) => {
    await page.route('/onboarding/vendor-selection', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"selectedCount":1}' })
    )
    await page.route('/onboarding/registration-handoff', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"failed"}' })
    )
    await completeSearch(page, recommendations)

    await page.getByRole('button', { name: 'Continue with 3 contacts', exact: true }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('alert')).toContainText(/try again|could not/i)
  })
})

test.describe('anonymous draft recovery', () => {
  test('restores a valid draft and its selected vendor', async ({ page }) => {
    await setStoredDraft(page)
    let restoreBody: unknown
    await page.route('/onboarding/draft/restore', async (route) => {
      restoreBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          draftUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          projectDescription: PROJECT_DESCRIPTION,
          postalCode: '23220',
          vendorSearches: [],
          vendors: recommendations,
          selectedVendorListingUuids: [recommendations[1].vendorListingUuid],
          step: 'selection',
          expiresAt: '2026-07-14T12:00:00.000Z',
        }),
      })
    })

    await page.goto('/')

    await expect(page.getByLabel('What are you planning?')).toHaveValue(PROJECT_DESCRIPTION)
    await expect(page.getByLabel(/ZIP or postal code/i)).toHaveValue('23220')
    await expect(page.getByRole('button', { name: /Unverified Build Co/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(restoreBody).toEqual({ onboardingToken: ONBOARDING_TOKEN })
  })

  test('clears stale or expired state and returns to a blank intake', async ({ page }) => {
    await setStoredDraft(page)
    await page.route('/onboarding/draft/restore', (route) =>
      route.fulfill({ status: 410, contentType: 'application/json', body: '{"error":"expired"}' })
    )

    await page.goto('/')
    await expect(page.getByLabel('What are you planning?')).toHaveValue('')
    await expect(page).toHaveURL(/\/$/)
    await expect
      .poll(() =>
        page.evaluate(() => ({
          token: localStorage.getItem('envoy_onboarding_token'),
          seen: localStorage.getItem('envoy_seen'),
        }))
      )
      .toEqual({ token: null, seen: null })
  })

  test('keeps a valid token and retries a transient restore network failure', async ({ page }) => {
    await setStoredDraft(page)
    let attempts = 0
    await page.route('/onboarding/draft/restore', async (route) => {
      attempts += 1
      if (attempts === 1) {
        await route.abort('failed')
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          draftUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          projectDescription: PROJECT_DESCRIPTION,
          postalCode: '23220',
          vendorSearches: [],
          vendors: recommendations,
          selectedVendorListingUuids: [],
          step: 'recommendations',
          expiresAt: '2026-07-14T12:00:00.000Z',
        }),
      })
    })

    await page.goto('/')

    await expect(page.getByText(/could not restore/i)).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('envoy_onboarding_token'))).toBe(
      ONBOARDING_TOKEN
    )
    expect(await page.evaluate(() => localStorage.getItem('envoy_seen'))).toBe('true')

    await page.getByRole('button', { name: 'Retry restore' }).click()
    await expect(page.getByText('Email First Electric')).toBeVisible()
    expect(attempts).toBe(2)
  })
})

test('the intake remains usable without horizontal overflow on a mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')

  await expect(page.getByLabel('What are you planning?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
  const dimensions = await page.evaluate(() => ({
    scrollWidth: (globalThis as any).document.documentElement.scrollWidth,
    clientWidth: (globalThis as any).document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
})
