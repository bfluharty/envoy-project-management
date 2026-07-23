export type QuackbackConfig =
  | {
      enabled: false
      baseUrl: null
      widgetSecret: null
    }
  | {
      enabled: true
      baseUrl: string
      widgetSecret: string
    }

export type FeedbackWidgetConfig = {
  enabled: true
  baseUrl: string
}

export class QuackbackConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuackbackConfigurationError'
  }
}

export function resolveQuackbackConfig(input: {
  enabled?: boolean
  baseUrl?: string
  widgetSecret?: string
}): QuackbackConfig {
  if (input.enabled !== true) {
    return {
      enabled: false,
      baseUrl: null,
      widgetSecret: null,
    }
  }

  const baseUrl = input.baseUrl?.trim()
  if (!baseUrl) {
    throw new QuackbackConfigurationError('Quackback base URL is required when enabled')
  }

  let parsedBaseUrl: URL
  try {
    parsedBaseUrl = new URL(baseUrl)
  } catch {
    throw new QuackbackConfigurationError('Quackback base URL must be a valid HTTP(S) origin')
  }

  const hasSupportedProtocol =
    parsedBaseUrl.protocol === 'https:' || parsedBaseUrl.protocol === 'http:'
  const isExactOrigin =
    baseUrl === parsedBaseUrl.origin &&
    parsedBaseUrl.pathname === '/' &&
    !parsedBaseUrl.search &&
    !parsedBaseUrl.hash &&
    !parsedBaseUrl.username &&
    !parsedBaseUrl.password

  if (!hasSupportedProtocol || !isExactOrigin) {
    throw new QuackbackConfigurationError(
      'Quackback base URL must be an exact HTTP(S) origin without a trailing slash'
    )
  }

  const widgetSecret = input.widgetSecret
  if (typeof widgetSecret !== 'string' || widgetSecret.length < 32) {
    throw new QuackbackConfigurationError(
      'Quackback widget secret must contain at least 32 characters'
    )
  }

  return {
    enabled: true,
    baseUrl,
    widgetSecret,
  }
}

const FEEDBACK_WIDGET_ROUTE_PREFIXES = [
  '/dashboard',
  '/account',
  '/onboarding/project',
  '/vendor/pending',
  '/vendor/listing',
  '/inbox',
  '/contacts',
  '/projects',
] as const

export function isFeedbackWidgetRouteAllowed(requestUrl: string): boolean {
  const pathname = requestUrl.split(/[?#]/, 1)[0]

  return FEEDBACK_WIDGET_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
