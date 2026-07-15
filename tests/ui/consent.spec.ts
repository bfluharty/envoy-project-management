import { expect, test, type Browser, type Page } from '@playwright/test'
import { fulfillInertiaPage, mockInertiaPage } from './inertia_fixture.js'

const consentProps = {
  termsVersion: '2026-07-15-terms-v1',
  privacyPolicyVersion: '2026-07-15-privacy-v1',
  modelTrainingNoticeVersion: '2026-07-15-model-training-v1',
  privacyReackOnly: false,
}

async function mockConsentPage(page: Page, privacyReackOnly = false) {
  const props = { ...consentProps, privacyReackOnly }
  await mockInertiaPage(page, '/onboarding/consent', 'onboarding/consent', props)
  return props
}

async function openStaticConsentPageWithoutJavaScript(browser: Browser, html: string) {
  const context = await browser.newContext({
    baseURL: 'http://localhost:8080',
    javaScriptEnabled: false,
  })
  const page = await context.newPage()

  await page.route('**/onboarding/consent', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: html })
  )

  return { context, page }
}

function accountPageProps(modelTrainingOptIn = true) {
  return {
    account: {
      fullName: 'Account Consent User',
      email: 'account-consent@example.com',
      avatar: {
        displayName: 'Account Consent User',
        initials: 'AC',
        source: 'generated',
        url: null,
      },
      socialAccountConnected: false,
      linkedAuthProviderLabel: null,
      sessionLoginMethod: 'password',
      passwordAuthEnabled: true,
      canChangePasswordDirectly: true,
      canSendPasswordSetupEmail: false,
    },
    connections: [],
    dataPrivacy: {
      modelTrainingOptIn,
      modelTrainingPreferenceUpdatedAt: '2026-07-15T12:00:00.000Z',
    },
    user: {
      uuid: '00000000-0000-4000-8000-000000000001',
      fullName: 'Account Consent User',
      email: 'account-consent@example.com',
      avatar: {
        displayName: 'Account Consent User',
        initials: 'AC',
        source: 'generated',
        url: null,
      },
    },
  }
}

