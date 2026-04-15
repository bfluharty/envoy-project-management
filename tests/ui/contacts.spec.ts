import { test, expect } from '@playwright/test'
import { login, goToProject, PROJECT_ALPHA_UUID } from './helpers.js'

// Acme Corp — Alice's seeded contact
const ACME_UUID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f'

async function goToContacts(page: import('@playwright/test').Page) {
  await page.goto('/contacts')
  await page.waitForLoadState('networkidle')
}

async function ensureContactForInlineEdit(page: import('@playwright/test').Page) {
  if ((await page.getByRole('button', { name: 'Edit' }).count()) > 0) return

  const newUuid = 'inline-edit-seed-0000-0000-000000000001'
  await page.route('/contacts', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          contact: { uuid: newUuid, name: 'Inline Contact', email: 'inline@example.com' },
        }),
      })
    } else {
      await route.continue()
    }
  })

  await page.getByPlaceholder('Name').last().fill('Inline Contact')
  await page.getByPlaceholder('Email').last().fill('inline@example.com')
  await page.getByRole('button', { name: 'Add Contact' }).click()
  await expect(page.getByText('Inline Contact')).toBeVisible()
}

// ── Navigation ────────────────────────────────────────────────────────────────

test('sidebar has a Contacts link that navigates to /contacts', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Contacts' }).click()
  await page.waitForURL('**/contacts')
  await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible()
})

// ── Page load ─────────────────────────────────────────────────────────────────

test.describe('contacts page load', () => {
  test('shows seeded contact for Alice', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await expect(page.getByText('Acme Corp')).toBeVisible()
    await expect(page.getByText('contact@acme.com')).toBeVisible()
  })

  test('shows Add Contact form', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await expect(page.getByRole('heading', { name: 'Add Contact' })).toBeVisible()
    await expect(page.getByPlaceholder('Name')).toBeVisible()
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Contact' })).toBeVisible()
  })
})

// ── Add contact ───────────────────────────────────────────────────────────────

test.describe('add contact', () => {
  test('new contact appears in list after successful submit', async ({ page }) => {
    await login(page)
    await goToContacts(page)

    const newUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    await page.route('/contacts', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            contact: { uuid: newUuid, name: 'Bob Smith', email: 'bob@example.com' },
          }),
        })
      } else {
        await route.continue()
      }
    })

    // Use last() because there are two Name/Email inputs (list edit + add form)
    await page.getByPlaceholder('Name').last().fill('Bob Smith')
    await page.getByPlaceholder('Email').last().fill('bob@example.com')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('Bob Smith')).toBeVisible()
    await expect(page.getByText('bob@example.com')).toBeVisible()
  })

  test('form clears after successful submit', async ({ page }) => {
    await login(page)
    await goToContacts(page)

    await page.route('/contacts', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            contact: { uuid: 'new-uuid-1234', name: 'Alice Two', email: 'alice2@example.com' },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByPlaceholder('Name').last().fill('Alice Two')
    await page.getByPlaceholder('Email').last().fill('alice2@example.com')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('Alice Two')).toBeVisible()
    await expect(page.getByPlaceholder('Name').last()).toHaveValue('')
    await expect(page.getByPlaceholder('Email').last()).toHaveValue('')
  })

  test('submit button is disabled while request is in-flight', async ({ page }) => {
    await login(page)
    await goToContacts(page)

    let resolveRequest: () => void
    const requestHeld = new Promise<void>((resolve) => {
      resolveRequest = resolve
    })

    await page.route('/contacts', async (route) => {
      if (route.request().method() === 'POST') {
        await requestHeld
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            contact: { uuid: 'in-flight-uuid', name: 'In Flight', email: 'flight@example.com' },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByPlaceholder('Name').last().fill('In Flight')
    await page.getByPlaceholder('Email').last().fill('flight@example.com')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByRole('button', { name: /Adding/ })).toBeDisabled()

    resolveRequest!()
    await expect(page.getByText('In Flight')).toBeVisible()
  })
})

// ── Add contact validation ─────────────────────────────────────────────────────

test.describe('add contact validation', () => {
  test('shows error when name is empty', async ({ page }) => {
    await login(page)
    await goToContacts(page)

    await page.getByPlaceholder('Email').last().fill('valid@example.com')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('Name is required.')).toBeVisible()
  })

  test('shows error when email is empty', async ({ page }) => {
    await login(page)
    await goToContacts(page)

    await page.getByPlaceholder('Name').last().fill('Valid Name')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('Email is required.')).toBeVisible()
  })

  test('shows error for invalid email format', async ({ page }) => {
    await login(page)
    await goToContacts(page)

    await page.getByPlaceholder('Name').last().fill('Valid Name')
    await page.getByPlaceholder('Email').last().fill('not-an-email')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('Must be a valid email address.')).toBeVisible()
  })
})

