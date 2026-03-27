import { test, expect } from '@playwright/test'
import { login, goToProject, PROJECT_ALPHA_UUID } from './helpers'

// Data Analytics Dashboard — Alice owns it, no linked vendors, Acme Corp available to attach
const NO_VENDOR_PROJECT_UUID = 'b3c4d5e6-f7a8-4b0c-8d2e-3f4a5b6c7d8e'

// Acme Corp — Alice's only vendor
const ACME_UUID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f'

// ── Tab behaviour ──────────────────────────────────────────────────────────────

test.describe('tab behaviour', () => {
  test('project page defaults to convo tab', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await expect(page.getByRole('radio', { name: 'convo' })).toBeVisible()
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Project Details' })).not.toBeVisible()
  })

  test('switching to overview tab shows project details', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })
    await expect(page.getByRole('heading', { name: 'Project Details' })).toBeVisible()
    await expect(page.getByPlaceholder('Type your message...')).not.toBeVisible()
  })

  test('switching to outreach tab shows placeholder', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'outreach' }).click({ force: true })
    await expect(page.getByText('Outreach coming soon.')).toBeVisible()
  })

  test('switching back to convo tab restores chat', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })
    await page.getByRole('radio', { name: 'convo' }).click({ force: true })
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible()
  })
})

// ── Tab bar anchored to top ────────────────────────────────────────────────────

test('tab bar stays at top of viewport when overview content overflows', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 400 })
  await login(page)
  await goToProject(page)
  await page.getByRole('radio', { name: 'overview' }).click({ force: true })

  const radioGroup = page.getByRole('radiogroup')
  const beforeBox = await radioGroup.boundingBox()

  // Focus content area and scroll down
  await page.getByRole('heading', { name: 'Project Details' }).click()
  await page.keyboard.press('PageDown')

  const afterBox = await radioGroup.boundingBox()
  expect(Math.abs((afterBox?.y ?? 0) - (beforeBox?.y ?? 0))).toBeLessThanOrEqual(2)
})

// ── Project details — read mode ───────────────────────────────────────────────

test.describe('overview project details read mode', () => {
  test('shows non-null project fields for Project Alpha', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    // Project Alpha has description, location, dates, budget, goals
    await expect(page.getByText('First project')).toBeVisible()
    await expect(page.getByText('Launch MVP')).toBeVisible()
    await expect(page.getByText('10000')).toBeVisible()
    await expect(page.getByText('2026-01-01')).toBeVisible()
  })

  test('hides null fields — project with all fields populated shows no empty slots', async ({
    page,
  }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    // The "No details added yet." empty state should NOT appear when fields are populated
    await expect(page.getByText('No details added yet.')).not.toBeVisible()
  })

  test('budgetAmount = 0 is hidden', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    // Intercept the PATCH so we don't change DB; respond as if budget was set to 0
    await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            project: {
              uuid: PROJECT_ALPHA_UUID,
              name: 'Project Alpha',
              description: 'First project',
              location: { city: 'New York' },
              startDate: '2026-01-01',
              endDate: '2026-06-01',
              deadline: '2026-05-01',
              budgetAmount: 0,
              goals: 'Launch MVP',
            },
            linkedVendors: [{ uuid: ACME_UUID, name: 'Acme Corp', email: 'contact@acme.com' }],
          }),
        })
      } else {
        await route.continue()
      }
    })

    // Open edit mode, zero out budget, save
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Budget').fill('0')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForFunction(() => !document.querySelector('form'))

    // Budget row should be hidden when value is 0
    const budgetLabel = page.getByText('Budget', { exact: false }).filter({ hasText: 'Budget' })
    await expect(budgetLabel).not.toBeVisible()
  })
})

// ── Overview — edit mode ───────────────────────────────────────────────────────

