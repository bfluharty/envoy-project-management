import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

export default class HealthController {
  /**
   * GET /health — lightweight liveness + DB connectivity check.
   * Used by ALB target-group health checks.
   */
  async handle({ response }: HttpContext) {
    try {
      await db.rawQuery('SELECT 1')
      return response.ok({
        status: 'ok',
        timestamp: new Date().toISOString(),
      })
    } catch {
      return response.serviceUnavailable({
        status: 'error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      })
    }
  }

  /**
   * GET /version — returns the git SHA baked into the image at build time.
   * Lets you verify which commit is running in any environment.
   */
  async version({ response }: HttpContext) {
    return response.ok({
      sha: process.env.GIT_SHA || 'unknown',
      builtAt: process.env.BUILD_TIMESTAMP || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
    })
  }
}
