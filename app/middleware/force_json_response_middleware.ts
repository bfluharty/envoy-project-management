import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Updating the "Accept" header to accept "application/json" response
 * from the server for API requests, but allow HTML responses for
 * authentication flows and Inertia requests.
 */
export default class ForceJsonResponseMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    const headers = request.headers()

    // Don't force JSON for:
    // 1. Inertia requests (they handle their own response format)
    // 2. Authentication routes (need redirects)
    // 3. Already requesting HTML
    const isInertiaRequest = headers['x-inertia'] === 'true'
    const isAuthRoute =
      request.url().startsWith('/login') ||
      request.url().startsWith('/register') ||
      request.url().startsWith('/logout')
    const acceptsHtml = headers.accept?.includes('text/html')

    if (!isInertiaRequest && !isAuthRoute && !acceptsHtml) {
      headers.accept = 'application/json'
    }

    return next()
  }
}
