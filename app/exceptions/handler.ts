import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    const status =
      (error as { status?: number; statusCode?: number })?.status ??
      (error as { statusCode?: number })?.statusCode
    const code = (error as { code?: string })?.code

    const acceptsHtml =
      ctx.request.accepts(['html', 'json']) === 'html' ||
      (ctx.request.header('accept') ?? '').includes('text/html')
    const isApiRequest = ctx.request.url().startsWith('/api')
    const isNotFound = status === 404 || code === 'E_ROUTE_NOT_FOUND'

    if (acceptsHtml && !isApiRequest && isNotFound) {
      ctx.response.status(404)
      return ctx.inertia.render('errors/not_found')
    }

    if (acceptsHtml && !isApiRequest && typeof status === 'number' && status >= 500) {
      ctx.response.status(status)
      return ctx.inertia.render('errors/server_error', {
        error: {
          message: app.inProduction ? 'An unexpected error occurred.' : (error as Error)?.message,
        },
      })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
