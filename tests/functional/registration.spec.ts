// To test, run 'node ace test --files="tests/functional/registration.spec.ts"`

import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid'
import { DateTime } from 'luxon'
import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'
import env from '#start/env'
import EntitlementService from '#services/entitlement_service'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import OnboardingDraftService from '#services/onboarding_draft_service'
import UserEntitlement from '#models/user_entitlement'

const NEW_EMAIL = 'registration.test.new@example.com'
const DUPLICATE_EMAIL = 'registration.test.existing@example.com'
const BODY_ONBOARDING_EMAIL = 'registration.test.body.onboarding@example.com'
const SESSION_ONBOARDING_EMAIL = 'registration.test.session.onboarding@example.com'
const PRECEDENCE_EMAIL = 'registration.test.precedence@example.com'
const EXPIRED_TOKEN_EMAIL = 'registration.test.expired@example.com'
const INVALID_TOKEN_EMAIL = 'registration.test.invalid@example.com'
const QUERY_TOKEN_EMAIL = 'registration.test.query@example.com'
const VENDOR_EMAIL = 'registration.test.vendor@example.com'
const CONSUMER_LOGIN_EMAIL = 'registration.test.consumer.login@example.com'
const VENDOR_LOGIN_EMAIL = 'registration.test.vendor.login@example.com'
const GENERAL_ERROR_EMAIL = 'registration.test.general.error@example.com'
const VALID_PASSWORD = 'Password123!'

function setCookieHeader(response: any) {
  const value = response.header('set-cookie')
  return Array.isArray(value) ? value.join('; ') : (value ?? '')
}

