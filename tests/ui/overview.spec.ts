import { test, expect } from '@playwright/test'
import { login, goToProject, PROJECT_ALPHA_UUID } from './helpers.js'

// Data Analytics Dashboard — Alice owns it, no linked vendors, Acme Corp available to attach
const NO_VENDOR_PROJECT_UUID = 'b3c4d5e6-f7a8-4b0c-8d2e-3f4a5b6c7d8e'

// Acme Corp — Alice's only vendor
const ACME_UUID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f'

// ── Tab behaviour ──────────────────────────────────────────────────────────────

function buildThreadCard(overrides: Partial<any> = {}) {
  const base = {
    threadUuid: 'thread-default',
    projectVendorUuid: ACME_UUID,
    draftUuid: null,
    vendor: { uuid: ACME_UUID, name: 'Acme Corp', email: 'contact@acme.com' },
    status: 'sent',
    subject: 'Default subject',
    body: 'Default body',
    sentAt: '2026-04-01T12:00:00.000Z',
    lastActivityAt: '2026-04-01T12:00:00.000Z',
    needsAttention: false,
    lastError: null,
    replyReceived: false,
    thread: {
      uuid: 'thread-default',
      messages: [
        {
          uuid: 'message-default',
          direction: 'outbound',
          subject: 'Default subject',
          from: 'alice@example.com',
          to: 'contact@acme.com',
          body: 'Default body',
          sentAt: '2026-04-01T12:00:00.000Z',
        },
      ],
    },
  }

  return {
    ...base,
    ...overrides,
    thread: {
      ...base.thread,
      ...(overrides.thread ?? {}),
    },
  }
}

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

  test('switching to outreach tab loads thread rows and draft composer', async ({ page }) => {
    await login(page)
    await goToProject(page)

    await page.route(`/api/projects/${PROJECT_ALPHA_UUID}/outreach/sync`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          senderMode: 'connected_inbox',
          cards: [
            buildThreadCard({
              threadUuid: 'thread-draft',
              draftUuid: 'draft-1',
              status: 'draft',
              subject: 'Launch kickoff',
              body: 'Hello Acme team, can you share timing and pricing?',
              sentAt: null,
              lastActivityAt: '2026-04-01T11:30:00.000Z',
              thread: { uuid: 'thread-draft', messages: [] },
            }),
          ],
        }),
      })
    })

    await page.getByRole('radio', { name: 'outreach' }).click({ force: true })
    await expect(page.getByRole('heading', { name: 'Outreach' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Draft to Acme Corp' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve & Send' })).toBeVisible()
  })

  test('switching back to convo tab restores chat', async ({ page }) => {
    await login(page)
    await goToProject(page)
    await page.getByRole('radio', { name: 'overview' }).click({ force: true })
    await page.getByRole('radio', { name: 'convo' }).click({ force: true })
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible()
  })
})

