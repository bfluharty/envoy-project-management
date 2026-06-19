import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import AuthController from '#controllers/web/auth_controller'
import OnboardingDraftService, {
  ONBOARDING_TOKEN_SESSION_KEY,
  OnboardingDraftError,
} from '#services/onboarding_draft_service'

function makeSession() {
  const forgotten: string[] = []

  return {
    forgotten,
    forget(key: string) {
      forgotten.push(key)
    },
  }
}

test.group('AuthController onboarding association', (group) => {
  const restores: Array<() => void> = []

  group.each.teardown(() => {
    while (restores.length) {
      restores.pop()?.()
    }
  })

  test('clears the session onboarding token after successful association', async () => {
    const originalAssociateDraftToUser = OnboardingDraftService.associateDraftToUser
    const calls: unknown[] = []
    restores.push(() => {
      OnboardingDraftService.associateDraftToUser = originalAssociateDraftToUser
    })
    OnboardingDraftService.associateDraftToUser = (async (token: string, userUuid: string) => {
      calls.push({ token, userUuid })
      return {} as Awaited<ReturnType<typeof OnboardingDraftService.associateDraftToUser>>
    }) as typeof OnboardingDraftService.associateDraftToUser

    const session = makeSession()
    const result = await (new AuthController() as any).associateOnboardingDraftForUser(
      'token-1',
      'user-1',
      session
    )

    assert.equal(result, true)
    assert.deepEqual(calls, [{ token: 'token-1', userUuid: 'user-1' }])
    assert.deepEqual(session.forgotten, [ONBOARDING_TOKEN_SESSION_KEY])
  })

  test('clears the session onboarding token when association fails as missing', async () => {
    const originalAssociateDraftToUser = OnboardingDraftService.associateDraftToUser
    restores.push(() => {
      OnboardingDraftService.associateDraftToUser = originalAssociateDraftToUser
    })
    OnboardingDraftService.associateDraftToUser = (async () => {
      throw new OnboardingDraftError('Onboarding draft not found', 404)
    }) as typeof OnboardingDraftService.associateDraftToUser

    const session = makeSession()
    const result = await (new AuthController() as any).associateOnboardingDraftForUser(
      'token-1',
      'user-1',
      session
    )

    assert.equal(result, false)
    assert.deepEqual(session.forgotten, [ONBOARDING_TOKEN_SESSION_KEY])
  })
})
