import { expect, test, type Frame, type Page } from '@playwright/test'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import process from 'node:process'
import 'dotenv/config'
import pg from 'pg'

const port = process.env.QUACKBACK_LIVE_TEST_PORT ?? '18081'
const database = process.env.QUACKBACK_LIVE_TEST_DATABASE ?? 'envoy_quackback_live'
const baseUrl = `http://127.0.0.1:${port}`
const feedbackOrigin = 'https://feedback.hello-envoy.com'
const widgetSecretParameter =
  process.env.QUACKBACK_LIVE_TEST_SECRET_PARAMETER ?? '/envoy/dev/QUACKBACK_WIDGET_SECRET'
const email = process.env.QUACKBACK_LIVE_TEST_EMAIL ?? 'alice@example.com'
const password = process.env.QUACKBACK_LIVE_TEST_PASSWORD ?? 'hashedpassword1'

const adminConnection = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'postgres',
}

let appEnvironment: NodeJS.ProcessEnv
let databaseCreated = false
let server: ChildProcess | undefined
let serverError = ''

test.describe.configure({ mode: 'serial' })

async function runNode(args: string[]) {
  const child = spawn(process.execPath, args, {
    env: appEnvironment,
    stdio: 'inherit',
    windowsHide: true,
  })
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })

  if (exitCode !== 0) {
    throw new Error(`${args.join(' ')} exited with status ${exitCode}`)
  }
}

async function createIsolatedDatabase() {
  const client = new pg.Client(adminConnection)
  await client.connect()
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])
    if (exists.rowCount) {
      throw new Error(`Refusing to reuse existing database ${database}`)
    }
    await client.query(`CREATE DATABASE "${database}"`)
  } finally {
    await client.end()
  }
}

async function removeIsolatedDatabase() {
  const client = new pg.Client(adminConnection)
  await client.connect()
  try {
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [database]
    )
    await client.query(`DROP DATABASE IF EXISTS "${database}"`)
  } finally {
    await client.end()
  }
}

async function stopServer() {
  if (!server || server.exitCode !== null) {
    return
  }

  const exited = new Promise<void>((resolve) => {
    server?.once('exit', () => resolve())
  })
  server.kill()
  await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 5_000))])
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // The local application is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Local Envoy server did not start: ${serverError.slice(-1_000)}`)
}

async function login(page: Page) {
  const response = await page.request.post(`${baseUrl}/login`, {
    form: { email, password },
    maxRedirects: 0,
  })
  expect(response.status()).toBe(302)
}

async function openFeedbackPanel(page: Page): Promise<Frame> {
  const launcher = page.getByRole('button', { name: /feedback/i }).last()
  await expect(launcher).toBeVisible()
  await launcher.click()

  await expect
    .poll(() => page.frames().some((frame) => frame.url().startsWith(feedbackOrigin)))
    .toBe(true)

  const frame = page.frames().find((candidate) => candidate.url().startsWith(feedbackOrigin))
  if (!frame) {
    throw new Error('Quackback feedback frame did not load')
  }

  await expect(frame.locator('body')).not.toHaveText('')
  return frame
}

test.beforeAll(async () => {
  if (!/^[a-z0-9_]+$/.test(database)) {
    throw new Error(
      'QUACKBACK_LIVE_TEST_DATABASE must contain only lowercase letters, digits, and underscores'
    )
  }

  const widgetSecret = execFileSync(
    'aws',
    [
      'ssm',
      'get-parameter',
      '--region',
      'us-east-1',
      '--name',
      widgetSecretParameter,
      '--with-decryption',
      '--query',
      'Parameter.Value',
      '--output',
      'text',
    ],
    { encoding: 'utf8' }
  ).trim()

  appEnvironment = {
    ...process.env,
    APP_URL: baseUrl,
    DB_DATABASE: database,
    EMAIL_SYNC_WORKER_ENABLED: 'false',
    HOST: '127.0.0.1',
    PASSWORD_AUTH_ENABLED: 'true',
    PORT: port,
    QUACKBACK_BASE_URL: feedbackOrigin,
    QUACKBACK_ENABLED: 'true',
    QUACKBACK_WIDGET_SECRET: widgetSecret,
  }

  try {
    await createIsolatedDatabase()
    databaseCreated = true
    await runNode(['ace', 'migration:run', '--force'])
    await runNode(['ace', 'db:seed'])

    server = spawn(process.execPath, ['ace', 'serve', '--no-clear'], {
      env: appEnvironment,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    })
    server.stderr?.on('data', (chunk) => {
      serverError += chunk.toString()
    })
    await waitForServer()
  } catch (error) {
    await stopServer()
    if (databaseCreated) {
      await removeIsolatedDatabase()
      databaseCreated = false
    }
    throw error
  }
})

