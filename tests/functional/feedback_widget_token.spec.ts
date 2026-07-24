import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import env from '#start/env'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import { acceptConsentForTest } from '#tests/helpers/user_consent'

const WIDGET_SECRET = 'functional-quackback-widget-secret-32-characters-minimum'
const FEEDBACK_ORIGIN = 'https://feedback.hello-envoy.com'

async function createConsumer(label: string, isActive = true) {
  const entitlement = await UserEntitlement.findByOrFail('canonicalName', 'CONSUMER')

  return User.create({
    fullName: `${label} Feedback User`,
    email: `feedback-${label}-${uuidv4()}@example.com`,
    password: 'Password123!',
    entitlementId: entitlement.id,
    isActive,
  })
}

function decodePayload(token: string): Record<string, unknown> {
  const segments = token.split('.')
  assert.equal(segments.length, 3)
  return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >
}

test.group('feedback widget token endpoint', (group) => {
  group.setup(() => testUtils.db().truncate())

  group.each.setup(() => {
    const previousEnabled = env.get('QUACKBACK_ENABLED')
    const previousBaseUrl = env.get('QUACKBACK_BASE_URL')
    const previousSecret = env.get('QUACKBACK_WIDGET_SECRET')
    const previousAppEnv = env.get('APP_ENV')

    env.set('QUACKBACK_ENABLED', true)
    env.set('QUACKBACK_BASE_URL', FEEDBACK_ORIGIN)
    env.set('QUACKBACK_WIDGET_SECRET', WIDGET_SECRET)

    return () => {
      env.set('QUACKBACK_ENABLED', previousEnabled ?? false)
      env.set('QUACKBACK_BASE_URL', previousBaseUrl ?? '')
      env.set('QUACKBACK_WIDGET_SECRET', previousSecret ?? '')
      env.set('APP_ENV', previousAppEnv)
    }
  })

  test('returns 401 to a guest', async ({ client }) => {
    const response = await client.post('/api/feedback/widget-token').json({})

    response.assertStatus(401)
    assert.equal(JSON.stringify(response.body()).includes(WIDGET_SECRET), false)
  })

  test('returns 403 until the authenticated user completes current consent', async ({ client }) => {
    const user = await createConsumer('consent')
    const response = await client.post('/api/feedback/widget-token').loginAs(user).json({})

    response.assertStatus(403)
    response.assertBodyContains({ code: 'CONSENT_REQUIRED' })
  })

  test('returns a no-store token using only authenticated server identity', async ({ client }) => {
    const user = await acceptConsentForTest(await createConsumer('eligible'))
    const response = await client.post('/api/feedback/widget-token').loginAs(user).json({
      uuid: 'attacker-controlled-uuid',
      email: 'attacker@example.com',
      name: 'Attacker',
    })

    response.assertOk()
    response.assertHeader('cache-control', 'no-store, private')
    response.assertHeader('pragma', 'no-cache')

    const body = response.body() as { ssoToken: string }
    assert.equal(typeof body.ssoToken, 'string')
    const payload = decodePayload(body.ssoToken)
    assert.equal(payload.sub, user.uuid)
    assert.equal(payload.email, user.email.toLowerCase())
    assert.equal(payload.name, user.fullName)
    assert.notEqual(payload.sub, 'attacker-controlled-uuid')
    assert.notEqual(payload.email, 'attacker@example.com')
    assert.equal(JSON.stringify(body).includes(WIDGET_SECRET), false)
  })

  test('rejects a foreign browser origin', async ({ client }) => {
    const user = await acceptConsentForTest(await createConsumer('origin'))
    const response = await client
      .post('/api/feedback/widget-token')
      .loginAs(user)
      .header('origin', 'https://attacker.example')
      .json({})

    response.assertStatus(403)
    response.assertBodyContains({ code: 'INVALID_REQUEST_ORIGIN' })
  })

  test('returns 403 for an inactive authenticated account', async ({ client }) => {
    const user = await acceptConsentForTest(await createConsumer('inactive', false))
    const response = await client.post('/api/feedback/widget-token').loginAs(user).json({})

    response.assertStatus(403)
    response.assertBodyContains({ code: 'FEEDBACK_INELIGIBLE' })
  })

  test('returns a controlled 404 while the feature is disabled', async ({ client }) => {
    const user = await acceptConsentForTest(await createConsumer('disabled'))
    env.set('QUACKBACK_ENABLED', false)

    const response = await client.post('/api/feedback/widget-token').loginAs(user).json({})

    response.assertStatus(404)
    response.assertBodyContains({ code: 'FEEDBACK_DISABLED' })
  })

  test('returns a generic 503 for invalid runtime configuration', async ({ client }) => {
    const user = await acceptConsentForTest(await createConsumer('invalid-config'))
    env.set('QUACKBACK_WIDGET_SECRET', 'short')

    const response = await client.post('/api/feedback/widget-token').loginAs(user).json({})

    response.assertStatus(503)
    response.assertBodyContains({ code: 'FEEDBACK_UNAVAILABLE' })
    assert.equal(JSON.stringify(response.body()).includes('short'), false)
  })

  test('limits a user to 30 successful token requests per five minutes in production', async ({
    client,
  }) => {
    const user = await acceptConsentForTest(await createConsumer('rate-limit'))
    env.set('APP_ENV', 'prod')

    for (let requestNumber = 1; requestNumber <= 30; requestNumber++) {
      const response = await client.post('/api/feedback/widget-token').loginAs(user).json({})
      response.assertOk()
    }

    const limitedResponse = await client.post('/api/feedback/widget-token').loginAs(user).json({})
    limitedResponse.assertStatus(429)
    limitedResponse.assertBodyContains({ code: 'FEEDBACK_RATE_LIMITED' })
    assert.ok(Number(limitedResponse.header('retry-after')) >= 1)
  })
})