test.describe('onboarding consent', () => {
  test('starts unchecked and submits an explicit opt-out only after Terms acceptance', async ({
    page,
  }) => {
    const props = await mockConsentPage(page)
    let submission: Record<string, unknown> | undefined
    let submissionCount = 0

    await page.route('/onboarding/consent', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }

      submissionCount += 1
      submission = route.request().postDataJSON()
      await fulfillInertiaPage(route, 'onboarding/consent', '/onboarding/consent', props)
    })

    await page.goto('/onboarding/consent')

    const terms = page.locator('#termsAccepted')
    const training = page.locator('#modelTrainingOptIn')
    const continueButton = page.getByRole('button', { name: 'Continue' })

    await expect(terms).not.toBeChecked()
    await expect(training).not.toBeChecked()
    await expect(continueButton).toBeDisabled()
    await expect(continueButton).toHaveAttribute('aria-disabled', 'true')

    await training.check()
    await expect(continueButton).toBeDisabled()
    await training.uncheck()

    await terms.check()
    await expect(continueButton).toBeEnabled()
    await continueButton.click()

    await expect.poll(() => submissionCount).toBe(1)
    expect(submission).toEqual({ termsAccepted: true, modelTrainingOptIn: false })
  })

  test('submits an explicit model-training opt-in', async ({ page }) => {
    const props = await mockConsentPage(page)
    let submission: Record<string, unknown> | undefined

    await page.route('/onboarding/consent', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }

      submission = route.request().postDataJSON()
      await fulfillInertiaPage(route, 'onboarding/consent', '/onboarding/consent', props)
    })

    await page.goto('/onboarding/consent')
    await page.locator('#termsAccepted').check()
    await page.locator('#modelTrainingOptIn').check()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect
      .poll(() => submission)
      .toEqual({
        termsAccepted: true,
        modelTrainingOptIn: true,
      })
  })

  test('opens legal documents in accessible dialogs and restores trigger focus', async ({
    page,
  }) => {
    await mockConsentPage(page)
    await page.goto('/onboarding/consent')

    const termsLink = page.getByRole('link', { name: 'Terms of Service' })
    const termsAcceptance = page.locator('#termsAccepted')
    await expect(termsAcceptance).not.toBeChecked()
    await expect(termsLink).toHaveAttribute('href', '/terms')
    await termsLink.click()

    const termsDialog = page.getByRole('dialog', { name: 'Terms and Conditions' })
    await expect(termsDialog).toBeVisible()
    await expect(termsDialog.getByRole('heading', { name: 'Terms and Conditions' })).toBeVisible()
    await expect(termsAcceptance).not.toBeChecked()

    const termsBody = termsDialog.locator('.overflow-y-auto')
    const termsScrollTop = await termsBody.evaluate((element) => {
      element.scrollTop = element.scrollHeight
      return element.scrollTop
    })
    expect(termsScrollTop).toBeGreaterThan(0)
    await expect(termsAcceptance).not.toBeChecked()

    const backgroundFocusWasBlocked = await termsDialog.evaluate((dialog) => {
      const signOut = [...dialog.ownerDocument.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Sign out'
      )
      signOut?.focus()

      return {
        activeElementStayedInDialog: dialog.contains(dialog.ownerDocument.activeElement),
        dialogIsModal: dialog.matches(':modal'),
      }
    })
    expect(backgroundFocusWasBlocked).toEqual({
      activeElementStayedInDialog: true,
      dialogIsModal: true,
    })

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press(index === 0 ? 'Shift+Tab' : 'Tab')
      const focusState = await termsDialog.evaluate((dialog) => {
        const activeElement = dialog.ownerDocument.activeElement
        const activeBackgroundControl = activeElement?.closest(
          'a, button, input, select, textarea, [tabindex]'
        )

        return {
          activeElementIsDocumentBody: activeElement === dialog.ownerDocument.body,
          insideDialog: dialog.contains(activeElement),
          backgroundControlFocused: Boolean(
            activeBackgroundControl && !dialog.contains(activeBackgroundControl)
          ),
        }
      })
      expect(focusState.backgroundControlFocused).toBe(false)
      expect(focusState.insideDialog || focusState.activeElementIsDocumentBody).toBe(true)
    }

    await termsDialog.getByRole('button', { name: 'Close' }).click()
    await expect(termsDialog).not.toBeVisible()
    await expect(termsLink).toBeFocused()

    const privacyLink = page.getByRole('link', { name: 'Privacy Policy' })
    await expect(privacyLink).toHaveAttribute('href', '/privacy')
    await privacyLink.click()

    const privacyDialog = page.getByRole('dialog', { name: 'Privacy Policy' })
    await expect(privacyDialog).toBeVisible()
    await privacyDialog.locator('.overflow-y-auto').evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect(termsAcceptance).not.toBeChecked()
    await page.keyboard.press('Escape')
    await expect(privacyDialog).not.toBeVisible()
    await expect(privacyLink).toBeFocused()
    await expect(termsAcceptance).not.toBeChecked()
  })

  test('navigates to the public legal URLs when JavaScript is unavailable', async ({
    page,
    browser,
  }) => {
    await mockConsentPage(page)
    await page.goto('/onboarding/consent')
    const renderedConsentMarkup = await page
      .locator('main')
      .evaluate((element) => element.outerHTML)
    expect(renderedConsentMarkup).toContain('Terms of Service')
    const renderedConsentHtml = `<!doctype html><html><body>${renderedConsentMarkup}</body></html>`
    const noJavaScript = await openStaticConsentPageWithoutJavaScript(browser, renderedConsentHtml)

    try {
      for (const [linkName, path] of [
        ['Terms of Service', '/terms'],
        ['Privacy Policy', '/privacy'],
      ] as const) {
        const consentResponse = await noJavaScript.page.goto('/onboarding/consent')
        expect(consentResponse?.status()).toBe(200)
        await expect(noJavaScript.page.locator('body')).toContainText('Terms of Service')
        const link = noJavaScript.page.getByRole('link', { name: linkName })
        await expect(link).toHaveAttribute('href', path)
        const navigation = noJavaScript.page.waitForResponse(
          (response) => new URL(response.url()).pathname === path
        )
        await link.click()
        const legalResponse = await navigation
        expect(legalResponse.status()).toBe(200)
        await expect(noJavaScript.page).toHaveURL(new RegExp(`${path}$`))
      }
    } finally {
      await noJavaScript.context.close()
    }
  })

  test('preserves normal browser behavior for modified legal-link clicks', async ({
    page,
    context,
  }) => {
    await mockConsentPage(page)
    await context.route(/\/terms$|\/privacy$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>Legal document</title><h1>Legal document</h1>',
      })
    )
    await page.goto('/onboarding/consent')

    for (const [name, path, dialogName] of [
      ['Terms of Service', '/terms', 'Terms and Conditions'],
      ['Privacy Policy', '/privacy', 'Privacy Policy'],
    ] as const) {
      const popupPromise = context.waitForEvent('page')
      await page.getByRole('link', { name }).click({ modifiers: ['Control'] })
      const popup = await popupPromise
      await popup.waitForURL(`**${path}`)
      expect(new URL(popup.url()).pathname).toBe(path)
      await expect(page.getByRole('dialog', { name: dialogName })).not.toBeVisible()
      await popup.close()
      await page.bringToFront()
    }
  })

  test('prevents duplicate delayed submissions and exposes the processing state', async ({
    page,
  }) => {
    const props = await mockConsentPage(page)
    let submissionCount = 0
    let releaseResponse: (() => void) | undefined
    const responseDelay = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })

    await page.route('/onboarding/consent', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }

      submissionCount += 1
      await responseDelay
      await fulfillInertiaPage(route, 'onboarding/consent', '/onboarding/consent', props)
    })

    await page.goto('/onboarding/consent')
    await page.locator('#termsAccepted').check()
    const continueButton = page.getByRole('button', { name: 'Continue' })
    await continueButton.click()

    await expect.poll(() => submissionCount).toBe(1)
    const processingButton = page.getByRole('button', { name: 'Saving preferences...' })
    await expect(processingButton).toBeDisabled()
    await expect(processingButton).toHaveAttribute('aria-disabled', 'true')
    await expect(page.locator('#termsAccepted')).toBeDisabled()

    await page.locator('form').dispatchEvent('submit')
    await page.waitForTimeout(100)
    expect(submissionCount).toBe(1)

    releaseResponse?.()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  test('can be completed using only the keyboard', async ({ page }) => {
    const props = await mockConsentPage(page)
    let submissionCount = 0

    await page.route('/onboarding/consent', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }

      submissionCount += 1
      await fulfillInertiaPage(route, 'onboarding/consent', '/onboarding/consent', props)
    })

    await page.goto('/onboarding/consent')
    const terms = page.locator('#termsAccepted')
    const continueButton = page.getByRole('button', { name: 'Continue' })

    for (
      let attempt = 0;
      attempt < 10 && !(await terms.evaluate((node) => node === node.ownerDocument.activeElement));
      attempt += 1
    ) {
      await page.keyboard.press('Tab')
    }
    await expect(terms).toBeFocused()
    await page.keyboard.press('Space')
    await expect(terms).toBeChecked()

    for (
      let attempt = 0;
      attempt < 10 &&
      !(await continueButton.evaluate((node) => node === node.ownerDocument.activeElement));
      attempt += 1
    ) {
      await page.keyboard.press('Tab')
    }
    await expect(continueButton).toBeFocused()
    await page.keyboard.press('Enter')
    await expect.poll(() => submissionCount).toBe(1)
  })

  test('keeps the legal dialog usable in a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await mockConsentPage(page)
    await page.goto('/onboarding/consent')

    await page.getByRole('link', { name: 'Privacy Policy' }).click()
    const dialog = page.getByRole('dialog', { name: 'Privacy Policy' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()

    const bounds = await dialog.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(667)
  })

  test('renders the designated Privacy re-acknowledgment without a training control', async ({
    page,
  }) => {
    await mockConsentPage(page, true)
    await page.goto('/onboarding/consent')

    await expect(
      page.getByRole('heading', { name: 'Review our updated Privacy Policy' })
    ).toBeVisible()
    await expect(page.locator('#modelTrainingOptIn')).toHaveCount(0)

    const acknowledgment = page.locator('#termsAccepted')
    const continueButton = page.getByRole('button', { name: 'Continue' })
    await expect(acknowledgment).not.toBeChecked()
    await expect(continueButton).toBeDisabled()
    await acknowledgment.check()
    await expect(continueButton).toBeEnabled()
  })
})

