import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { normalizeSocialUser, resolvePostLoginRedirect } from '#controllers/web/auth_controller'

test.group('social auth helpers', () => {
  test('normalizes Google Ally profiles', () => {
    const profile = normalizeSocialUser('google', {
      id: 'google-user-1',
      email: 'google.user@example.com',
      name: 'Google User',
      avatarUrl: 'https://example.com/avatar.png',
      emailVerificationState: 'verified',
    })

    assert.deepEqual(profile, {
      provider: 'google',
      providerUserId: 'google-user-1',
      email: 'google.user@example.com',
      fullName: 'Google User',
      avatarUrl: 'https://example.com/avatar.png',
      emailVerificationState: 'verified',
    })
  })

  test('normalizes Microsoft Graph profiles', () => {
    const profile = normalizeSocialUser('microsoft', {
      id: 'microsoft-user-1',
      mail: null,
      userPrincipalName: 'microsoft.user@example.com',
      displayName: 'Microsoft User',
    })

    assert.deepEqual(profile, {
      provider: 'microsoft',
      providerUserId: 'microsoft-user-1',
      email: 'microsoft.user@example.com',
      fullName: 'Microsoft User',
      avatarUrl: null,
      emailVerificationState: 'unsupported',
    })
  })

  test('rejects social profiles without provider id or email', () => {
    assert.throws(
      () => normalizeSocialUser('google', { id: 'google-user-1' }),
      /Google did not return a usable profile/
    )
    assert.throws(
      () => normalizeSocialUser('microsoft', { userPrincipalName: 'microsoft.user@example.com' }),
      /Microsoft did not return a usable profile/
    )
  })

  test('keeps real intended URLs and blocks avatar proxy URLs', () => {
    assert.equal(resolvePostLoginRedirect('/account'), '/account')
    assert.equal(resolvePostLoginRedirect('/account#email-accounts'), '/account#email-accounts')
    assert.equal(resolvePostLoginRedirect('/dashboard'), '/dashboard')
    assert.equal(resolvePostLoginRedirect('/account/avatar/google'), null)
    assert.equal(resolvePostLoginRedirect('/account/avatar/google?size=64'), null)
    assert.equal(resolvePostLoginRedirect(null), null)
  })
})
