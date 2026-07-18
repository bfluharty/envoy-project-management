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

  test('keeps safe local intended URLs', () => {
    assert.equal(resolvePostLoginRedirect('/account'), '/account')
    assert.equal(resolvePostLoginRedirect('/account#email-accounts'), '/account#email-accounts')
    assert.equal(resolvePostLoginRedirect('/dashboard'), '/dashboard')
    assert.equal(
      resolvePostLoginRedirect('/projects/project-1?tab=overview'),
      '/projects/project-1?tab=overview'
    )
  })

  test('rejects external, protocol-relative, and redirect-loop intended URLs', () => {
    assert.equal(resolvePostLoginRedirect('https://example.com/account'), null)
    assert.equal(resolvePostLoginRedirect('http://example.com/account'), null)
    assert.equal(resolvePostLoginRedirect('//example.com/account'), null)
    assert.equal(resolvePostLoginRedirect('/\\example.com/account'), null)
    assert.equal(resolvePostLoginRedirect('/%5Cexample.com/account'), null)
    assert.equal(resolvePostLoginRedirect('/dashboard\n/account'), null)
    assert.equal(resolvePostLoginRedirect('dashboard'), null)
    assert.equal(resolvePostLoginRedirect('/login'), null)
    assert.equal(resolvePostLoginRedirect('/register?accountType=consumer'), null)
    assert.equal(resolvePostLoginRedirect('/auth/google'), null)
    assert.equal(resolvePostLoginRedirect('/onboarding/consent'), null)
    assert.equal(resolvePostLoginRedirect('/account/avatar/google'), null)
    assert.equal(resolvePostLoginRedirect('/account/avatar/google?size=64'), null)
    assert.equal(resolvePostLoginRedirect(null), null)
  })
})