test.group('feedback widget shared configuration', (group) => {
  group.setup(() => testUtils.db().truncate())

  group.each.setup(() => {
    const previousEnabled = env.get('QUACKBACK_ENABLED')
    const previousBaseUrl = env.get('QUACKBACK_BASE_URL')
    const previousSecret = env.get('QUACKBACK_WIDGET_SECRET')

    env.set('QUACKBACK_ENABLED', true)
    env.set('QUACKBACK_BASE_URL', FEEDBACK_ORIGIN)
    env.set('QUACKBACK_WIDGET_SECRET', WIDGET_SECRET)

    return () => {
      env.set('QUACKBACK_ENABLED', previousEnabled ?? false)
      env.set('QUACKBACK_BASE_URL', previousBaseUrl ?? '')
      env.set('QUACKBACK_WIDGET_SECRET', previousSecret ?? '')
    }
  })

  test('shares only the public origin on an eligible authenticated page', async ({ client }) => {
    const user = await acceptConsentForTest(await createConsumer('shared-eligible'))
    const response = await client.get('/dashboard').loginAs(user).withInertia()

    response.assertOk()
    assert.deepEqual(response.body().props.feedbackWidget, {
      enabled: true,
      baseUrl: FEEDBACK_ORIGIN,
    })
    assert.equal(
      JSON.stringify(response.body().props.feedbackWidget).includes(WIDGET_SECRET),
      false
    )
  })

  test('does not share widget configuration before required consent', async ({ client }) => {
    const user = await createConsumer('shared-consent')
    const response = await client.get('/onboarding/consent').loginAs(user).withInertia()

    response.assertOk()
    assert.equal(response.body().props.feedbackWidget, null)
  })

  test('does not share widget configuration when the kill switch is disabled', async ({
    client,
  }) => {
    const user = await acceptConsentForTest(await createConsumer('shared-disabled'))
    env.set('QUACKBACK_ENABLED', false)

    const response = await client.get('/dashboard').loginAs(user).withInertia()

    response.assertOk()
    assert.equal(response.body().props.feedbackWidget, null)
  })

  test('does not share widget configuration on a public route', async ({ client }) => {
    const response = await client.get('/').withInertia()

    response.assertOk()
    assert.equal(response.body().props.feedbackWidget, null)
  })
})
