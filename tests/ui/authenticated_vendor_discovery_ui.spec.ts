import { expect, test } from '@playwright/test'
import { mockInertiaPage } from './inertia_fixture.js'

const PROJECT_UUID = '99999999-9999-4999-8999-999999999999'
const LISTING_UUID = '11111111-1111-4111-8111-111111111111'

const user = {
  uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  fullName: 'Jane Consumer',
  email: 'jane@example.com',
  avatar: null,
}

const vendorResult = {
  vendorListingUuid: LISTING_UUID,
  vendorUuid: null,
  name: 'Richmond Build Co',
  categories: ['Commercial Contractor', 'Construction'],
  location: {
    locality: 'Richmond',
    region: 'VA',
    postcode: '23220',
    formatted_address: '456 Broad St, Richmond, VA 23220',
  },
  hasEmail: true,
  onboardedToEnvoy: true,
  consumerOwned: false,
  inContacts: false,
}

const projectProps = {
  project: {
    uuid: PROJECT_UUID,
    name: 'Restaurant Renovation',
    description: 'Renovate a neighborhood restaurant dining room before opening.',
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
  user,
}

async function openContactsSearch(page: import('@playwright/test').Page) {
  await mockInertiaPage(page, '/contacts', 'contacts/index', { contacts: [], user })
  await page.goto('/contacts')
  await page.getByRole('button', { name: /Find additional contacts/i }).click()
}

async function fillVendorSearch(page: import('@playwright/test').Page) {
  await page
    .getByLabel('What do you need?')
    .fill('Renovate a neighborhood restaurant dining room before opening.')
  await page.getByLabel(/ZIP or postal code/i).fill('23220')
}

test.describe('authenticated vendor search component', () => {
  test('requires a five-character project description', async ({ page }) => {
    await openContactsSearch(page)
    await page.getByLabel('What do you need?').fill('Nope')
    await page.getByLabel(/ZIP or postal code/i).fill('23220')

    await page.getByRole('button', { name: 'Search', exact: true }).click()

    await expect(page.getByText(/at least 5 characters/i)).toBeVisible()
    await expect(page.getByLabel('What do you need?')).toHaveAttribute('aria-invalid', 'true')
  })

  test('searches with session auth, renders marketplace status, and saves a listing to Contacts', async ({
    page,
  }) => {
    let searchBody: unknown
    let searchUserHeader: string | undefined
    let selectUserHeader: string | undefined
    await page.route('/api/vendors/search', async (route) => {
      searchBody = route.request().postDataJSON()
      searchUserHeader = route.request().headers()['x-user-id']
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ vendors: [vendorResult] }),
      })
    })
    await page.route(`/api/vendors/${LISTING_UUID}/select`, async (route) => {
      selectUserHeader = route.request().headers()['x-user-id']
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ vendorUuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
      })
    })
    await openContactsSearch(page)
    await fillVendorSearch(page)

    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByText('Richmond Build Co')).toBeVisible()
    await expect(page.getByText('Onboarded to Envoy')).toBeVisible()
    await expect(page.getByText('456 Broad St, Richmond, VA 23220')).toBeVisible()
    await expect(
      page
        .locator('section[aria-label="Search results"]')
        .getByText(/jane@example\.com|555-0100|https:\/\//)
    ).toHaveCount(0)

    await page.getByRole('button', { name: 'Save to Contacts' }).click()
    await expect(page.getByText('Saved to Contacts')).toBeVisible()
    expect(searchBody).toEqual({
      projectDescription: 'Renovate a neighborhood restaurant dining room before opening.',
      postalCode: '23220',
    })
    expect(searchUserHeader).toBeUndefined()
    expect(selectUserHeader).toBeUndefined()
  })

  test('distinguishes an ambiguous description from a valid search with no matches', async ({
    page,
  }) => {
    let searchAttempt = 0
    await page.route('/api/vendors/search', (route) => {
      searchAttempt += 1
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          vendors: [],
          vendorSearches:
            searchAttempt === 1
              ? []
              : [{ classification: 'Electrician', query: 'commercial electrician' }],
        }),
      })
    })
    await openContactsSearch(page)
    await fillVendorSearch(page)

    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByText('Tell us what kind of help you need')).toBeVisible()
    await expect(page.getByText('No matches found', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Search again', exact: true }).click()
    await expect(page.getByText('No matches found', { exact: true })).toBeVisible()
    await expect(page.getByText('Tell us what kind of help you need')).toHaveCount(0)
  })

  test('groups ranked results by primary Foursquare classification without reordering them', async ({
    page,
  }) => {
    const rankedVendors = [
      {
        ...vendorResult,
        vendorListingUuid: '10000000-0000-4000-8000-000000000001',
        name: 'First Ranked Builder',
      },
      {
        ...vendorResult,
        vendorListingUuid: '20000000-0000-4000-8000-000000000002',
        name: 'Second Ranked Electrician',
        categories: ['Electrician'],
      },
      {
        ...vendorResult,
        vendorListingUuid: '30000000-0000-4000-8000-000000000003',
        name: 'Third Ranked Builder',
      },
      {
        ...vendorResult,
        vendorListingUuid: '40000000-0000-4000-8000-000000000004',
        name: 'Fourth Ranked Vendor',
        categories: [],
      },
    ]
    await page.route('/api/vendors/search', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ vendors: rankedVendors }),
      })
    )
    await openContactsSearch(page)
    await fillVendorSearch(page)
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    const groups = page.locator(
      'section[aria-label="Search results"] section[data-vendor-classification]'
    )
    await expect(groups).toHaveCount(3)

    const renderedGroups = await groups.evaluateAll((nodes) =>
      nodes.map((node) => ({
        classification: node.getAttribute('data-vendor-classification'),
        vendors: [...node.querySelectorAll('li')].map((item) => item.textContent ?? ''),
      }))
    )
    expect(renderedGroups.map((group) => group.classification)).toEqual([
      'Commercial Contractor',
      'Electrician',
      'Other contacts',
    ])
    expect(renderedGroups[0].vendors[0]).toContain('First Ranked Builder')
    expect(renderedGroups[0].vendors[1]).toContain('Third Ranked Builder')
    expect(renderedGroups[1].vendors[0]).toContain('Second Ranked Electrician')
    expect(renderedGroups[2].vendors[0]).toContain('Fourth Ranked Vendor')
  })

  test('offers a working retry after a transient authenticated search failure', async ({
    page,
  }) => {
    let attempts = 0
    await page.route('/api/vendors/search', async (route) => {
      attempts += 1
      if (attempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"Vendor search is temporarily unavailable."}',
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ vendors: [vendorResult] }),
      })
    })
    await openContactsSearch(page)
    await fillVendorSearch(page)

    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(/temporarily unavailable/i)
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByText('Richmond Build Co')).toBeVisible()
    expect(attempts).toBe(2)
  })

  test('selects with the keyboard and attaches canonical listing UUIDs to a project', async ({
    page,
  }) => {
    let attachBody: unknown
    let attachUserHeader: string | undefined
    await mockInertiaPage(page, `/projects/${PROJECT_UUID}`, 'projects/project', projectProps)
    await page.route('/api/vendors/search', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ vendors: [vendorResult] }),
      })
    )
    await page.route(`/api/projects/${PROJECT_UUID}/vendors`, async (route) => {
      attachBody = route.request().postDataJSON()
      attachUserHeader = route.request().headers()['x-user-id']
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ attachedCount: 1, vendorListingUuids: [LISTING_UUID] }),
      })
    })

    await page.goto(`/projects/${PROJECT_UUID}`)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })
    const contactsHeading = page.getByRole('heading', { name: 'Contacts' })
    await contactsHeading.locator('..').getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: /Find new contacts/i }).click()
    await fillVendorSearch(page)
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    const result = page.getByRole('checkbox', { name: /Richmond Build Co/i })
    await expect(result).toHaveAttribute('aria-checked', 'true')
    await result.focus()
    await expect(result).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(result).toHaveAttribute('aria-checked', 'false')
    await page.keyboard.press('Enter')
    await expect(result).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: /Add 1 contact to project/i }).click()

    await expect.poll(() => attachBody).toEqual({ vendorListingUuids: [LISTING_UUID] })
    expect(attachUserHeader).toBeUndefined()
  })
})

