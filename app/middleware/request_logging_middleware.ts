import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

function errorStatus(error: unknown): number | undefined {
  const status =
    (error as { status?: number; statusCode?: number } | null)?.status ??
    (error as { statusCode?: number } | null)?.statusCode

  if (typeof status === 'number') {
    return status
  }

  return undefined
}

export default class RequestLoggingMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const startedAt = Date.now()
    let thrownError: unknown

    try {
      return await next()
    } catch (error) {
      thrownError = error
      throw error
    } finally {
      const statusCode = errorStatus(thrownError) ?? (thrownError ? 500 : ctx.response.getStatus())
      const fields = {
        requestId: ctx.request.id(),
        method: ctx.request.method(),
        path: ctx.request.url(),
        route: ctx.route?.pattern ?? ctx.routeKey ?? 'unmatched',
        statusCode,
        durationMs: Date.now() - startedAt,
      }

      if (statusCode >= 500) {
        ctx.logger.error(fields, 'request complete')
      } else if (statusCode >= 400) {
        ctx.logger.warn(fields, 'request complete')
      } else {
        ctx.logger.info(fields, 'request complete')
      }
    }
  }
}
