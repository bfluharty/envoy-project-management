import type { HttpContext } from '@adonisjs/core/http'

type Request = HttpContext['request']

/**
 * Inertia navigations expect redirect semantics even though they use XMLHttpRequest. All other
 * API paths or explicit JSON requests receive machine-readable errors.
 */
export function expectsJsonResponse(request: Request): boolean {
  if (request.url().startsWith('/api/')) return true
  if (request.header('x-inertia') === 'true') return false

  const accept = request.header('accept')?.toLowerCase() ?? ''
  return accept.includes('application/json') && !accept.includes('text/html')
}
