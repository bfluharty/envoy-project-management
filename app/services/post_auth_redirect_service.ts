import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import OnboardingDraftService, {
  ONBOARDING_TOKEN_SESSION_KEY,
  OnboardingDraftError,
  isUuidV4,
} from '#services/onboarding_draft_service'
import UserRoleService from '#services/user_role_service'

export const POST_CONSENT_RETURN_PATH_SESSION_KEY = 'auth.post_consent_return_path'
const RETURN_PATH_BASE_ORIGIN = 'https://envoy.invalid'

type Session = HttpContext['session']

function containsUnsafeUrlCharacter(value: string) {
  return (
    value.includes('\\') ||
    [...value].some((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    })
  )
}

export function normalizePostAuthReturnPath(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 2048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    containsUnsafeUrlCharacter(value)
  ) {
    return null
  }

  let parsed: URL
  try {
    parsed = new URL(value, RETURN_PATH_BASE_ORIGIN)
  } catch {
    return null
  }

  if (parsed.origin !== RETURN_PATH_BASE_ORIGIN || !parsed.pathname.startsWith('/')) {
    return null
  }

  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(parsed.pathname)
  } catch {
    return null
  }
  if (decodedPath.startsWith('//') || containsUnsafeUrlCharacter(decodedPath)) {
    return null
  }

  const path = parsed.pathname
  if (
    path === '/account/avatar/google' ||
    path === '/onboarding/consent' ||
    path === '/auth' ||
    path.startsWith('/auth/') ||
    path === '/login' ||
    path.startsWith('/login/') ||
    path === '/register' ||
    path.startsWith('/register/') ||
    path === '/logout' ||
    path === '/forgot-password' ||
    path === '/reset-password'
  ) {
    return null
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}

export default class PostAuthRedirectService {
  static rememberReturnPath(session: Session, value: unknown) {
    const returnPath = normalizePostAuthReturnPath(value)
    if (returnPath) {
      session.put(POST_CONSENT_RETURN_PATH_SESSION_KEY, returnPath)
    }
  }

  static getSessionOnboardingToken(session: Session) {
    const sessionToken = session.get(ONBOARDING_TOKEN_SESSION_KEY)
    return isUuidV4(sessionToken) ? sessionToken : null
  }

  static async associateOnboardingDraftForUser(token: string, userUuid: string, session: Session) {
    try {
      await OnboardingDraftService.associateDraftToUser(token, userUuid)
      session.forget(ONBOARDING_TOKEN_SESSION_KEY)
      return true
    } catch (error) {
      session.forget(ONBOARDING_TOKEN_SESSION_KEY)

      if (!(error instanceof OnboardingDraftError && error.statusCode === 404)) {
        logger.warn(error, 'Failed to associate onboarding draft during registration')
      }

      return false
    }
  }

  static async resolve(user: User, session: Session, fallbackReturnPath?: unknown) {
    const role = await UserRoleService.getCanonicalName(user)

    if (role === 'VENDOR') {
      session.forget(ONBOARDING_TOKEN_SESSION_KEY)
      session.forget('auth.intended_url')
      session.forget(POST_CONSENT_RETURN_PATH_SESSION_KEY)
      return user.vendorApprovalStatus === 'APPROVED' ? '/vendor/listing' : '/vendor/pending'
    }

    if (role === 'CONSUMER') {
      const onboardingToken = this.getSessionOnboardingToken(session)
      if (
        onboardingToken &&
        (await this.associateOnboardingDraftForUser(onboardingToken, user.uuid, session))
      ) {
        session.forget(POST_CONSENT_RETURN_PATH_SESSION_KEY)
        return '/onboarding/project'
      }
    } else {
      session.forget(ONBOARDING_TOKEN_SESSION_KEY)
    }

    const intendedUrl = normalizePostAuthReturnPath(session.get('auth.intended_url'))
    session.forget('auth.intended_url')
    if (intendedUrl) {
      session.forget(POST_CONSENT_RETURN_PATH_SESSION_KEY)
      return intendedUrl
    }

    const rememberedReturnPath = normalizePostAuthReturnPath(
      session.get(POST_CONSENT_RETURN_PATH_SESSION_KEY)
    )
    session.forget(POST_CONSENT_RETURN_PATH_SESSION_KEY)
    if (rememberedReturnPath) {
      return rememberedReturnPath
    }

    return normalizePostAuthReturnPath(fallbackReturnPath) ?? '/dashboard'
  }
}