// ── Inline edit ───────────────────────────────────────────────────────────────

test.describe('inline edit', () => {
  test('Edit button shows editable fields', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await ensureContactForInlineEdit(page)

    await page.getByRole('button', { name: 'Edit' }).first().click()

    await expect(page.getByPlaceholder('Name').first()).toBeVisible()
    await expect(page.getByPlaceholder('Email').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('Cancel returns to read mode without changes', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await ensureContactForInlineEdit(page)

    await page.getByRole('button', { name: 'Edit' }).first().click()
    await page.getByPlaceholder('Name').first().fill('Changed Name')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByText('Acme Corp')).toBeVisible()
    await expect(page.getByText('Changed Name')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).not.toBeVisible()
  })

  test('Save updates name and email in list', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await ensureContactForInlineEdit(page)

    await page.route(`/contacts/${ACME_UUID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            contact: { uuid: ACME_UUID, name: 'Acme Corp Renamed', email: 'new@acme.com' },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByRole('button', { name: 'Edit' }).first().click()
    await page.getByPlaceholder('Name').first().fill('Acme Corp Renamed')
    await page.getByPlaceholder('Email').first().fill('new@acme.com')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Acme Corp Renamed')).toBeVisible()
    await expect(page.getByText('new@acme.com')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).not.toBeVisible()
  })

  test('Save shows field error when name is cleared', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await ensureContactForInlineEdit(page)

    await page.getByRole('button', { name: 'Edit' }).first().click()
    await page.getByPlaceholder('Name').first().fill('')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Name is required.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  })
})

// ── Deactivate ────────────────────────────────────────────────────────────────

test.describe('deactivate contact', () => {
  test('Remove button removes contact from list', async ({ page }) => {
    await login(page)
    await goToContacts(page)

    const beforeCount = await page.getByRole('button', { name: 'Remove' }).count()
    expect(beforeCount).toBeGreaterThan(0)

    await page.route(`/contacts/${ACME_UUID}`, async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByRole('button', { name: 'Remove' }).first().click()

    await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(beforeCount - 1)
  })
})

// ── Add contact from project overview ─────────────────────────────────────────

test.describe('add contact from project overview', () => {
  test('+ New contact button opens inline form', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    await page.getByRole('button', { name: '+ New contact' }).click()

    await expect(page.getByRole('button', { name: 'Add & Attach' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' }).last()).toBeVisible()
  })

  test('Cancel hides the new contact form', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    await page.getByRole('button', { name: '+ New contact' }).click()
    await page.getByRole('button', { name: 'Cancel' }).last().click()

    await expect(page.getByRole('button', { name: 'Add & Attach' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: '+ New contact' })).toBeVisible()
  })

  test('new contact is created and linked to project', async ({ page }) => {
    await login(page)
    await goToProject(page, PROJECT_ALPHA_UUID)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    const newUuid = 'cccccccc-dddd-eeee-ffff-000000000000'

    await page.route('/contacts', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            contact: { uuid: newUuid, name: 'New Vendor', email: 'vendor@new.com' },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            project: { uuid: PROJECT_ALPHA_UUID },
            linkedVendors: [
              { uuid: ACME_UUID, name: 'Acme Corp', email: 'contact@acme.com' },
              { uuid: newUuid, name: 'New Vendor', email: 'vendor@new.com' },
            ],
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByRole('button', { name: '+ New contact' }).click()
    // There are multiple Name/Email placeholders in the page; target the form specifically
    const newContactForm = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Add & Attach' }) })
    await newContactForm.getByPlaceholder('Name').fill('New Vendor')
    await newContactForm.getByPlaceholder('Email').fill('vendor@new.com')
    await page.getByRole('button', { name: 'Add & Attach' }).click()

    await expect(page.getByText('New Vendor')).toBeVisible()
    await expect(page.getByText('vendor@new.com')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add & Attach' })).not.toBeVisible()
  })

  test('shows field errors when name or email is blank', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })

    await page.getByRole('button', { name: '+ New contact' }).click()
    await page.getByRole('button', { name: 'Add & Attach' }).click()

    await expect(page.getByText('Name is required.')).toBeVisible()
    await expect(page.getByText('Email is required.')).toBeVisible()
  })
})
