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
  await page.getByRole('button', { name: /Find vendors/i }).click()
}

async function fillVendorSearch(page: import('@playwright/test').Page) {
  await page
    .getByLabel('What do you need?')
    .fill('Renovate a neighborhood restaurant dining room before opening.')
  await page.getByLabel(/ZIP or postal code/i).fill('23220')
}

test.describe('authenticated vendor search component', () => {
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

    await page.getByRole('button', { name: 'Search vendors' }).click()
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

    await page.getByRole('button', { name: 'Search vendors' }).click()
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
    await page.getByRole('button', { name: /Find vendors/i }).click()
    await fillVendorSearch(page)
    await page.getByRole('button', { name: 'Search vendors' }).click()

    const result = page.getByRole('checkbox', { name: /Richmond Build Co/i })
    await result.focus()
    await page.keyboard.press('Space')
    await expect(result).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: /Add 1 vendor to project/i }).click()

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
