import type { HttpContext } from '@adonisjs/core/http'
import {
  CURRENT_MODEL_TRAINING_NOTICE_VERSION,
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
} from '#constants/user_consent'
import PostAuthRedirectService from '#services/post_auth_redirect_service'
import UserConsentService from '#services/user_consent_service'
import { completeUserConsentValidator } from '#validators/user_consent_validator'

export default class OnboardingConsentController {
  async show({ auth, inertia, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const preference = await UserConsentService.ensurePreference(user.uuid, user.uuid)
    const privacyReackOnly = UserConsentService.requiresPrivacyAcknowledgment(preference)

    if (preference.termsAccepted && !privacyReackOnly) {
      return response.redirect(await PostAuthRedirectService.resolve(user, session))
    }

    return inertia.render('onboarding/consent', {
      termsVersion: CURRENT_TERMS_VERSION,
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      modelTrainingNoticeVersion: CURRENT_MODEL_TRAINING_NOTICE_VERSION,
      privacyReackOnly,
    })
  }

  async store({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(completeUserConsentValidator)

    if (!data.termsAccepted) {
      return response.status(422).send({
        errors: {
          termsAccepted: ['You must accept the Terms of Service before continuing.'],
        },
      })
    }

    const preference = await UserConsentService.ensurePreference(user.uuid, user.uuid)
    const metadata = {
      userUuid: user.uuid,
      actorUserUuid: user.uuid,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
    }

    if (preference.termsAccepted) {
      await UserConsentService.acknowledgePrivacyPolicy(metadata)
    } else {
      await UserConsentService.completeOnboarding({
        ...metadata,
        termsAccepted: data.termsAccepted,
        modelTrainingOptIn: data.modelTrainingOptIn,
      })
    }

    session.flash('success', 'Your privacy choices have been saved.')
    return response.redirect(await PostAuthRedirectService.resolve(user, session))
  }
}
