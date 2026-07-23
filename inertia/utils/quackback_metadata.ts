export type FeedbackPageArea = 'dashboard' | 'project' | 'contacts' | 'inbox' | 'account' | 'other'

export type FeedbackWidgetMetadata = {
  envoy_environment: 'dev' | 'prod'
  page_area: FeedbackPageArea
  app_version: string
}

type FeedbackWidgetContext = {
  environment: 'dev' | 'prod'
  appVersion: string
}

const ALLOWED_PAGE_AREAS: FeedbackPageArea[] = [
  'dashboard',
  'project',
  'contacts',
  'inbox',
  'account',
  'other',
]

function normalizeAppVersion(value: string): string {
  const trimmed = value.trim()
  return /^[a-zA-Z0-9._-]{1,64}$/.test(trimmed) ? trimmed : 'unknown'
}

export function feedbackPageArea(requestUrl: string): FeedbackPageArea {
  const pathname = requestUrl.split(/[?#]/, 1)[0]

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'dashboard'
  if (pathname === '/projects' || pathname.startsWith('/projects/')) return 'project'
  if (pathname === '/onboarding/project') return 'project'
  if (pathname === '/contacts' || pathname.startsWith('/contacts/')) return 'contacts'
  if (pathname === '/inbox' || pathname.startsWith('/inbox/')) return 'inbox'
  if (pathname === '/account' || pathname.startsWith('/account/')) return 'account'
  return 'other'
}

export function feedbackWidgetMetadata(
  context: FeedbackWidgetContext,
  requestUrl: string
): FeedbackWidgetMetadata {
  return {
    envoy_environment: context.environment === 'prod' ? 'prod' : 'dev',
    page_area: feedbackPageArea(requestUrl),
    app_version: normalizeAppVersion(context.appVersion),
  }
}

export function safeFeedbackWidgetMetadata(
  metadata: FeedbackWidgetMetadata
): FeedbackWidgetMetadata {
  return {
    envoy_environment: metadata.envoy_environment === 'prod' ? 'prod' : 'dev',
    page_area: ALLOWED_PAGE_AREAS.includes(metadata.page_area) ? metadata.page_area : 'other',
    app_version: normalizeAppVersion(metadata.app_version),
  }
}
