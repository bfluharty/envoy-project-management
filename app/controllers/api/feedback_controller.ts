import { createHash } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { getQuackbackConfig } from '#config/quackback'
import QuackbackWidgetTokenService, {
  QuackbackDisabledError,
  QuackbackIneligibleUserError,
} from '#services/quackback_widget_token_service'
import RateLimitService, { RateLimitExceededError } from '#services/rate_limit_service'
import { QuackbackConfigurationError } from '#utils/quackback_config'

const TOKEN_LIMIT = 30
const TOKEN_LIMIT_WINDOW_SECONDS = 5 * 60

function tokenBucketKey(userUuid: string): string {
  const anonymousUserKey = createHash('sha256').update(userUuid).digest('hex')
  return `feedback:widget-token:${anonymousUserKey}`
}

export default class FeedbackController {
  public async widgetToken({ auth, response }: HttpContext) {
    response.header('Cache-Control', 'no-store, private')
    response.header('Pragma', 'no-cache')

    const user = auth.getUserOrFail()

    try {
      const config = getQuackbackConfig()
      if (!config.enabled) {
        return response.status(404).send({
          code: 'FEEDBACK_DISABLED',
          message: 'Feedback is unavailable.',
        })
      }

      if (!user.isActive) {
        return response.status(403).send({
          code: 'FEEDBACK_INELIGIBLE',
          message: 'This account is not eligible for feedback.',
        })
      }

      await RateLimitService.enforce([
        {
          name: 'feedback_widget_token',
          bucketKey: tokenBucketKey(user.uuid),
          limit: TOKEN_LIMIT,
          windowSeconds: TOKEN_LIMIT_WINDOW_SECONDS,
        },
      ])

      // Identity is sourced exclusively from the authenticated model. The request body is
      // intentionally never read.
      const ssoToken = new QuackbackWidgetTokenService().issue(user, { config })
      return response.ok({ ssoToken })
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        response.header('Retry-After', String(error.retryAfterSeconds))
        return response.status(429).send({
          code: 'FEEDBACK_RATE_LIMITED',
          message: 'Feedback is temporarily unavailable.',
        })
      }

      if (error instanceof QuackbackDisabledError) {
        return response.status(404).send({
          code: 'FEEDBACK_DISABLED',
          message: 'Feedback is unavailable.',
        })
      }

      if (error instanceof QuackbackIneligibleUserError) {
        return response.status(403).send({
          code: 'FEEDBACK_INELIGIBLE',
          message: 'This account is not eligible for feedback.',
        })
      }

      if (error instanceof QuackbackConfigurationError) {
        return response.status(503).send({
          code: 'FEEDBACK_UNAVAILABLE',
          message: 'Feedback is temporarily unavailable.',
        })
      }

      // Quackback is optional. An issuance dependency failure must not affect the rest of Envoy.
      return response.status(503).send({
        code: 'FEEDBACK_UNAVAILABLE',
        message: 'Feedback is temporarily unavailable.',
      })
    }
  }
}
