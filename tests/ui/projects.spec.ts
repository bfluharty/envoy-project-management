import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

const PROJECT_TITLE_PREFIX = 'E2E Wizard'

async function uniqueTitle() {
  return `${PROJECT_TITLE_PREFIX} ${Date.now()}`
}

async function cleanupCreatedProjects(page: import('@playwright/test').Page) {
  // Delete via API would require a route; instead leave projects in place
  // (test names are timestamped to avoid collision) and rely on the seeded
  // DB being recreated between CI runs. Best-effort: navigate away.
  await page.goto('/dashboard')
}

test.describe('project creation wizard', () => {
  test('happy path: title only via Skip & create', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')

    const title = await uniqueTitle()
    await page.getByRole('button', { name: '+ New project' }).click()

    // Step 1: Essentials
    await expect(page.getByRole('heading', { name: 'Essentials' })).toBeVisible()
    await page.getByLabel(/Title/).fill(title)
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 2: Where & When — skip
    await expect(page.getByRole('heading', { name: 'Where & When' })).toBeVisible()
    await page.getByRole('button', { name: 'Skip & create project' }).click()

    // Land on the new project page
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Page section' })).toBeVisible()

    await cleanupCreatedProjects(page)
  })

  test('full path: walk all 4 steps and create', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')

    const title = await uniqueTitle()
    await page.getByRole('button', { name: '+ New project' }).click()

    // Step 1
    await page.getByLabel(/Title/).fill(title)
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 2: dates (future, valid ordering)
    await page.getByLabel('Start Date').fill('2027-01-01')
    await page.getByLabel('End Date').fill('2027-06-01')
    await page.getByLabel('Deadline').fill('2027-12-31')
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 3: budget
    await expect(page.getByRole('heading', { name: 'Budget' })).toBeVisible()
    await page.getByLabel(/Amount/).fill('5000')
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 4: goals
    await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible()
    await page.getByLabel('Project Goals').fill('Ship the thing')
    await page.getByRole('button', { name: 'Create project' }).click()

    await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    // Switch to overview and verify the values round-tripped
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })
    await expect(page.getByText('Ship the thing')).toBeVisible()

    await cleanupCreatedProjects(page)
  })

  test('title required: cannot advance past step 1 without a title', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')

    await page.getByRole('button', { name: '+ New project' }).click()
    await expect(page.getByRole('heading', { name: 'Essentials' })).toBeVisible()

    await page.getByRole('button', { name: 'Continue' }).click()

    // Should stay on step 1 (Essentials heading still visible) — Where & When
    // heading should NOT appear because the form blocked advance.
    await expect(page.getByRole('heading', { name: 'Essentials' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Where & When' })).not.toBeVisible()
  })
})

test.describe('project overview — edit', () => {
  test('edit Project Details title and save', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')

    // Create a fresh project to edit so we don't pollute seeded data
    const title = await uniqueTitle()
    await page.getByRole('button', { name: '+ New project' }).click()
    await page.getByLabel(/Title/).fill(title)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Skip & create project' }).click()
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 10000 })

    // Open overview, edit, change title
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })
    await expect(page.getByRole('heading', { name: 'Project Details' })).toBeVisible()
    await page.getByRole('button', { name: 'Edit' }).first().click()

    const updatedTitle = `${title} (edited)`
    const titleInput = page.getByLabel(/Project Name/)
    await titleInput.fill(updatedTitle)
    const patchResponse = page.waitForResponse(
      (resp) => resp.url().includes('/projects/') && resp.request().method() === 'PATCH'
    )
    await page.getByRole('button', { name: 'Save' }).click()
    const resp = await patchResponse
    expect(resp.ok()).toBeTruthy()

    // Reload to verify the update was persisted
    await page.reload()
    await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible()
  })
})