test.afterAll(async () => {
  await stopServer()
  if (databaseCreated) {
    await removeIsolatedDatabase()
  }
})

test('does not expose the widget or token to a signed-out user', async ({ page }) => {
  const tokenResponse = await page.request.post(`${baseUrl}/api/feedback/widget-token`, {
    maxRedirects: 0,
  })
  expect(tokenResponse.status()).toBe(401)

  await page.goto('/')
  await expect(page.locator('#envoy-quackback-widget-sdk')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /feedback/i })).toHaveCount(0)
})

test('serves both boards through the public read-only portal', async ({ page }) => {
  const widgetConfig = await page.request.get(`${feedbackOrigin}/api/widget/config.json`)
  expect(widgetConfig.status()).toBe(200)
  expect(await widgetConfig.json()).toMatchObject({ hmacRequired: true })

  await page.goto(feedbackOrigin, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Bug Reports', { exact: true })).toBeVisible()
  await expect(page.getByText('Feature Requests', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})

test('identifies the Envoy user without another login and cleans up on logout', async ({
  page,
}) => {
  let tokenStatus: number | undefined
  let sdkStatus: number | undefined
  const consoleErrors: string[] = []

  page.on('response', (response) => {
    if (response.url().endsWith('/api/feedback/widget-token')) {
      tokenStatus = response.status()
    }
    if (response.url().includes('/api/widget/sdk.js')) {
      sdkStatus = response.status()
    }
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await login(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#envoy-quackback-widget-sdk')).toBeAttached()
  await expect.poll(() => tokenStatus).toBe(200)
  await expect.poll(() => sdkStatus).toBe(200)

  const frame = await openFeedbackPanel(page)
  const body = await frame.locator('body').innerText()
  expect(body).not.toMatch(/sign in|log in|create account/i)
  expect(body).toMatch(/changelog/i)
  await expect(frame.getByText('AE', { exact: true })).toBeVisible()

  await page
    .getByRole('button', { name: /logout/i })
    .first()
    .click()
  await expect(page.locator('#envoy-quackback-widget-sdk')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /feedback/i })).toHaveCount(0)
  expect(consoleErrors).toEqual([])
})

test('renders both authenticated feedback boards after verified identity', async ({ page }) => {
  await login(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  const frame = await openFeedbackPanel(page)
  await frame.getByText('Suggest a feature', { exact: true }).first().click()
  await frame.getByPlaceholder("What's your idea?").fill('Live board-selection integration check')

  const boardSelector = frame.getByRole('combobox')
  await expect(boardSelector).toBeVisible()
  await boardSelector.click()
  await expect(frame.getByRole('option', { name: 'Feature Requests' })).toBeVisible()
  await expect(frame.getByRole('option', { name: 'Bug Reports' })).toBeVisible()
  await frame.getByRole('option', { name: 'Feature Requests' }).click()
  expect(await frame.locator('body').innerText()).not.toMatch(/posting anonymously/i)

  await expect(frame.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled()
})

test('isolates a Quackback SDK outage from the Envoy page', async ({ page }) => {
  let tokenStatus: number | undefined
  page.on('response', (response) => {
    if (response.url().endsWith('/api/feedback/widget-token')) {
      tokenStatus = response.status()
    }
  })

  await login(page)
  await page.route(`${feedbackOrigin}/api/widget/sdk.js`, (route) => route.abort('failed'))
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  await expect.poll(() => tokenStatus).toBe(200)
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('#envoy-quackback-widget-sdk')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /feedback/i })).toHaveCount(0)
})
