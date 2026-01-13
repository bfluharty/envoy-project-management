import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

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
    // Store the intended URL in session for redirect after login
    // Only store if it's a GET request and not already the login page
    if (
      ctx.request.method() === 'GET' &&
      ctx.request.url() !== this.redirectTo &&
      !ctx.request.url().startsWith('/login') &&
      !ctx.request.url().startsWith('/register')
    ) {
      ctx.session.put('auth.intended_url', ctx.request.url())
    }

    await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })
    return next()
  }
}
