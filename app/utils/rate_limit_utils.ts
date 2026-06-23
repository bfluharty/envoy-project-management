import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import RateLimitService, {
  RateLimitExceededError,
  type RateLimitRule,
} from '#services/rate_limit_service'

const HOUR_SECONDS = 60 * 60
const DAY_SECONDS = 24 * HOUR_SECONDS

type Request = HttpContext['request']
type Response = HttpContext['response']

function bucketKey(...parts: string[]) {
  return parts.map((part) => encodeURIComponent(part.trim().toLowerCase() || 'unknown')).join(':')
}

function parseCloudFrontViewerAddress(value?: string) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  const bracketedIpv6 = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/)
  if (bracketedIpv6) {
    return bracketedIpv6[1]
  }

  const colonCount = (trimmed.match(/:/g) ?? []).length
  if (colonCount === 1) {
    return trimmed.slice(0, trimmed.lastIndexOf(':'))
  }

  return trimmed
}

function getHeader(request: Request, name: string) {
  return (request as unknown as { header?: (key: string) => string | undefined }).header?.(name)
}

export function getClientIp(request: Request) {
  const forwardedFor = getHeader(request, 'x-forwarded-for')?.split(',', 1)[0]?.trim()
  const cloudFrontViewerAddress = parseCloudFrontViewerAddress(
    getHeader(request, 'cloudfront-viewer-address')
  )
  const candidate =
    cloudFrontViewerAddress ??
    getHeader(request, 'cf-connecting-ip') ??
    getHeader(request, 'true-client-ip') ??
    forwardedFor ??
    getHeader(request, 'x-real-ip') ??
    (request as unknown as { ip?: () => string }).ip?.()

  return candidate?.trim() || 'unknown'
}

function shouldForceRateLimitForTest(request: Request) {
  return env.get('NODE_ENV') === 'test' && getHeader(request, 'x-envoy-test-rate-limits') === 'true'
}

export function anonymousVendorSearchRateLimitRules(input: {
  anonymousSessionUuid: string
  ip: string
}): RateLimitRule[] {
  return [
    {
      name: 'anonymous_vendor_search_session_hour',
      bucketKey: bucketKey(
        'anonymous-session',
        input.anonymousSessionUuid,
        'onboarding-vendor-search'
      ),
      limit: 2,
      windowSeconds: HOUR_SECONDS,
    },
    {
      name: 'anonymous_vendor_search_session_day',
      bucketKey: bucketKey(
        'anonymous-session',
        input.anonymousSessionUuid,
        'onboarding-vendor-search'
      ),
      limit: 5,
      windowSeconds: DAY_SECONDS,
    },
    {
      name: 'anonymous_vendor_search_ip_hour',
      bucketKey: bucketKey('ip', input.ip, 'onboarding-vendor-search'),
      limit: 10,
      windowSeconds: HOUR_SECONDS,
    },
    {
      name: 'anonymous_vendor_search_ip_day',
      bucketKey: bucketKey('ip', input.ip, 'onboarding-vendor-search'),
      limit: 30,
      windowSeconds: DAY_SECONDS,
    },
  ]
}

export function adminVendorSearchRateLimitRules(input: {
  userUuid: string
  ip: string
}): RateLimitRule[] {
  return [
    {
      name: 'admin_vendor_search_user_hour',
      bucketKey: bucketKey('user', input.userUuid, 'api-vendor-search'),
      limit: 20,
      windowSeconds: HOUR_SECONDS,
    },
    {
      name: 'admin_vendor_search_ip_hour',
      bucketKey: bucketKey('ip', input.ip, 'api-vendor-search'),
      limit: 60,
      windowSeconds: HOUR_SECONDS,
    },
  ]
}

export function projectChatRateLimitRules(input: {
  userUuid: string
  projectUuid: string
  ip: string
}): RateLimitRule[] {
  return [
    {
      name: 'project_chat_user_hour',
      bucketKey: bucketKey('user', input.userUuid, 'project-chat'),
      limit: 30,
      windowSeconds: HOUR_SECONDS,
    },
    {
      name: 'project_chat_user_day',
      bucketKey: bucketKey('user', input.userUuid, 'project-chat'),
      limit: 100,
      windowSeconds: DAY_SECONDS,
    },
    {
      name: 'project_chat_project_day',
      bucketKey: bucketKey('project', input.projectUuid, 'project-chat'),
      limit: 50,
      windowSeconds: DAY_SECONDS,
    },
    {
      name: 'project_chat_ip_hour',
      bucketKey: bucketKey('ip', input.ip, 'project-chat'),
      limit: 120,
      windowSeconds: HOUR_SECONDS,
    },
  ]
}

export function outreachAiRevisionRateLimitRules(input: {
  userUuid: string
  projectUuid: string
  ip: string
}): RateLimitRule[] {
  return [
    {
      name: 'outreach_ai_revision_user_hour',
      bucketKey: bucketKey('user', input.userUuid, 'outreach-ai-revision'),
      limit: 20,
      windowSeconds: HOUR_SECONDS,
    },
    {
      name: 'outreach_ai_revision_user_day',
      bucketKey: bucketKey('user', input.userUuid, 'outreach-ai-revision'),
      limit: 75,
      windowSeconds: DAY_SECONDS,
    },
    {
      name: 'outreach_ai_revision_project_day',
      bucketKey: bucketKey('project', input.projectUuid, 'outreach-ai-revision'),
      limit: 50,
      windowSeconds: DAY_SECONDS,
    },
    {
      name: 'outreach_ai_revision_ip_hour',
      bucketKey: bucketKey('ip', input.ip, 'outreach-ai-revision'),
      limit: 120,
      windowSeconds: HOUR_SECONDS,
    },
  ]
}

export async function rejectWhenRateLimited(
  request: Request,
  response: Response,
  rules: RateLimitRule[]
) {
  try {
    await RateLimitService.enforce(rules, { force: shouldForceRateLimitForTest(request) })
    return null
  } catch (error) {
    if (!(error instanceof RateLimitExceededError)) {
      throw error
    }

    response.header('Retry-After', String(error.retryAfterSeconds))
    return response.status(429).send({
      error: 'Too many requests',
      retryAfterSeconds: error.retryAfterSeconds,
    })
  }
}
