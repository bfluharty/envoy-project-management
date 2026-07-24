import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import UserConsentService from '#services/user_consent_service'
import { normalizePostAuthReturnPath } from '#services/post_auth_redirect_service'
import { expectsJsonResponse } from '#utils/request_mode'

export default class ConsentRequiredMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { incompleteStatus?: 403 | 428 } = {}) {
    const user = ctx.auth.getUserOrFail()
    const preference = await UserConsentService.ensurePreference(user.uuid, user.uuid)

    if (preference.termsAccepted && !UserConsentService.requiresPrivacyAcknowledgment(preference)) {
      return next()
    }

    const requestUrl = ctx.request.url()
    const jsonResponse = expectsJsonResponse(ctx.request)
    if (!jsonResponse && ctx.request.method() === 'GET') {
      const intendedUrl = normalizePostAuthReturnPath(requestUrl)
      if (intendedUrl) {
        ctx.session.put('auth.intended_url', intendedUrl)
      }
    }

    if (jsonResponse) {
      return ctx.response.status(options.incompleteStatus ?? 428).send({
        code: 'CONSENT_REQUIRED',
        message: preference.termsAccepted
          ? "Acknowledge Envoy's updated Privacy Policy before continuing."
          : "Accept Envoy's Terms of Service before continuing.",
        consentUrl: '/onboarding/consent',
      })
    }

    return ctx.response.redirect('/onboarding/consent')
  }
}