test.describe('outreach interactions', () => {
  test('approve & send uses inline edited draft content', async ({ page }) => {
    await login(page)
    await goToProject(page)

    await page.route(`/api/projects/${PROJECT_ALPHA_UUID}/outreach/sync`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          senderMode: 'connected_inbox',
          cards: [
            buildThreadCard({
              threadUuid: 'thread-send',
              draftUuid: 'draft-send',
              status: 'draft',
              subject: 'Original subject',
              body: 'Original body',
              sentAt: null,
              lastActivityAt: '2026-04-01T10:00:00.000Z',
              thread: { uuid: 'thread-send', messages: [] },
            }),
          ],
        }),
      })
    })

    let sentPayload: any = null
    await page.route(
      `/api/projects/${PROJECT_ALPHA_UUID}/outreach/drafts/draft-send/send`,
      async (route) => {
        sentPayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            senderMode: 'connected_inbox',
            cards: [
              buildThreadCard({
                threadUuid: 'thread-send',
                draftUuid: 'draft-send',
                status: 'sent',
                subject: sentPayload.subject,
                body: sentPayload.body,
                sentAt: '2026-04-01T12:00:00.000Z',
                lastActivityAt: '2026-04-01T12:00:00.000Z',
                thread: {
                  uuid: 'thread-send',
                  messages: [
                    {
                      uuid: 'message-send',
                      direction: 'outbound',
                      subject: sentPayload.subject,
                      from: 'alice@example.com',
                      to: 'contact@acme.com',
                      body: sentPayload.body,
                      sentAt: '2026-04-01T12:00:00.000Z',
                    },
                  ],
                },
              }),
            ],
          }),
        })
      }
    )

    await page.getByRole('radio', { name: 'outreach' }).click({ force: true })
    await page.locator('input').nth(0).fill('Edited subject')
    await page.locator('textarea').nth(0).fill('Edited body text')
    await page.getByRole('button', { name: 'Approve & Send' }).click()

    expect(sentPayload).toEqual({ subject: 'Edited subject', body: 'Edited body text' })
    await expect(page.getByText(/Sent/).first()).toBeVisible()
  })

  test('failed generated drafts can be retried from the outreach tab', async ({ page }) => {
    await login(page)
    await goToProject(page)

    const failedCard = buildThreadCard({
      threadUuid: 'thread-retry',
      draftUuid: 'draft-retry',
      status: 'error',
      subject: '',
      body: '',
      sentAt: null,
      lastActivityAt: '2026-04-01T10:00:00.000Z',
      lastError: 'Reasoning engine did not return an outreach draft body',
      thread: { uuid: 'thread-retry', messages: [] },
    })

    await page.route(`/api/projects/${PROJECT_ALPHA_UUID}/outreach/sync`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          senderMode: 'connected_inbox',
          cards: [failedCard],
        }),
      })
    })

    let retryCalled = false
    await page.route(
      `/api/projects/${PROJECT_ALPHA_UUID}/outreach/drafts/draft-retry/retry`,
      async (route) => {
        retryCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            senderMode: 'connected_inbox',
            cards: [
              buildThreadCard({
                ...failedCard,
                status: 'draft',
                subject: 'Acme availability',
                body: 'Hi Acme Corp,\n\nCan you share availability?\n\nThanks,\nAlice',
                lastError: null,
              }),
            ],
          }),
        })
      }
    )

    await page.getByRole('radio', { name: 'outreach' }).click({ force: true })
    await expect(
      page.getByText('Reasoning engine did not return an outreach draft body')
    ).toBeVisible()
    await page.getByRole('button', { name: 'Retry draft generation' }).click()

    expect(retryCalled).toBe(true)
    await expect(page.locator('input').nth(0)).toHaveValue('Acme availability')
    await expect(page.locator('textarea').nth(0)).toHaveValue(/Can you share availability/)
    await expect(
      page.getByText('Reasoning engine did not return an outreach draft body')
    ).not.toBeVisible()
  })

  test('new message creates a new thread for the same contact', async ({ page }) => {
    await login(page)
    await goToProject(page)

    await page.route(`/api/projects/${PROJECT_ALPHA_UUID}/outreach/sync`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          senderMode: 'connected_inbox',
          cards: [
            buildThreadCard({
              threadUuid: 'thread-existing',
              subject: 'Existing thread',
              body: 'Prior message',
              sentAt: '2026-04-01T09:00:00.000Z',
              lastActivityAt: '2026-04-01T09:00:00.000Z',
            }),
          ],
        }),
      })
    })

    let createPayload: any = null
    await page.route(`/api/projects/${PROJECT_ALPHA_UUID}/outreach/drafts`, async (route) => {
      createPayload = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          senderMode: 'connected_inbox',
          createdThreadUuid: 'thread-new',
          cards: [
            buildThreadCard({
              threadUuid: 'thread-new',
              draftUuid: 'draft-new',
              status: 'draft',
              subject: '',
              body: '',
              sentAt: null,
              lastActivityAt: '2026-04-01T12:00:00.000Z',
              thread: { uuid: 'thread-new', messages: [] },
            }),
            buildThreadCard({
              threadUuid: 'thread-existing',
              subject: 'Existing thread',
              body: 'Prior message',
              sentAt: '2026-04-01T09:00:00.000Z',
              lastActivityAt: '2026-04-01T09:00:00.000Z',
            }),
          ],
        }),
      })
    })

    await page.getByRole('radio', { name: 'outreach' }).click({ force: true })
    await page.getByRole('button', { name: 'New message' }).first().click()
    await page.getByRole('button', { name: 'Create draft' }).click()

    expect(createPayload).toEqual({ vendorUuid: ACME_UUID })
    await expect(page.getByRole('heading', { name: 'Draft to Acme Corp' })).toBeVisible()
    await expect(page.locator('aside button:has-text("Acme Corp")')).toHaveCount(2)
  })

  test('thread list is flat and sorted by recency with attention badge', async ({ page }) => {
    await login(page)
    await goToProject(page)

    await page.route(`/api/projects/${PROJECT_ALPHA_UUID}/outreach/sync`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          senderMode: 'connected_inbox',
          cards: [
            buildThreadCard({
              threadUuid: 'thread-newest',
              subject: 'Newest thread',
              body: 'Latest inbound',
              status: 'received',
              needsAttention: true,
              replyReceived: true,
              sentAt: '2026-04-01T13:00:00.000Z',
              lastActivityAt: '2026-04-01T13:00:00.000Z',
              thread: {
                uuid: 'thread-newest',
                messages: [
                  {
                    uuid: 'message-inbound-new',
                    direction: 'inbound',
                    subject: 'Newest thread',
                    from: 'Acme Corp <contact@acme.com>',
                    to: 'alice@example.com',
                    body: 'Latest inbound',
                    sentAt: '2026-04-01T13:00:00.000Z',
                  },
                ],
              },
            }),
            buildThreadCard({
              threadUuid: 'thread-older',
              subject: 'Older thread',
              body: 'Older message',
              sentAt: '2026-04-01T10:00:00.000Z',
              lastActivityAt: '2026-04-01T10:00:00.000Z',
            }),
          ],
        }),
      })
    })

    await page.getByRole('radio', { name: 'outreach' }).click({ force: true })
    await expect(page.getByText('Needs attention').first()).toBeVisible()
    await expect(page.locator('aside button:has-text("Newest thread")').first()).toBeVisible()
  })

  test('reply revision rewrites body before send', async ({ page }) => {
    await login(page)
    await goToProject(page)

    const threadCard = buildThreadCard({
      threadUuid: 'thread-reply',
      status: 'received',
      subject: 'Photography availability',
      body: 'Checking your availability.',
      sentAt: '2026-04-01T12:00:00.000Z',
      lastActivityAt: '2026-04-01T13:00:00.000Z',
      needsAttention: true,
      replyReceived: true,
      thread: {
        uuid: 'thread-reply',
        messages: [
          {
            uuid: 'message-outbound',
            direction: 'outbound',
            subject: 'Photography availability',
            from: 'alice@example.com',
            to: 'contact@acme.com',
            body: 'Checking your availability.',
            sentAt: '2026-04-01T12:00:00.000Z',
            messageId: '<outbound@example.com>',
            threadId: 'gmail-thread-1',
          },
          {
            uuid: 'message-inbound',
            direction: 'inbound',
            subject: 'Re: Photography availability',
            from: 'Acme Corp <contact@acme.com>',
            to: 'alice@example.com',
            body: 'Yes, we are available.',
            sentAt: '2026-04-01T13:00:00.000Z',
            references: '<outbound@example.com>',
            threadId: 'gmail-thread-1',
          },
        ],
      },
    })

    await page.route(`/api/projects/${PROJECT_ALPHA_UUID}/outreach/sync`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ senderMode: 'connected_inbox', cards: [threadCard] }),
      })
    })

    let revisePayload: any = null
    await page.route(
      `/api/projects/${PROJECT_ALPHA_UUID}/outreach/threads/thread-reply/replies/revise`,
      async (route) => {
        revisePayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            senderMode: 'connected_inbox',
            revisedThreadUuid: 'thread-reply',
            revisedReplyBody: 'Great, thank you! Confirming next steps.',
            cards: [threadCard],
          }),
        })
      }
    )

    let sendPayload: any = null
    await page.route(
      `/api/projects/${PROJECT_ALPHA_UUID}/outreach/threads/thread-reply/replies`,
      async (route) => {
        sendPayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ senderMode: 'connected_inbox', cards: [threadCard] }),
        })
      }
    )

    await page.getByRole('radio', { name: 'outreach' }).click({ force: true })
    await page.getByRole('button', { name: 'Reply', exact: true }).click()
    await expect(page.locator('textarea').first()).toHaveValue('')
    await page.getByRole('button', { name: 'Write with AI' }).click()
    await page.getByPlaceholder(/Make it shorter/).fill('Make it clearer and concise.')
    await page.getByRole('button', { name: 'Generate draft' }).click()
    await expect(page.locator('textarea').first()).toHaveValue('')
    await expect(page.getByRole('heading', { name: 'Revision preview' })).toBeVisible()
    await expect(page.getByLabel('Suggested revision')).toHaveValue(
      'Great, thank you! Confirming next steps.'
    )
    await page.getByRole('button', { name: 'Apply revision' }).click()
    await expect(page.locator('textarea').first()).toHaveValue(
      'Great, thank you! Confirming next steps.'
    )
    await page.getByRole('button', { name: 'Send reply' }).click()

    expect(revisePayload).toEqual({
      instructions: 'Make it clearer and concise.',
    })
    expect(sendPayload).toEqual({
      subject: 'Re: Photography availability',
      body: 'Great, thank you! Confirming next steps.',
      threadId: 'gmail-thread-1',
    })
  })

  test('mobile outreach uses master-detail with back navigation and no overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page)
    await goToProject(page)

    await page.route(`/api/projects/${PROJECT_ALPHA_UUID}/outreach/sync`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          senderMode: 'connected_inbox',
          cards: [
            buildThreadCard({
              threadUuid: 'thread-mobile',
              subject: 'Mobile thread',
              body: 'Message body',
              sentAt: '2026-04-01T12:00:00.000Z',
              lastActivityAt: '2026-04-01T12:00:00.000Z',
            }),
          ],
        }),
      })
    })

    await page.getByRole('radio', { name: 'outreach' }).click({ force: true })
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
    await page
      .getByRole('button', { name: /Acme Corp/ })
      .first()
      .click()
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()

    const dimensions = await page.evaluate(() => ({
      innerWidth: (globalThis as any).innerWidth as number,
      scrollWidth: (globalThis as any).document.documentElement.scrollWidth as number,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth)
  })
})
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
    await expect(page.getByText('$10,000.00')).toBeVisible()
    await expect(page.getByText('January 1, 2026')).toBeVisible()
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
    await page.getByRole('button', { name: 'Edit' }).nth(0).click()
    await page.getByLabel('Budget').fill('0')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForFunction("!document.querySelector('form')")

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

    await page.getByRole('button', { name: 'Edit' }).nth(0).click()
    await expect(page.getByLabel('Project Name')).toBeVisible()
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

    await page.getByRole('button', { name: 'Edit' }).nth(0).click()
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

    await page.getByRole('button', { name: 'Edit' }).nth(0).click()
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

    await page.getByRole('button', { name: 'Edit' }).nth(0).click()
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

  // ── Delete project ─────────────────────────────────────────────────────────────

  // 1. Button is visible on the overview tab

  test.describe('delete project', () => {
    test('shows a Delete project button on the overview tab', async ({ page }) => {
      await login(page)
      await goToProject(page)
      await page.getByRole('radio', { name: 'overview' }).click({ force: true })

      await expect(page.getByRole('button', { name: 'Delete project' })).toBeVisible()
    })

    // 2. Button opens the modal
    test('Clicking Delete project opens the confirmation modal', async ({ page }) => {
      await login(page)
      await goToProject(page)
      await page.getByRole('radio', { name: 'overview' }).click({ force: true })

      await page.getByRole('button', { name: 'Delete project' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Delete project?' })).toBeVisible()
    })

    // 3. Cancel closes the modal without sending a request
    test('Cancel closes the modal and does not send a patch request', async ({ page }) => {
      await login(page)
      await goToProject(page)
      await page.getByRole('radio', { name: 'overview' }).click({ force: true })

      let patchCalled = false
      await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
        if (route.request().method() === 'PATCH') patchCalled = true
        await route.continue()
      })

      await page.getByRole('button', { name: 'Delete project' }).click()
      await page.getByRole('button', { name: 'Cancel' }).click()

      await expect(page.getByRole('dialog')).not.toBeVisible()
      expect(patchCalled).toBe(false)
    })

    // 4. Escape closes the modal without sending a request
    test('Escape closes the modal and does not send a patch request', async ({ page }) => {
      await login(page)
      await goToProject(page)
      await page.getByRole('radio', { name: 'overview' }).click({ force: true })

      let patchCalled = false
      await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
        if (route.request().method() === 'PATCH') patchCalled = true
        await route.continue()
      })

      await page.getByRole('button', { name: 'Delete project' }).click()
      await page.keyboard.press('Escape')

      await expect(page.getByRole('dialog')).not.toBeVisible()
      expect(patchCalled).toBe(false)
    })

    // 5. Confirm sends PATCH with { isActive: false }
    test('confirming sends PATCH /projects/:uuid with { isActive: false }', async ({ page }) => {
      await login(page)
      await goToProject(page)
      await page.getByRole('radio', { name: 'overview' }).click({ force: true })
      let capturedPayload = null

      await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
        if (route.request().method() === 'PATCH') {
          capturedPayload = route.request().postDataJSON()
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ project: {}, linkedVendors: [] }),
          })
        } else {
          await route.continue()
        }
      })

      await page.getByRole('button', { name: 'Delete project' }).click()
      await page.getByRole('button', { name: 'Delete project' }).last().click()

      expect(capturedPayload).toEqual({ isActive: false })
    })

    // 6. Success redirects to /dashboard
    test('successful deletion redirects to /dashboard', async ({ page }) => {
      await login(page)
      await goToProject(page)
      await page.getByRole('radio', { name: 'overview' }).click({ force: true })

      await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
        if (route.request().method() === 'PATCH') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ project: {}, linkedVendors: [] }),
          })
        } else {
          await route.continue()
        }
      })

      await page.getByRole('button', { name: 'Delete project' }).click()
      await page.getByRole('button', { name: 'Delete project' }).last().click()

      await page.waitForURL('**/dashboard')
    })

    // 7. Failed request shows inline error and keeps the modal open
    test('failed deletion shows error and keeps modal open', async ({ page }) => {
      await login(page)
      await goToProject(page)
      await page.getByRole('radio', { name: 'overview' }).click({ force: true })

      await page.route(`/projects/${PROJECT_ALPHA_UUID}`, async (route) => {
        if (route.request().method() === 'PATCH') {
          await route.fulfill({ status: 500 })
        } else {
          await route.continue()
        }
      })

      await page.getByRole('button', { name: 'Delete project' }).click()
      await page.getByRole('button', { name: 'Delete project' }).last().click()

      await expect(page.getByRole('alert')).toHaveText(
        'Failed to delete project. Please try again.'
      )
      await expect(page.getByRole('dialog')).toBeVisible()
    })
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

    await page.getByRole('button', { name: 'Edit' }).nth(1).click()
    await page.getByRole('button', { name: '+ Attach existing' }).click()
    await page.getByRole('checkbox', { name: /Acme Corp/ }).check()
    await page.getByRole('button', { name: 'Attach (1)' }).click()

    await expect(page.getByText('Acme Corp')).toBeVisible()
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

    await page.getByRole('button', { name: 'Edit' }).nth(1).click()
    await page.getByRole('button', { name: 'Detach' }).click()
    await page.getByRole('button', { name: 'Yes' }).click()

    await expect(
      page.getByText(
        'No contacts yet. Attach contacts here so Envoy can draft outreach emails for them.'
      )
    ).toBeVisible()
  })

  test('contact is disabled while attach request is in-flight', async ({ page }) => {
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

    await page.getByRole('button', { name: 'Edit' }).nth(1).click()
    await page.getByRole('button', { name: '+ Attach existing' }).click()
    await page.getByRole('checkbox', { name: /Acme Corp/ }).check()
    await page.getByRole('button', { name: 'Attach (1)' }).click()

    // Attach button shows attaching state and is disabled while the request is pending
    await expect(page.getByRole('button', { name: 'Attaching…' })).toBeDisabled()

    // Unblock the request
    resolveRequest!()
    await expect(page.getByText('Acme Corp')).toBeVisible()
  })
})