test.group('registration', (group) => {
  group.setup(() => testUtils.db().truncate())

  group.each.setup(() => {
    const previousValue = env.get('PASSWORD_AUTH_ENABLED')
    env.set('PASSWORD_AUTH_ENABLED', true)

    return () => {
      env.set('PASSWORD_AUTH_ENABLED', previousValue ?? false)
    }
  })

  test('happy path: new email creates account, logs in, and redirects to dashboard', async ({
    client,
  }) => {
    await User.query().where('email', NEW_EMAIL).delete()

    try {
      const response = await client
        .post('/register')
        .form({
          fullName: 'New Test User',
          email: NEW_EMAIL,
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
        })
        .redirects(0)

      response.assertFound()
      response.assertHeader('location', '/dashboard')
      assert.match(setCookieHeader(response), /HttpOnly/i)

      const created = await User.findBy('email', NEW_EMAIL)
      assert.ok(created, 'user record should exist in the database after successful registration')
      const entitlement = await UserEntitlement.findOrFail(created.entitlementId)
      assert.equal(entitlement.canonicalName, 'CONSUMER')
    } finally {
      await User.query().where('email', NEW_EMAIL).delete()
    }
  })

  test('consumer registration associates a body onboarding token and redirects to onboarding project', async ({
    client,
  }) => {
    await User.query().where('email', BODY_ONBOARDING_EMAIL).delete()
    const { tokenUuid, draft } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a commercial electrician for a new restaurant.',
      postalCode: '23230',
      anonymousSessionUuid: uuidv4(),
    })

    try {
      const response = await client
        .post('/register')
        .form({
          fullName: 'Body Token User',
          email: BODY_ONBOARDING_EMAIL,
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
          onboardingToken: tokenUuid,
        })
        .redirects(0)

      response.assertFound()
      response.assertHeader('location', '/onboarding/project')

      const created = await User.findByOrFail('email', BODY_ONBOARDING_EMAIL)
      const reloadedDraft = await AnonymousOnboardingDraft.findOrFail(draft.id)
      assert.equal(reloadedDraft.registeredUserUuid, created.uuid)
    } finally {
      await AnonymousOnboardingDraft.query().where('token_uuid', tokenUuid).delete()
      await User.query().where('email', BODY_ONBOARDING_EMAIL).delete()
    }
  })

  test('consumer registration associates a session handoff token and redirects to onboarding project', async ({
    client,
  }) => {
    await User.query().where('email', SESSION_ONBOARDING_EMAIL).delete()
    const { tokenUuid, draft } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a commercial electrician for a new restaurant.',
      postalCode: '23230',
      anonymousSessionUuid: uuidv4(),
    })

    try {
      const handoffResponse = await client
        .post('/onboarding/registration-handoff')
        .json({ onboardingToken: tokenUuid })

      handoffResponse.assertOk()

      const response = await client
        .post('/register')
        .withSession(handoffResponse.session())
        .form({
          fullName: 'Onboarding Test User',
          email: SESSION_ONBOARDING_EMAIL,
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
        })
        .redirects(0)

      response.assertFound()
      response.assertHeader('location', '/onboarding/project')

      const created = await User.findByOrFail('email', SESSION_ONBOARDING_EMAIL)
      const reloadedDraft = await AnonymousOnboardingDraft.findOrFail(draft.id)
      assert.equal(reloadedDraft.registeredUserUuid, created.uuid)
    } finally {
      await AnonymousOnboardingDraft.query().where('token_uuid', tokenUuid).delete()
      await User.query().where('email', SESSION_ONBOARDING_EMAIL).delete()
    }
  })

  test('consumer login associates a session handoff token and resumes onboarding', async ({
    client,
  }) => {
    const entitlementId = await EntitlementService.getIdByCanonicalName('CONSUMER')
    const user = await User.create({
      fullName: 'Returning Consumer',
      email: CONSUMER_LOGIN_EMAIL,
      password: VALID_PASSWORD,
      entitlementId,
      isActive: true,
    })
    const { tokenUuid, draft } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a commercial electrician for a new restaurant.',
      postalCode: '23230',
      anonymousSessionUuid: uuidv4(),
    })

    try {
      const handoffResponse = await client
        .post('/onboarding/registration-handoff')
        .json({ onboardingToken: tokenUuid })

      const response = await client
        .post('/login')
        .withSession(handoffResponse.session())
        .form({ email: CONSUMER_LOGIN_EMAIL, password: VALID_PASSWORD })
        .redirects(0)

      response.assertFound()
      response.assertHeader('location', '/onboarding/project')

      const reloadedDraft = await AnonymousOnboardingDraft.findOrFail(draft.id)
      assert.equal(reloadedDraft.registeredUserUuid, user.uuid)
    } finally {
      await AnonymousOnboardingDraft.query().where('token_uuid', tokenUuid).delete()
      await User.query().where('email', CONSUMER_LOGIN_EMAIL).delete()
    }
  })

  test('vendor login discards a consumer onboarding handoff and routes to vendor pending', async ({
    client,
  }) => {
    const entitlementId = await EntitlementService.getIdByCanonicalName('VENDOR')
    await User.create({
      fullName: 'Returning Vendor',
      email: VENDOR_LOGIN_EMAIL,
      password: VALID_PASSWORD,
      entitlementId,
      vendorApprovalStatus: 'PENDING',
      isActive: true,
    })
    const { tokenUuid, draft } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a commercial electrician for a new restaurant.',
      postalCode: '23230',
      anonymousSessionUuid: uuidv4(),
    })

    try {
      const handoffResponse = await client
        .post('/onboarding/registration-handoff')
        .json({ onboardingToken: tokenUuid })

      const response = await client
        .post('/login')
        .withSession(handoffResponse.session())
        .form({ email: VENDOR_LOGIN_EMAIL, password: VALID_PASSWORD })
        .redirects(0)

      response.assertFound()
      response.assertHeader('location', '/vendor/pending')

      const reloadedDraft = await AnonymousOnboardingDraft.findOrFail(draft.id)
      assert.equal(reloadedDraft.registeredUserUuid, null)
    } finally {
      await AnonymousOnboardingDraft.query().where('token_uuid', tokenUuid).delete()
      await User.query().where('email', VENDOR_LOGIN_EMAIL).delete()
    }
  })

  test('body onboarding token takes precedence over a session onboarding token', async ({
    client,
  }) => {
    await User.query().where('email', PRECEDENCE_EMAIL).delete()
    const sessionDraft = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a painter for a retail space.',
      postalCode: '23231',
      anonymousSessionUuid: uuidv4(),
    })
    const bodyDraft = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a plumber for a restaurant kitchen.',
      postalCode: '23232',
      anonymousSessionUuid: uuidv4(),
    })

    try {
      const handoffResponse = await client
        .post('/onboarding/registration-handoff')
        .json({ onboardingToken: sessionDraft.tokenUuid })

      handoffResponse.assertOk()

      const response = await client
        .post('/register')
        .withSession(handoffResponse.session())
        .form({
          fullName: 'Precedence Test User',
          email: PRECEDENCE_EMAIL,
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
          onboardingToken: bodyDraft.tokenUuid,
        })
        .redirects(0)

      response.assertFound()
      response.assertHeader('location', '/onboarding/project')

      const created = await User.findByOrFail('email', PRECEDENCE_EMAIL)
      const reloadedSessionDraft = await AnonymousOnboardingDraft.findOrFail(sessionDraft.draft.id)
      const reloadedBodyDraft = await AnonymousOnboardingDraft.findOrFail(bodyDraft.draft.id)
      assert.equal(reloadedBodyDraft.registeredUserUuid, created.uuid)
      assert.equal(reloadedSessionDraft.registeredUserUuid, null)
    } finally {
      await AnonymousOnboardingDraft.query()
        .whereIn('token_uuid', [sessionDraft.tokenUuid, bodyDraft.tokenUuid])
        .delete()
      await User.query().where('email', PRECEDENCE_EMAIL).delete()
    }
  })

  test('registration rejects non-v4 onboarding token values before creating a user', async ({
    client,
  }) => {
    await User.query().where('email', INVALID_TOKEN_EMAIL).delete()

    try {
      const response = await client
        .post('/register')
        .form({
          fullName: 'Invalid Token User',
          email: INVALID_TOKEN_EMAIL,
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
          onboardingToken: uuidv1(),
        })
        .redirects(0)

      response.assertStatus(422)
      const created = await User.findBy('email', INVALID_TOKEN_EMAIL)
      assert.equal(created, null)
    } finally {
      await User.query().where('email', INVALID_TOKEN_EMAIL).delete()
    }
  })

  test('expired onboarding token does not block registration and redirects to dashboard', async ({
    client,
  }) => {
    await User.query().where('email', EXPIRED_TOKEN_EMAIL).delete()
    const { tokenUuid, draft } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need expired token coverage.',
      postalCode: '23233',
      anonymousSessionUuid: uuidv4(),
      expiresAt: DateTime.utc().minus({ minute: 1 }),
    })

    try {
      const response = await client
        .post('/register')
        .form({
          fullName: 'Expired Token User',
          email: EXPIRED_TOKEN_EMAIL,
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
          onboardingToken: tokenUuid,
        })
        .redirects(0)

      response.assertFound()
      response.assertHeader('location', '/dashboard')

      const created = await User.findBy('email', EXPIRED_TOKEN_EMAIL)
      assert.ok(created)
      const reloadedDraft = await AnonymousOnboardingDraft.findOrFail(draft.id)
      assert.equal(reloadedDraft.status, 'EXPIRED')
      assert.equal(reloadedDraft.registeredUserUuid, null)
    } finally {
      await AnonymousOnboardingDraft.query().where('token_uuid', tokenUuid).delete()
      await User.query().where('email', EXPIRED_TOKEN_EMAIL).delete()
    }
  })

  test('registration ignores onboarding tokens from the query string', async ({ client }) => {
    await User.query().where('email', QUERY_TOKEN_EMAIL).delete()
    const { tokenUuid, draft } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need query string token coverage.',
      postalCode: '23234',
      anonymousSessionUuid: uuidv4(),
    })

    try {
      const response = await client
        .post(`/register?onboardingToken=${tokenUuid}`)
        .form({
          fullName: 'Query Token User',
          email: QUERY_TOKEN_EMAIL,
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
        })
        .redirects(0)

      response.assertFound()
      response.assertHeader('location', '/dashboard')

      const reloadedDraft = await AnonymousOnboardingDraft.findOrFail(draft.id)
      assert.equal(reloadedDraft.registeredUserUuid, null)
    } finally {
      await AnonymousOnboardingDraft.query().where('token_uuid', tokenUuid).delete()
      await User.query().where('email', QUERY_TOKEN_EMAIL).delete()
    }
  })

  test('vendor registration creates a pending vendor account and redirects to vendor pending', async ({
    client,
  }) => {
    await User.query().where('email', VENDOR_EMAIL).delete()
    const { tokenUuid, draft } = await OnboardingDraftService.createDraft({
      projectDescription: 'I need a commercial electrician for a new restaurant.',
      postalCode: '23230',
      anonymousSessionUuid: uuidv4(),
    })

    try {
      const handoffResponse = await client
        .post('/onboarding/registration-handoff')
        .json({ onboardingToken: tokenUuid })

      const response = await client
        .post('/register')
        .withSession(handoffResponse.session())
        .form({
          fullName: 'Vendor Test User',
          email: VENDOR_EMAIL,
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
          accountType: 'vendor',
        })
        .redirects(0)

      response.assertFound()
      response.assertHeader('location', '/vendor/pending')

      const created = await User.findByOrFail('email', VENDOR_EMAIL)
      const entitlement = await UserEntitlement.findOrFail(created.entitlementId)
      assert.equal(entitlement.canonicalName, 'VENDOR')
      assert.equal(created.vendorApprovalStatus, 'PENDING')
      const reloadedDraft = await AnonymousOnboardingDraft.findOrFail(draft.id)
      assert.equal(reloadedDraft.registeredUserUuid, null)
    } finally {
      await AnonymousOnboardingDraft.query().where('token_uuid', tokenUuid).delete()
      await User.query().where('email', VENDOR_EMAIL).delete()
    }
  })

  test('sad path: duplicate email re-renders the register page with an error message', async ({
    client,
  }) => {
    const consumerEntitlementId = await EntitlementService.getIdByCanonicalName('CONSUMER')
    const previousGoogleClientId = env.get('GOOGLE_CLIENT_ID')
    const previousGoogleClientSecret = env.get('GOOGLE_CLIENT_SECRET')
    env.set('GOOGLE_CLIENT_ID', 'registration-error-client-id')
    env.set('GOOGLE_CLIENT_SECRET', 'registration-error-client-secret')

    await User.create({
      fullName: 'Existing User',
      email: DUPLICATE_EMAIL,
      password: VALID_PASSWORD,
      isActive: true,
      entitlementId: consumerEntitlementId,
    })

    try {
      const response = await client
        .post('/register')
        .header('X-Inertia', 'true')
        .form({
          fullName: 'Duplicate User',
          email: DUPLICATE_EMAIL,
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
          accountType: 'vendor',
        })
        .redirects(0)

      response.assertStatus(200)
      response.assertBodyContains({
        component: 'auth/register',
        props: {
          flashMessage: {
            type: 'error',
            message: 'An account with that email already exists. Try signing in instead.',
          },
          errors: {
            email: 'An account with this email already exists.',
          },
          accountType: 'vendor',
          socialAuthProviders: [
            {
              provider: 'google',
              label: 'Google',
              href: '/auth/google?flow=registration&accountType=vendor&emailTermsAccepted=1',
            },
          ],
        },
      })
    } finally {
      env.set('GOOGLE_CLIENT_ID', previousGoogleClientId)
      env.set('GOOGLE_CLIENT_SECRET', previousGoogleClientSecret)
      await User.query().where('email', DUPLICATE_EMAIL).delete()
    }
  })

  test('general registration errors preserve vendor selection and registration social options', async ({
    client,
  }) => {
    const originalGetEntitlementId = EntitlementService.getIdByCanonicalName
    const previousGoogleClientId = env.get('GOOGLE_CLIENT_ID')
    const previousGoogleClientSecret = env.get('GOOGLE_CLIENT_SECRET')
    env.set('GOOGLE_CLIENT_ID', 'registration-general-error-client-id')
    env.set('GOOGLE_CLIENT_SECRET', 'registration-general-error-client-secret')
    EntitlementService.getIdByCanonicalName = (async () => {
      throw new Error('forced entitlement lookup failure')
    }) as typeof EntitlementService.getIdByCanonicalName

    try {
      const response = await client
        .post('/register')
        .header('X-Inertia', 'true')
        .form({
          fullName: 'General Error Vendor',
          email: GENERAL_ERROR_EMAIL,
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
          accountType: 'vendor',
        })
        .redirects(0)

      response.assertStatus(200)
      response.assertBodyContains({
        component: 'auth/register',
        props: {
          flashMessage: { type: 'error', message: 'Something went wrong. Please try again.' },
          accountType: 'vendor',
          socialAuthProviders: [
            {
              provider: 'google',
              label: 'Google',
              href: '/auth/google?flow=registration&accountType=vendor&emailTermsAccepted=1',
            },
          ],
        },
      })
      assert.equal(await User.findBy('email', GENERAL_ERROR_EMAIL), null)
    } finally {
      EntitlementService.getIdByCanonicalName = originalGetEntitlementId
      env.set('GOOGLE_CLIENT_ID', previousGoogleClientId)
      env.set('GOOGLE_CLIENT_SECRET', previousGoogleClientSecret)
      await User.query().where('email', GENERAL_ERROR_EMAIL).delete()
    }
  })
})
