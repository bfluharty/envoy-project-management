import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import UserEntitlement from '#models/user_entitlement'
import UserInboxConnection from '#models/user_inbox_connection'
import {
  encryptOauthToken,
  OAUTH_TOKEN_ENCRYPTION_VERSION,
} from '#services/oauth_token_encryption_service'

async function createConsumer() {
  const entitlement = await UserEntitlement.findByOrFail('canonicalName', 'CONSUMER')
  return User.create({
    fullName: 'Active Inbox Consumer',
    email: `active-inbox-${uuidv4()}@example.com`,
    password: 'Password123!',
    entitlementId: entitlement.id,
    isActive: true,
  })
}

async function createActivePrimaryInbox(user: User) {
  return UserInboxConnection.create({
    userUuid: user.uuid,
    provider: 'gmail',
    email: user.email,
    accessToken: encryptOauthToken('access-token'),
    refreshToken: encryptOauthToken('refresh-token'),
    accessTokenExpiresAt: DateTime.utc().plus({ hour: 1 }),
    scopes:
      'openid https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
    status: 'active',
    isPrimary: true,
    providerUserId: 'google-user-1',
    tokenEncryptionVersion: OAUTH_TOKEN_ENCRYPTION_VERSION,
    watchStatus: 'not_configured',
  })
}

test.group('active inbox middleware', (group) => {
  group.setup(() => testUtils.db().truncate())

  test('allows the dashboard without an active primary inbox', async ({ client }) => {
    const user = await createConsumer()

    const response = await client.get('/dashboard').loginAs(user).withInertia()

    response.assertOk()
    response.assertBodyContains({ component: 'home' })
  })

  test('still requires an active primary inbox for outreach operations', async ({ client }) => {
    const user = await createConsumer()

    const response = await client.get(`/api/projects/${uuidv4()}/outreach`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({
      error: 'Envoy requires an active connected email account.',
      reconnectUrl: '/account#email-accounts',
    })
  })

  test('allows authenticated app routes with an active primary inbox', async ({ client }) => {
    const user = await createConsumer()
    await createActivePrimaryInbox(user)

    const response = await client.get('/dashboard').loginAs(user).withInertia()

    response.assertOk()
    response.assertBodyContains({
      component: 'home',
    })
  })
})
