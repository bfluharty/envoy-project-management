import { expect, test, type Page } from '@playwright/test'
import { goToProject, login, PROJECT_ALPHA_UUID } from './helpers.js'

// Acme Corp — Alice's seeded contact
const ACME_UUID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f'

async function goToContacts(page: Page) {
  await page.goto('/contacts')
  await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible()
}

async function mockNoTrustedMatches(page: Page) {
  await page.route('**/api/vendors/trusted-matches?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"vendors":[]}',
    })
  )
}

async function enterContactsEditMode(page: Page) {
  const doneButton = page.getByRole('button', { name: 'Done', exact: true })
  if (await doneButton.isVisible().catch(() => false)) return

  await page
    .getByRole('heading', { name: 'Contacts', exact: true })
    .locator('..')
    .getByRole('button', { name: 'Edit', exact: true })
    .click()
  await expect(doneButton).toBeVisible()
}

async function openContactsNewContactForm(page: Page) {
  await enterContactsEditMode(page)
  await page.getByRole('button', { name: '+ New contact', exact: true }).click()
  await expect(page.locator('#addName')).toBeVisible()
}

function contactRow(page: Page, name = 'Acme Corp') {
  return page
    .locator('li')
    .filter({ has: page.getByText(name, { exact: true }) })
    .first()
}

async function ensureContactForInlineEdit(page: Page) {
  if ((await page.getByText('Acme Corp', { exact: true }).count()) > 0) return

  await mockNoTrustedMatches(page)
  await page.route('/contacts', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        contact: { uuid: ACME_UUID, name: 'Acme Corp', email: 'contact@acme.com' },
      }),
    })
  })

  await openContactsNewContactForm(page)
  await page.locator('#addName').fill('Acme Corp')
  await page.locator('#addEmail').fill('contact@acme.com')
  await page.getByRole('button', { name: 'Add Contact' }).click()
  await expect(page.getByText('Acme Corp', { exact: true })).toBeVisible()
}

async function openProjectNewContactForm(page: Page) {
  await goToProject(page)
  await page.getByRole('radio', { name: 'overview' }).click({ force: true })
  await enterContactsEditMode(page)
  await page.getByRole('button', { name: '+ New contact', exact: true }).click()
  await expect(page.locator('#newContactName')).toBeVisible()
}

test('sidebar has a Contacts link that navigates to /contacts', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Contacts' }).click()
  await page.waitForURL('**/contacts')
  await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible()
})

test.describe('contacts page load', () => {
  test('shows seeded contact for Alice', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await expect(page.getByText('Acme Corp', { exact: true })).toBeVisible()
    await expect(page.getByText('contact@acme.com', { exact: true })).toBeVisible()
  })

  test('reveals the labeled new-contact form from page edit mode', async ({ page }) => {
    await login(page)
    await goToContacts(page)

    await expect(page.getByRole('button', { name: '+ New contact', exact: true })).toHaveCount(0)
    await openContactsNewContactForm(page)

    await expect(page.locator('#addName')).toHaveAccessibleName('Name')
    await expect(page.locator('#addEmail')).toHaveAccessibleName('Email')
    await expect(page.getByRole('button', { name: 'Add Contact' })).toBeVisible()
  })
})

test.describe('add contact', () => {
  test('new contact appears in list after successful submit', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await mockNoTrustedMatches(page)

    const newUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    await page.route('/contacts', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          contact: { uuid: newUuid, name: 'Bob Smith', email: 'bob@example.com' },
        }),
      })
    })

    await openContactsNewContactForm(page)
    await page.locator('#addName').fill('Bob Smith')
    await page.locator('#addEmail').fill('bob@example.com')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('Bob Smith', { exact: true })).toBeVisible()
    await expect(page.getByText('bob@example.com', { exact: true })).toBeVisible()
  })

  test('form resets after successful submit', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await mockNoTrustedMatches(page)

    await page.route('/contacts', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          contact: {
            uuid: 'new-uuid-1234',
            name: 'Alice Two',
            email: 'alice2@example.com',
          },
        }),
      })
    })

    await openContactsNewContactForm(page)
    await page.locator('#addName').fill('Alice Two')
    await page.locator('#addEmail').fill('alice2@example.com')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('Alice Two', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '+ New contact', exact: true }).click()
    await expect(page.locator('#addName')).toHaveValue('')
    await expect(page.locator('#addEmail')).toHaveValue('')
  })

  test('submit button is disabled while request is in flight', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await mockNoTrustedMatches(page)

    let resolveRequest: () => void
    const requestHeld = new Promise<void>((resolve) => {
      resolveRequest = resolve
    })

    await page.route('/contacts', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      await requestHeld
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          contact: { uuid: 'in-flight-uuid', name: 'In Flight', email: 'flight@example.com' },
        }),
      })
    })

    await openContactsNewContactForm(page)
    await page.locator('#addName').fill('In Flight')
    await page.locator('#addEmail').fill('flight@example.com')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByRole('button', { name: /Adding/ })).toBeDisabled()
    resolveRequest!()
    await expect(page.getByText('In Flight', { exact: true })).toBeVisible()
  })
})

