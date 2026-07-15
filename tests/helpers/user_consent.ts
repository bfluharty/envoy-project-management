import User from '#models/user'
import UserConsentService from '#services/user_consent_service'

/**
 * Marks a fixture user as fully onboarded without bypassing production consent persistence.
 * Use only when consent is not the behavior under test.
 */
export async function acceptConsentForTest<T extends User>(
  user: T,
  modelTrainingOptIn = false
): Promise<T> {
  await UserConsentService.completeOnboarding({
    userUuid: user.uuid,
    termsAccepted: true,
    modelTrainingOptIn,
    actorUserUuid: user.uuid,
    ipAddress: null,
    userAgent: 'test-fixture',
  })

  return user
}