test.describe('trusted alternatives during manual contact creation', () => {
  test('offers a trusted listing without forcing reuse and can save that listing', async ({
    page,
  }) => {
    let trustedHeader: string | undefined
    let selected = false
    await mockInertiaPage(page, '/contacts', 'contacts/index', { contacts: [], user })
    await page.route('**/api/vendors/trusted-matches?**', async (route) => {
      trustedHeader = route.request().headers()['x-user-id']
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ vendors: [vendorResult] }),
      })
    })
    await page.route(`/api/vendors/${LISTING_UUID}/select`, async (route) => {
      selected = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await page.goto('/contacts')
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: '+ New contact' }).click()
    await page.getByLabel('Name').fill('Richmond Build Co')
    await page.getByLabel('Email').fill('hello@richmondbuild.example')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    const alternatives = page.getByLabel('Existing trusted listings')
    await expect(alternatives).toContainText('A trusted listing may already exist')
    await expect(alternatives.getByRole('button', { name: 'Use listing' })).toBeVisible()
    await expect(
      alternatives.getByRole('button', { name: 'Create separate contact' })
    ).toBeVisible()
    await alternatives.getByRole('button', { name: 'Use listing' }).click()

    await expect(page.getByText('Richmond Build Co')).toBeVisible()
    expect(selected).toBe(true)
    expect(trustedHeader).toBeUndefined()
  })

  test('allows a separate consumer-owned contact after suggesting a trusted listing', async ({
    page,
  }) => {
    let createdBody: unknown
    await mockInertiaPage(page, '/contacts', 'contacts/index', { contacts: [], user })
    await page.route('**/api/vendors/trusted-matches?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ vendors: [vendorResult] }),
      })
    )
    await page.route('/contacts', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      createdBody = route.request().postDataJSON()
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          contact: {
            uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            name: 'My Richmond Builder',
            email: 'mine@example.com',
          },
        }),
      })
    })

    await page.goto('/contacts')
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: '+ New contact' }).click()
    await page.getByLabel('Name').fill('My Richmond Builder')
    await page.getByLabel('Email').fill('mine@example.com')
    await page.getByRole('button', { name: 'Add Contact' }).click()
    await page
      .getByLabel('Existing trusted listings')
      .getByRole('button', { name: 'Create separate contact' })
      .click()

    await expect(page.getByText('My Richmond Builder')).toBeVisible()
    expect(createdBody).toEqual({ name: 'My Richmond Builder', email: 'mine@example.com' })
  })
})
