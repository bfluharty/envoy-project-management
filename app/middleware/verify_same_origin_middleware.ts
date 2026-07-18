import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'

function configuredOrigin(request: HttpContext['request']): string | null {
  const appUrl = env.get('APP_URL')
  if (appUrl) {
    try {
      return new URL(appUrl).origin
    } catch {
      return null
    }
  }

  const host = request.header('x-forwarded-host')?.split(',', 1)[0] ?? request.header('host')
  if (!host) return null
  const protocol = request.header('x-forwarded-proto')?.split(',', 1)[0] ?? 'http'

  try {
    return new URL(`${protocol}://${host}`).origin
  } catch {
    return null
  }
}

/**
 * CSRF protection for session-authenticated consent writes. Browsers send Origin on these POST
 * and fetch requests; Sec-Fetch-Site supplies a second fail-closed signal. Requests from trusted
 * non-browser clients without either browser header remain supported.
 */
export default class VerifySameOriginMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const expectedOrigin = configuredOrigin(request)
    const suppliedOrigin = request.header('origin')
    const fetchSite = request.header('sec-fetch-site')?.toLowerCase()

    if (suppliedOrigin) {
      let normalizedOrigin: string | null = null
      try {
        normalizedOrigin = new URL(suppliedOrigin).origin
      } catch {
        // Leave the origin invalid and reject it below.
      }

      if (!expectedOrigin || normalizedOrigin !== expectedOrigin) {
        return response.status(403).send({
          code: 'INVALID_REQUEST_ORIGIN',
          message: 'This request did not originate from Envoy.',
        })
      }
    } else if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      return response.status(403).send({
        code: 'INVALID_REQUEST_ORIGIN',
        message: 'This request did not originate from Envoy.',
      })
    }

    return next()
  }
}
