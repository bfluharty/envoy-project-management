import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import AuthController from '#controllers/web/auth_controller'
import User from '#models/user'
import UserInboxConnection from '#models/user_inbox_connection'
import EmailAuthorizationConsent from '#models/email_authorization_consent'
import { buildEmailAuthorizationState } from '#services/email_authorization_state_service'
import { decryptConnectionAccessToken } from '#services/oauth_token_encryption_service'

type SocialProvider = 'google' | 'microsoft'

const ENV_VALUES = {
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  MICROSOFT_CLIENT_ID: 'test-microsoft-client-id',
  MICROSOFT_CLIENT_SECRET: 'test-microsoft-client-secret',
  MICROSOFT_TENANT_ID: 'common',
}

function configureSocialEnv() {
  const previousValues = {
    GOOGLE_CLIENT_ID: env.get('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: env.get('GOOGLE_CLIENT_SECRET'),
    MICROSOFT_CLIENT_ID: env.get('MICROSOFT_CLIENT_ID'),
    MICROSOFT_CLIENT_SECRET: env.get('MICROSOFT_CLIENT_SECRET'),
    MICROSOFT_TENANT_ID: env.get('MICROSOFT_TENANT_ID'),
    PASSWORD_AUTH_ENABLED: env.get('PASSWORD_AUTH_ENABLED'),
  }

  env.set('GOOGLE_CLIENT_ID', ENV_VALUES.GOOGLE_CLIENT_ID)
  env.set('GOOGLE_CLIENT_SECRET', ENV_VALUES.GOOGLE_CLIENT_SECRET)
  env.set('MICROSOFT_CLIENT_ID', ENV_VALUES.MICROSOFT_CLIENT_ID)
  env.set('MICROSOFT_CLIENT_SECRET', ENV_VALUES.MICROSOFT_CLIENT_SECRET)
  env.set('MICROSOFT_TENANT_ID', ENV_VALUES.MICROSOFT_TENANT_ID)

  return () => {
    env.set('GOOGLE_CLIENT_ID', previousValues.GOOGLE_CLIENT_ID ?? '')
    env.set('GOOGLE_CLIENT_SECRET', previousValues.GOOGLE_CLIENT_SECRET ?? '')
    env.set('MICROSOFT_CLIENT_ID', previousValues.MICROSOFT_CLIENT_ID ?? '')
    env.set('MICROSOFT_CLIENT_SECRET', previousValues.MICROSOFT_CLIENT_SECRET ?? '')
    env.set('MICROSOFT_TENANT_ID', previousValues.MICROSOFT_TENANT_ID ?? '')
    env.set('PASSWORD_AUTH_ENABLED', previousValues.PASSWORD_AUTH_ENABLED ?? false)
  }
}

function clearSocialEnv() {
  const restore = configureSocialEnv()
  env.set('GOOGLE_CLIENT_ID', '')
  env.set('GOOGLE_CLIENT_SECRET', '')
  env.set('MICROSOFT_CLIENT_ID', '')
  env.set('MICROSOFT_CLIENT_SECRET', '')
  return restore
}

function makeSocialCallbackContext(
  provider: SocialProvider,
  socialUser: Record<string, unknown>,
  intendedUrl?: string
) {
  const sessionValues = new Map<string, unknown>()
  const flashes = new Map<string, string>()
  let loggedInUser: User | null = null
  let stateParam = ''

  if (intendedUrl) {
    sessionValues.set('auth.intended_url', intendedUrl)
  }

  const ctx = {
    ally: {
      use(requestedProvider: SocialProvider) {
        assert.equal(requestedProvider, provider)
        const driver = {
          stateless: () => driver,
          accessDenied: () => false,
          stateMisMatch: () => false,
          hasError: () => false,
          getError: () => null,
          user: async () => socialUser,
        }
        return driver
      },
    },
    auth: {
      use(guard: string) {
        assert.equal(guard, 'web')
        return {
          login: async (user: User) => {
            loggedInUser = user
          },
        }
      },
    },
    request: {
      params: () => ({ provider }),
      input: (key: string, defaultValue?: unknown) => (key === 'state' ? stateParam : defaultValue),
      ip: () => '127.0.0.1',
      header: (key: string) => (key.toLowerCase() === 'user-agent' ? 'test-agent' : null),
    },
    response: {
      redirect(path?: string) {
        if (path) {
          return { type: 'path', path }
        }

        return {
          toRoute(route: string) {
            return { type: 'route', route }
          },
        }
      },
    },
    session: {
      get: (key: string) => sessionValues.get(key),
      put: (key: string, value: unknown) => sessionValues.set(key, value),
      forget: (key: string) => sessionValues.delete(key),
      flash: (key: string, value: string) => flashes.set(key, value),
    },
  } as unknown as HttpContext

  stateParam = buildEmailAuthorizationState(ctx.session, {
    provider,
    flow: 'registration',
    termsAccepted: true,
    accountType: 'consumer',
    returnPath: intendedUrl,
  })

  return {
    ctx,
    sessionValues,
    flashes,
    get loggedInUser() {
      return loggedInUser
    },
  }
}

test.group('social auth routes', () => {
  test('login page exposes configured social providers', async ({ client }) => {
    const restoreEnv = configureSocialEnv()

    try {
      const response = await client.get('/login').withInertia()

      response.assertOk()
      response.assertBodyContains({
        component: 'auth/login',
        props: {
          socialAuthProviders: [
            { provider: 'google', label: 'Google', href: '/auth/google' },
            { provider: 'microsoft', label: 'Microsoft', href: '/auth/microsoft' },
          ],
          passwordAuthEnabled: false,
        },
      })
    } finally {
      restoreEnv()
    }
  })

  test('unconfigured social providers redirect back to login', async ({ client }) => {
    const restoreEnv = clearSocialEnv()

    try {
      const response = await client.get('/auth/google').redirects(0)

      response.assertFound()
      response.assertHeader('location', '/login')
    } finally {
      restoreEnv()
    }
  })

  test('password login and registration are disabled when password auth flag is off', async ({
    client,
  }) => {
    const restoreEnv = configureSocialEnv()
    env.set('PASSWORD_AUTH_ENABLED', false)

    try {
      const loginResponse = await client
        .post('/login')
        .form({ email: 'alice@example.com', password: 'hashedpassword1' })
        .redirects(0)
      loginResponse.assertFound()
      loginResponse.assertHeader('location', '/login')

      const registerResponse = await client
        .post('/register')
        .form({
          fullName: 'Password Disabled',
          email: 'password.disabled@example.com',
          password: 'Password123!',
          passwordConfirmation: 'Password123!',
        })
        .redirects(0)
      registerResponse.assertFound()
      registerResponse.assertHeader('location', '/register')
    } finally {
      await User.query().where('email', 'password.disabled@example.com').delete()
      restoreEnv()
    }
  })

  test('configured social providers redirect to their authorization URL', async ({ client }) => {
    const restoreEnv = configureSocialEnv()

    try {
      const googleResponse = await client.get('/auth/google').redirects(0)
      googleResponse.assertFound()
      assert.match(
        googleResponse.header('location') ?? '',
        /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/
      )
      assert.match(
        googleResponse.header('location') ?? '',
        /redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fauth%2Fgoogle%2Fcallback/
      )

      const microsoftResponse = await client.get('/auth/microsoft').redirects(0)
      microsoftResponse.assertFound()
      assert.match(
        microsoftResponse.header('location') ?? '',
        /^https:\/\/login\.microsoftonline\.com\/common\/oauth2\/v2\.0\/authorize/
      )
      assert.match(
        microsoftResponse.header('location') ?? '',
        /redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fauth%2Fmicrosoft%2Fcallback/
      )
    } finally {
      restoreEnv()
    }
  })

  test('registration provider OAuth requires email authorization acceptance', async ({
    client,
  }) => {
    const restoreEnv = configureSocialEnv()

    try {
      const response = await client.get('/auth/google?flow=registration').redirects(0)

      response.assertFound()
      response.assertHeader('location', '/register')
    } finally {
      restoreEnv()
    }
  })
})

test.group('social auth callback', (group) => {
  const socialEmail = 'social.microsoft@example.com'

  group.each.teardown(async () => {
    await User.query().where('email', socialEmail).delete()
  })

  test('creates user, primary inbox connection, and consent from registration callback', async () => {
    await User.query().where('email', socialEmail).delete()

    const controller = new AuthController()
    const callback = makeSocialCallbackContext(
      'microsoft',
      {
        id: 'microsoft-user-1',
        mail: socialEmail,
        displayName: 'Social Microsoft',
        token: {
          token: 'microsoft-access-token',
          refreshToken: 'microsoft-refresh-token',
          scope: 'openid profile email User.Read Mail.Read Mail.Send',
          expiresIn: 3600,
        },
      },
      '/account'
    )

    const result = await controller.socialCallback(callback.ctx)

    assert.deepEqual(result, { type: 'path', path: '/account' })
    assert.equal(callback.loggedInUser?.email, socialEmail)
    assert.equal(callback.sessionValues.get('auth.login_method'), 'microsoft')
    assert.equal(callback.sessionValues.has('auth.intended_url'), false)
    assert.equal(callback.flashes.get('success'), 'Welcome!')

    const user = await User.findByOrFail('email', socialEmail)
    assert.equal(user.fullName, 'Social Microsoft')
    assert.equal(user.providerId, 'microsoft-user-1')

    const connection = await UserInboxConnection.query()
      .where('user_uuid', user.uuid)
      .where('provider', 'microsoft')
      .where('email', socialEmail)
      .firstOrFail()
    assert.equal(connection.status, 'active')
    assert.equal(connection.isPrimary, true)
    assert.equal(connection.providerUserId, 'microsoft-user-1')
    assert.equal(decryptConnectionAccessToken(connection), 'microsoft-access-token')

    const consent = await EmailAuthorizationConsent.query()
      .where('user_uuid', user.uuid)
      .where('provider', 'microsoft')
      .firstOrFail()
    assert.equal(consent.email, socialEmail)
    assert.equal(consent.termsVersion, '2026-06-26-email-access-v1')
  })
})