test.describe('add contact validation', () => {
  test('shows error when name is empty', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await openContactsNewContactForm(page)

    await page.locator('#addEmail').fill('valid@example.com')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('Name is required.')).toBeVisible()
  })

  test('shows error when email is empty', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await openContactsNewContactForm(page)

    await page.locator('#addName').fill('Valid Name')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('Email is required.')).toBeVisible()
  })

  test('shows error for invalid email format', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await openContactsNewContactForm(page)

    await page.locator('#addName').fill('Valid Name')
    await page.locator('#addEmail').fill('not-an-email')
    await page.getByRole('button', { name: 'Add Contact' }).click()

    await expect(page.getByText('Must be a valid email address.')).toBeVisible()
  })
})

test.describe('inline edit', () => {
  test('row Edit button shows labeled editable fields', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await ensureContactForInlineEdit(page)
    await enterContactsEditMode(page)

    await contactRow(page).getByRole('button', { name: 'Edit', exact: true }).click()

    await expect(page.locator(`#edit-name-${ACME_UUID}`)).toBeVisible()
    await expect(page.locator(`#edit-email-${ACME_UUID}`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('Cancel returns the row to read mode without changes', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await ensureContactForInlineEdit(page)
    await enterContactsEditMode(page)

    await contactRow(page).getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator(`#edit-name-${ACME_UUID}`).fill('Changed Name')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByText('Acme Corp', { exact: true })).toBeVisible()
    await expect(page.getByText('Changed Name', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
  })

  test('Save updates name and email in the row', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await ensureContactForInlineEdit(page)
    await enterContactsEditMode(page)

    await page.route(`/contacts/${ACME_UUID}`, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          contact: { uuid: ACME_UUID, name: 'Acme Corp Renamed', email: 'new@acme.com' },
        }),
      })
    })

    await contactRow(page).getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator(`#edit-name-${ACME_UUID}`).fill('Acme Corp Renamed')
    await page.locator(`#edit-email-${ACME_UUID}`).fill('new@acme.com')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Acme Corp Renamed', { exact: true })).toBeVisible()
    await expect(page.getByText('new@acme.com', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
  })

  test('Save shows a field error when name is cleared', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await ensureContactForInlineEdit(page)
    await enterContactsEditMode(page)

    await contactRow(page).getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator(`#edit-name-${ACME_UUID}`).fill('')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Name is required.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  })
})

test.describe('deactivate contact', () => {
  test('Remove requires confirmation and then removes the contact row', async ({ page }) => {
    await login(page)
    await goToContacts(page)
    await ensureContactForInlineEdit(page)
    await enterContactsEditMode(page)

    let deleteCalled = false
    await page.route(`/contacts/${ACME_UUID}`, async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.fallback()
        return
      }
      deleteCalled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })

    await page.getByRole('button', { name: 'Remove Acme Corp', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Confirm remove Acme Corp', exact: true })
    ).toBeVisible()
    expect(deleteCalled).toBe(false)

    await page.getByRole('button', { name: 'Confirm remove Acme Corp', exact: true }).click()

    await expect(page.getByText('Acme Corp', { exact: true })).toHaveCount(0)
    expect(deleteCalled).toBe(true)
  })
})

test.describe('add contact from project overview', () => {
  test('+ New contact button opens the labeled inline form', async ({ page }) => {
    await login(page)
    await openProjectNewContactForm(page)

    await expect(page.locator('#newContactName')).toHaveAccessibleName('Name')
    await expect(page.locator('#newContactEmail')).toHaveAccessibleName('Email')
    await expect(page.getByRole('button', { name: 'Add & Attach' })).toBeVisible()
  })

  test('Cancel hides the new contact form', async ({ page }) => {
    await login(page)
    await openProjectNewContactForm(page)

    const form = page.locator('#panel-new-contact')
    await form.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('button', { name: 'Add & Attach' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '+ New contact', exact: true })).toBeVisible()
  })

  test('new contact is created and linked to project', async ({ page }) => {
    await login(page)
    await mockNoTrustedMatches(page)

    const newUuid = 'cccccccc-dddd-eeee-ffff-000000000000'
    await page.route('/contacts', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          contact: {
            uuid: newUuid,
            vendorUuid: newUuid,
            vendorListingUuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            name: 'New Vendor',
            email: 'vendor@new.com',
          },
        }),
      })
    })

    await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback()
        return
      }
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
    })

    await openProjectNewContactForm(page)
    await page.locator('#newContactName').fill('New Vendor')
    await page.locator('#newContactEmail').fill('vendor@new.com')
    await page.getByRole('button', { name: 'Add & Attach' }).click()

    await expect(page.getByText('New Vendor', { exact: true })).toBeVisible()
    await expect(page.getByText('vendor@new.com', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add & Attach' })).toHaveCount(0)
  })

  test('shows field errors when name or email is blank', async ({ page }) => {
    await login(page)
    await openProjectNewContactForm(page)

    await page.getByRole('button', { name: 'Add & Attach' }).click()

    await expect(page.getByText('Name is required.')).toBeVisible()
    await expect(page.getByText('Email is required.')).toBeVisible()
  })
})
