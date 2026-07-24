import { expect, test, type Page, type Route } from '@playwright/test'
import { fulfillInertiaPage, mockInertiaPage } from './inertia_fixture.js'

const FEEDBACK_ORIGIN = 'https://feedback.test'

const userA = {
  uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  fullName: 'Alice Feedback',
  email: 'alice-feedback@example.com',
  avatar: null,
}

const userB = {
  uuid: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
  fullName: 'Bob Feedback',
  email: 'bob-feedback@example.com',
  avatar: null,
}

type StubHistory = {
  calls: Array<{ command: string; args: unknown[] }>
  identities: Array<Record<string, unknown>>
  metadata: Array<Record<string, string>>
  initCount: number
  destroyCount: number
  logoutCount: number
}

type StubOptions = {
  identifySuccess?: boolean
  sdkFailure?: boolean
  tokenFailure?: boolean
}

function eligibleProps(user = userA) {
  return {
    user,
    projects: [],
    currencies: [],
    feedbackWidget: {
      enabled: true,
      baseUrl: FEEDBACK_ORIGIN,
    },
    feedbackWidgetContext: {
      environment: 'dev',
      appVersion: 'test-sha',
    },
  }
}

async function installQuackbackStub(page: Page, options: StubOptions = {}) {
  const tokenRequests: Array<{ body: string | null; contentType: string | undefined }> = []
  const issuedTokens: string[] = []
  let sdkRequests = 0

  await page.route('**/api/feedback/widget-token', async (route) => {
    const request = route.request()
    tokenRequests.push({
      body: request.postData(),
      contentType: request.headers()['content-type'],
    })

    if (options.tokenFailure) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'FEEDBACK_UNAVAILABLE' }),
      })
      return
    }

    const token = `stub-sso-token-${issuedTokens.length + 1}`
    issuedTokens.push(token)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Cache-Control': 'no-store, private',
        'Pragma': 'no-cache',
      },
      body: JSON.stringify({ ssoToken: token }),
    })
  })

  await page.route(`${FEEDBACK_ORIGIN}/api/widget/sdk.js`, async (route) => {
    sdkRequests += 1
    if (options.sdkFailure) {
      await route.abort('failed')
      return
    }

    const identifySuccess = options.identifySuccess !== false
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        (() => {
          const queued = window.Quackback?.q ? [...window.Quackback.q] : [];
          const history = window.__quackbackHistory ?? {
            calls: [],
            identities: [],
            metadata: [],
            initCount: 0,
            destroyCount: 0,
            logoutCount: 0,
          };
          window.__quackbackHistory = history;
          const listeners = new Map();

          function emit(name, payload) {
            for (const handler of listeners.get(name) ?? []) handler(payload);
          }

          function removeWidget() {
            document.querySelector('[data-testid="quackback-stub-launcher"]')?.remove();
            document.querySelector('[data-testid="quackback-stub-panel"]')?.remove();
          }

          function openPanel() {
            if (document.querySelector('[data-testid="quackback-stub-panel"]')) return;
            const panel = document.createElement('section');
            panel.dataset.testid = 'quackback-stub-panel';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', 'Feedback panel');
            panel.textContent = 'Envoy Feedback';
            Object.assign(panel.style, {
              position: 'fixed',
              zIndex: '2147483000',
              background: '#ffffff',
              color: '#111111',
              border: '1px solid #cccccc',
            });
            if (window.innerWidth < 640) {
              Object.assign(panel.style, { inset: '0', width: '100vw', height: '100dvh' });
            } else {
              Object.assign(panel.style, {
                right: '16px',
                bottom: '72px',
                width: '400px',
                height: '600px',
              });
            }
            document.body.appendChild(panel);
          }

          function createLauncher() {
            if (document.querySelector('[data-testid="quackback-stub-launcher"]')) return;
            const launcher = document.createElement('button');
            launcher.type = 'button';
            launcher.dataset.testid = 'quackback-stub-launcher';
            launcher.setAttribute('aria-label', 'Send feedback');
            launcher.textContent = 'Feedback';
            Object.assign(launcher.style, {
              position: 'fixed',
              right: '16px',
              bottom: '16px',
              width: '48px',
              height: '48px',
              zIndex: '2147483001',
            });
            launcher.addEventListener('click', openPanel);
            document.body.appendChild(launcher);
          }

          function sdk(command, ...args) {
            history.calls.push({ command, args });
            if (command === 'on') {
              const [name, handler] = args;
              const handlers = listeners.get(name) ?? new Set();
              handlers.add(handler);
              listeners.set(name, handlers);
              return () => handlers.delete(handler);
            }
            if (command === 'off') {
              const [name, handler] = args;
              if (!handler) listeners.delete(name);
              else listeners.get(name)?.delete(handler);
              return;
            }
            if (command === 'init') {
              history.initCount += 1;
              history.identities.push(args[0]?.identity ?? {});
              createLauncher();
              queueMicrotask(() => {
                emit('identify', {
                  success: ${identifySuccess},
                  user: ${identifySuccess} ? { id: 'stub-user' } : null,
                  anonymous: false,
                  error: ${identifySuccess} ? undefined : 'TOKEN_INVALID',
                });
                emit('ready', {});
              });
              return;
            }
            if (command === 'metadata') {
              history.metadata.push(args[0]);
              return;
            }
            if (command === 'logout') {
              history.logoutCount += 1;
              document.querySelector('[data-testid="quackback-stub-panel"]')?.remove();
              return;
            }
            if (command === 'destroy') {
              history.destroyCount += 1;
              removeWidget();
            }
          }

          window.Quackback = sdk;
          for (const args of queued) sdk(...args);
        })();
      `,
    })
  })

  return {
    tokenRequests,
    issuedTokens,
    sdkRequestCount: () => sdkRequests,
  }
}

async function stubHistory(page: Page): Promise<StubHistory> {
  return page.evaluate(() => (globalThis as any).__quackbackHistory)
}

async function expectLauncher(page: Page) {
  const launcher = page.getByRole('button', { name: 'Send feedback' })
  await expect(launcher).toBeVisible()
  return launcher
}

async function mockDashboard(page: Page, user = userA) {
  await mockInertiaPage(page, '/dashboard', 'home', eligibleProps(user))
}

test('does not activate on signed-out or required-consent pages', async ({ page }) => {
  const stub = await installQuackbackStub(page)

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Send feedback' })).toHaveCount(0)

  await mockInertiaPage(page, '/onboarding/consent', 'onboarding/consent', {
    user: userA,
    feedbackWidget: null,
    termsVersion: 'test-terms',
    privacyPolicyVersion: 'test-privacy',
    modelTrainingNoticeVersion: 'test-training',
  })
  await page.goto('/onboarding/consent')
  await expect(page.getByRole('button', { name: 'Send feedback' })).toHaveCount(0)

  expect(stub.tokenRequests).toHaveLength(0)
  expect(stub.sdkRequestCount()).toBe(0)
})

test('queues verified initialization, safe metadata, and one accessible desktop launcher', async ({
  page,
}) => {
  const stub = await installQuackbackStub(page)
  await mockDashboard(page)

  await page.goto('/dashboard')
  const launcher = await expectLauncher(page)

  expect(stub.tokenRequests).toEqual([{ body: null, contentType: undefined }])
  expect(stub.sdkRequestCount()).toBe(1)

  const history = await stubHistory(page)
  expect(history.initCount).toBe(1)
  expect(history.calls[0].command).toBe('on')
  expect(history.calls[1]).toMatchObject({
    command: 'init',
    args: [
      {
        placement: 'right',
        identity: { ssoToken: 'stub-sso-token-1' },
      },
    ],
  })
  expect(Object.keys(history.identities[0])).toEqual(['ssoToken'])
  expect(history.metadata.at(-1)).toEqual({
    envoy_environment: 'dev',
    page_area: 'dashboard',
    app_version: 'test-sha',
  })

  const launcherBox = await launcher.boundingBox()
  const accountBox = await page.getByRole('link', { name: 'Account' }).boundingBox()
  expect(launcherBox).not.toBeNull()
  expect(accountBox).not.toBeNull()
  expect(launcherBox!.x).toBeGreaterThan(1200)
  expect(launcherBox!.y).toBeGreaterThan(950)
  expect(launcherBox!.x).toBeGreaterThan(accountBox!.x + accountBox!.width)

  await launcher.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Feedback panel' })).toBeVisible()
})

test('updates only page-area metadata and retains one instance across Inertia navigation', async ({
  page,
}) => {
  const stub = await installQuackbackStub(page)
  await mockInertiaPage(page, '/vendor/pending', 'vendors/pending', {
    ...eligibleProps(),
    vendorName: 'Envoy Pro',
    vendorApprovalStatus: 'PENDING',
  })
  await mockDashboard(page)

  await page.goto('/vendor/pending')
  await expectLauncher(page)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await page.waitForURL('**/dashboard')
  await expectLauncher(page)

  const history = await stubHistory(page)
  expect(history.initCount).toBe(1)
  expect(stub.sdkRequestCount()).toBe(1)
  expect(history.metadata.at(-1)).toEqual({
    envoy_environment: 'dev',
    page_area: 'dashboard',
    app_version: 'test-sha',
  })
  expect(Object.keys(history.metadata.at(-1)!).sort()).toEqual([
    'app_version',
    'envoy_environment',
    'page_area',
  ])
})

test('mounts from the authenticated navbar reached after role registration', async ({ page }) => {
  await installQuackbackStub(page)
  await mockInertiaPage(page, '/vendor/pending', 'vendors/pending', {
    ...eligibleProps(),
    vendorName: 'Envoy Pro',
    vendorApprovalStatus: 'PENDING',
  })

  await page.goto('/vendor/pending')

  await expect(page.getByRole('heading', { name: "You're on the list" })).toBeVisible()
  await expectLauncher(page)
})

test('logs out, destroys, and requests a fresh token when the browser account changes', async ({
  page,
}) => {
  const stub = await installQuackbackStub(page)
  await mockDashboard(page, userA)
  await page.route('**/logout', async (route: Route) => {
    await fulfillInertiaPage(route, 'home', '/dashboard', eligibleProps(userB))
  })

  await page.goto('/dashboard')
  await expectLauncher(page)
  await page.getByRole('button', { name: 'Logout' }).click()

  await expect.poll(() => stub.tokenRequests.length).toBe(2)
  await expectLauncher(page)

  const history = await stubHistory(page)
  expect(stub.issuedTokens).toEqual(['stub-sso-token-1', 'stub-sso-token-2'])
  expect(history.identities).toEqual([
    { ssoToken: 'stub-sso-token-1' },
    { ssoToken: 'stub-sso-token-2' },
  ])
  expect(history.logoutCount).toBeGreaterThanOrEqual(1)
  expect(history.destroyCount).toBeGreaterThanOrEqual(1)
  expect(history.initCount).toBe(2)
})

test('removes the widget when verified identity is rejected', async ({ page }) => {
  const stub = await installQuackbackStub(page, { identifySuccess: false })
  await mockDashboard(page)

  await page.goto('/dashboard')

  await expect.poll(() => stub.sdkRequestCount()).toBe(1)
  await expect(page.getByRole('button', { name: 'Send feedback' })).toHaveCount(0)
  const history = await stubHistory(page)
  expect(history.logoutCount).toBeGreaterThanOrEqual(1)
  expect(history.destroyCount).toBeGreaterThanOrEqual(1)
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
})

test('isolates token and SDK failures from the Envoy page', async ({ page }) => {
  const tokenFailureStub = await installQuackbackStub(page, { tokenFailure: true })
  await mockDashboard(page)

  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Send feedback' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
  expect(tokenFailureStub.tokenRequests).toHaveLength(1)
  expect(tokenFailureStub.sdkRequestCount()).toBe(0)

  await page.unrouteAll({ behavior: 'wait' })
  const sdkFailureStub = await installQuackbackStub(page, { sdkFailure: true })
  await mockDashboard(page)
  await page.goto('/dashboard')

  await expect(page.getByRole('button', { name: 'Send feedback' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
  await expect(page.locator('#envoy-quackback-widget-sdk')).toHaveCount(0)
  expect(sdkFailureStub.sdkRequestCount()).toBe(1)
})

test('uses the bottom-right launcher and a full-screen panel on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await installQuackbackStub(page)
  await mockDashboard(page)

  await page.goto('/dashboard')
  const launcher = await expectLauncher(page)
  const launcherBox = await launcher.boundingBox()

  expect(launcherBox).not.toBeNull()
  expect(launcherBox!.x + launcherBox!.width).toBe(359)
  expect(launcherBox!.y + launcherBox!.height).toBe(651)

  await launcher.click()
  const panel = page.getByRole('dialog', { name: 'Feedback panel' })
  await expect(panel).toBeVisible()
  expect(await panel.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 375,
    height: 667,
  })
})