test('account data preference requires an explicit Save and submits the changed value', async ({
  page,
}) => {
  const accountProps = accountPageProps()
  await mockInertiaPage(page, '/account', 'account', accountProps)

  let submission: Record<string, unknown> | undefined
  await page.route('/account/data-preferences', async (route) => {
    submission = route.request().postDataJSON()
    accountProps.dataPrivacy.modelTrainingOptIn = false
    accountProps.dataPrivacy.modelTrainingPreferenceUpdatedAt = '2026-07-15T13:00:00.000Z'
    await fulfillInertiaPage(route, 'account', '/account', accountProps)
  })

  await page.goto('/account')

  const preference = page.locator('#modelTrainingOptIn')
  const saveButton = page.getByRole('button', { name: 'Save preference' })
  await expect(page.getByRole('heading', { name: 'Data & Privacy' })).toBeVisible()
  await expect(preference).toBeChecked()
  await expect(saveButton).toBeDisabled()

  await preference.uncheck()
  await expect(saveButton).toBeEnabled()
  await saveButton.click()

  await expect.poll(() => submission).toEqual({ modelTrainingOptIn: false })
  await expect(page.getByRole('status')).toContainText(
    'Model-training participation is now disabled.'
  )

  await page.reload()
  await expect(page.locator('#modelTrainingOptIn')).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Save preference' })).toBeDisabled()
})

