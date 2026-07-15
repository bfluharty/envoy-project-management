import type { Page, Route } from '@playwright/test'

type InertiaPage = {
  component: string
  url: string
  version: string | null
  clearHistory: boolean
  encryptHistory: boolean
  props: Record<string, unknown>
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function pagePayload(component: string, url: string, props: Record<string, unknown>): InertiaPage {
  return {
    component,
    url,
    version: null,
    clearHistory: false,
    encryptHistory: false,
    props: {
      backendUrl: '',
      errors: {},
      flash: { success: null, error: null, partial_success: null },
      projects: [],
      user: null,
      ...props,
    },
  }
}

/**
 * Serves a real Svelte/Inertia page with deterministic props without requiring
 * an authenticated database fixture. A normal document request receives the
 * app shell, while Inertia visits receive the matching JSON page object.
 */
export async function mockInertiaPage(
  page: Page,
  path: string,
  component: string,
  props: Record<string, unknown>
) {
  const shellResponse = await page.request.get('/')
  if (!shellResponse.ok()) {
    throw new Error(`Unable to load the Inertia app shell: ${shellResponse.status()}`)
  }

  const shell = await shellResponse.text()

  await page.route(path, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const payload = pagePayload(component, `${url.pathname}${url.search}`, props)

    if (request.headers()['x-inertia']) {
      await fulfillInertia(route, payload)
      return
    }

    const dataPage = escapeHtmlAttribute(JSON.stringify(payload))
    const appElement = `<div data-server-rendered="false" id="app" data-page="${dataPage}"></div>`
    const body = shell.replace(
      /<div data-server-rendered="true" id="app" data-page="[^"]*">[\s\S]*<\/div>(?=\s*<\/body>)/,
      appElement
    )

    if (body === shell) {
      throw new Error('Unable to replace the server-rendered Inertia root in the app shell')
    }

    await route.fulfill({ status: 200, contentType: 'text/html', body })
  })
}

export async function fulfillInertia(route: Route, payload: InertiaPage) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'X-Inertia': 'true' },
    body: JSON.stringify(payload),
  })
}

export async function fulfillInertiaPage(
  route: Route,
  component: string,
  url: string,
  props: Record<string, unknown>
) {
  await fulfillInertia(route, pagePayload(component, url, props))
}

export async function redirectInertia(route: Route, location: string) {
  await route.fulfill({ status: 303, headers: { Location: location } })
}
