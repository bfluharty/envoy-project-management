import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { expectsJsonResponse } from '#utils/request_mode'
import { normalizePostAuthReturnPath } from '#services/post_auth_redirect_service'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to, when authentication fails
   */
  redirectTo = '/login'

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    // Only browser navigations may become a post-authentication destination. JSON/API requests
    // must not overwrite a destination the user selected in the UI.
    if (ctx.request.method() === 'GET' && !expectsJsonResponse(ctx.request)) {
      const intendedUrl = normalizePostAuthReturnPath(ctx.request.url())
      if (intendedUrl) {
        ctx.session.put('auth.intended_url', intendedUrl)
      }
    }

    await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })
    return next()
  }
}