test.describe('overview edit mode', () => {
  test('edit button opens form, cancel closes without changes', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    const originalDescription = 'First project'

    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByLabel('Description')).toBeVisible()

    await page.getByLabel('Description').fill('changed description')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByLabel('Description')).not.toBeVisible()
    await expect(page.getByText(originalDescription)).toBeVisible()
  })

  test('edit form saves and returns to read mode', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    const updatedDescription = `Updated ${Date.now()}`

    await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            project: {
              uuid: PROJECT_ALPHA_UUID,
              name: 'Project Alpha',
              description: updatedDescription,
              location: { city: 'New York' },
              startDate: '2026-01-01',
              endDate: '2026-06-01',
              deadline: '2026-05-01',
              budgetAmount: 10000,
              goals: 'Launch MVP',
            },
            linkedVendors: [{ uuid: ACME_UUID, name: 'Acme Corp', email: 'contact@acme.com' }],
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Description').fill(updatedDescription)
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByLabel('Description')).not.toBeVisible()
    await expect(page.getByText(updatedDescription)).toBeVisible()
  })

  test('edit form shows server error on 500', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, body: 'Internal Server Error' })
      } else {
        await route.continue()
      }
    })

    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Failed to save. Please try again.')).toBeVisible()
    await expect(page.getByLabel('Description')).toBeVisible()
  })

  test('edit form shows field errors on 422', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ errors: { description: 'Too long' } }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Too long')).toBeVisible()
    await expect(page.getByLabel('Description')).toBeVisible()
  })
})

// ── Contacts section ──────────────────────────────────────────────────────────

test.describe('contacts section', () => {
  test('shows linked vendors for Project Alpha', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    await expect(page.getByText('Acme Corp')).toBeVisible()
    await expect(page.getByText('contact@acme.com')).toBeVisible()
  })

  test('shows empty state message when no vendors linked', async ({ page }) => {
    await login(page)
    await goToProject(page, NO_VENDOR_PROJECT_UUID)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    await expect(
      page.getByText(
        'No contacts yet. Attach contacts here so Envoy can draft outreach emails for them.'
      )
    ).toBeVisible()
  })

  test('attach contact adds to list', async ({ page }) => {
    await login(page)
    await goToProject(page, NO_VENDOR_PROJECT_UUID)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    await page.route(`/projects/${NO_VENDOR_PROJECT_UUID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            project: { uuid: NO_VENDOR_PROJECT_UUID },
            linkedVendors: [{ uuid: ACME_UUID, name: 'Acme Corp', email: 'contact@acme.com' }],
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByRole('combobox').selectOption({ value: ACME_UUID })
    await page.getByRole('button', { name: 'Attach' }).click()

    await expect(page.getByText('Acme Corp')).toBeVisible()
    // After successful attach, no vendor is selected, so attach is disabled.
    await expect(page.getByRole('button', { name: 'Attach' })).toBeDisabled()
  })

  test('detach contact removes from list', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ project: { uuid: PROJECT_ALPHA_UUID }, linkedVendors: [] }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByRole('button', { name: 'Detach' }).click()

    await expect(page.getByText('Acme Corp')).not.toBeVisible()
    await expect(
      page.getByText(
        'No contacts yet. Attach contacts here so Envoy can draft outreach emails for them.'
      )
    ).toBeVisible()
  })

  test('attach button is disabled while request is in-flight', async ({ page }) => {
    await login(page)
    await goToProject(page, NO_VENDOR_PROJECT_UUID)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    let resolveRequest: () => void
    const requestHeld = new Promise<void>((resolve) => {
      resolveRequest = resolve
    })

    await page.route(`/projects/${NO_VENDOR_PROJECT_UUID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await requestHeld
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            project: { uuid: NO_VENDOR_PROJECT_UUID },
            linkedVendors: [{ uuid: ACME_UUID, name: 'Acme Corp', email: 'contact@acme.com' }],
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByRole('combobox').selectOption({ value: ACME_UUID })
    await page.getByRole('button', { name: 'Attach' }).click()

    // Button should be disabled while the request is pending
    await expect(page.getByRole('button', { name: /Attaching/ })).toBeDisabled()

    // Unblock the request
    resolveRequest!()
    await expect(page.getByText('Acme Corp')).toBeVisible()
  })
})
