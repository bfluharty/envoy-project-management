import { createHmac } from 'node:crypto'
import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import QuackbackWidgetTokenService, {
  QUACKBACK_WIDGET_TOKEN_TTL_SECONDS,
} from '#services/quackback_widget_token_service'
import {
  isFeedbackWidgetRouteAllowed,
  QuackbackConfigurationError,
  resolveQuackbackConfig,
} from '#utils/quackback_config'

const WIDGET_SECRET = 'test-quackback-widget-secret-32-characters-minimum'
const USER_UUID = 'f8c94f61-ff70-4281-b059-665e920f791c'

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>
}

test.group('Quackback widget token service', () => {
  test('creates a five-minute HS256 JWT with the minimum identity claims', () => {
    const now = new Date('2026-07-23T12:00:00.000Z')
    const token = new QuackbackWidgetTokenService().issue(
      {
        uuid: USER_UUID,
        email: '  Person@Example.COM ',
        fullName: '  Example Person  ',
        isActive: true,
      },
      {
        now,
        config: resolveQuackbackConfig({
          enabled: true,
          baseUrl: 'https://feedback.hello-envoy.com',
          widgetSecret: WIDGET_SECRET,
        }),
      }
    )

    const segments = token.split('.')
    assert.equal(segments.length, 3)
    assert.deepEqual(decodeSegment(segments[0]), {
      alg: 'HS256',
      typ: 'JWT',
    })

    const payload = decodeSegment(segments[1])
    const issuedAt = Math.floor(now.getTime() / 1000)
    assert.deepEqual(payload, {
      sub: USER_UUID,
      email: 'person@example.com',
      name: 'Example Person',
      iat: issuedAt,
      exp: issuedAt + QUACKBACK_WIDGET_TOKEN_TTL_SECONDS,
    })
    assert.equal((payload.exp as number) - (payload.iat as number), 300)

    const expectedSignature = createHmac('sha256', WIDGET_SECRET)
      .update(`${segments[0]}.${segments[1]}`)
      .digest('base64url')
    assert.equal(segments[2], expectedSignature)
  })

  test('omits an empty display name', () => {
    const token = new QuackbackWidgetTokenService().issue(
      {
        uuid: USER_UUID,
        email: 'person@example.com',
        fullName: '   ',
        isActive: true,
      },
      {
        config: resolveQuackbackConfig({
          enabled: true,
          baseUrl: 'https://feedback.hello-envoy.com',
          widgetSecret: WIDGET_SECRET,
        }),
      }
    )

    const payload = decodeSegment(token.split('.')[1])
    assert.equal(Object.hasOwn(payload, 'name'), false)
  })

  test('rejects enabled configuration with a short secret', () => {
    assert.throws(
      () =>
        resolveQuackbackConfig({
          enabled: true,
          baseUrl: 'https://feedback.hello-envoy.com',
          widgetSecret: 'too-short',
        }),
      QuackbackConfigurationError
    )
  })

  test('requires an exact origin without a path or trailing slash', () => {
    for (const baseUrl of [
      'https://feedback.hello-envoy.com/',
      'https://feedback.hello-envoy.com/portal',
      'javascript:alert(1)',
    ]) {
      assert.throws(
        () =>
          resolveQuackbackConfig({
            enabled: true,
            baseUrl,
            widgetSecret: WIDGET_SECRET,
          }),
        QuackbackConfigurationError
      )
    }
  })

  test('defaults to disabled without requiring public or secret configuration', () => {
    assert.deepEqual(resolveQuackbackConfig({}), {
      enabled: false,
      baseUrl: null,
      widgetSecret: null,
    })
  })

  test('allows only authenticated application page routes', () => {
    assert.equal(isFeedbackWidgetRouteAllowed('/dashboard'), true)
    assert.equal(isFeedbackWidgetRouteAllowed('/projects/project-id?tab=overview'), true)
    assert.equal(isFeedbackWidgetRouteAllowed('/onboarding/project'), true)
    assert.equal(isFeedbackWidgetRouteAllowed('/login'), false)
    assert.equal(isFeedbackWidgetRouteAllowed('/onboarding/consent'), false)
    assert.equal(isFeedbackWidgetRouteAllowed('/errors/not-found'), false)
    assert.equal(isFeedbackWidgetRouteAllowed('/dashboard-imposter'), false)
  })
})