test('account data preference displays useful server validation feedback', async ({ page }) => {
  const accountProps = accountPageProps()
  await mockInertiaPage(page, '/account', 'account', accountProps)

  await page.route('/account/data-preferences', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      headers: { 'X-Inertia': 'true' },
      body: JSON.stringify({
        component: 'account',
        url: '/account',
        version: null,
        clearHistory: false,
        encryptHistory: false,
        props: {
          backendUrl: '',
          flash: { success: null, error: null, partial_success: null },
          projects: [],
          ...accountProps,
          errors: {
            modelTrainingOptIn: ['We could not save your data preference. Please try again.'],
          },
        },
      }),
    })
  )

  await page.goto('/account')
  await page.locator('#modelTrainingOptIn').uncheck()
  await page.getByRole('button', { name: 'Save preference' }).click()

  await expect(page.getByRole('alert')).toContainText(
    'We could not save your data preference. Please try again.'
  )
  await expect(page.getByRole('button', { name: 'Save preference' })).toBeEnabled()
})

test('account data preference prevents duplicate saves while a PATCH is pending', async ({
  page,
}) => {
  const accountProps = accountPageProps()
  await mockInertiaPage(page, '/account', 'account', accountProps)

  let submissionCount = 0
  let releaseResponse: (() => void) | undefined
  const responseDelay = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })

  await page.route('/account/data-preferences', async (route) => {
    submissionCount += 1
    await responseDelay
    accountProps.dataPrivacy.modelTrainingOptIn = false
    accountProps.dataPrivacy.modelTrainingPreferenceUpdatedAt = '2026-07-15T13:00:00.000Z'
    await fulfillInertiaPage(route, 'account', '/account', accountProps)
  })

  await page.goto('/account')
  const preference = page.locator('#modelTrainingOptIn')
  const dataPrivacyForm = page.locator('form').filter({ has: preference })
  await preference.uncheck()
  await page.getByRole('button', { name: 'Save preference' }).click()

  await expect.poll(() => submissionCount).toBe(1)
  const savingButton = page.getByRole('button', { name: 'Saving...' })
  await expect(savingButton).toBeDisabled()
  await expect(preference).toBeDisabled()

  await dataPrivacyForm.dispatchEvent('submit')
  await page.waitForTimeout(100)
  expect(submissionCount).toBe(1)

  releaseResponse?.()
  await expect(page.getByRole('button', { name: 'Save preference' })).toBeDisabled()
  await expect(page.getByRole('status')).toContainText(
    'Model-training participation is now disabled.'
  )
})
