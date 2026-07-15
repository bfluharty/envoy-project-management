import type { HttpContext } from '@adonisjs/core/http'
import encryption from '@adonisjs/core/services/encryption'
import env from '#start/env'
import { randomBytes } from 'node:crypto'
import { normalizePostAuthReturnPath } from '#services/post_auth_redirect_service'

export type EmailAuthorizationFlow = 'login' | 'registration' | 'reauth'
export type EmailAuthorizationProvider = 'google' | 'microsoft'
export type EmailAuthorizationAccountType = 'consumer' | 'vendor'

export interface EmailAuthorizationState {
  provider: EmailAuthorizationProvider
  flow: EmailAuthorizationFlow
  termsVersion: string
  termsAccepted: boolean
  accountType: EmailAuthorizationAccountType
  returnPath: string | null
  nonce: string
  issuedAt: string
}

const EMAIL_AUTH_STATE_PURPOSE = 'envoy.email_authorization_state'
const EMAIL_AUTH_STATE_SESSION_KEY = 'auth.email_authorization_state'
const MAX_STATE_AGE_MS = 15 * 60 * 1000

function sessionKey(nonce: string) {
  return `${EMAIL_AUTH_STATE_SESSION_KEY}.${nonce}`
}

function normalizeReturnPath(value: unknown): string | null {
  return normalizePostAuthReturnPath(value)
}

function currentTermsVersion() {
  return env.get('EMAIL_TERMS_VERSION') || '2026-06-26-email-access-v1'
}

export function buildEmailAuthorizationState(
  session: HttpContext['session'],
  input: {
    provider: EmailAuthorizationProvider
    flow: EmailAuthorizationFlow
    termsAccepted?: boolean
    accountType?: EmailAuthorizationAccountType
    returnPath?: unknown
  }
): string {
  const state: EmailAuthorizationState = {
    provider: input.provider,
    flow: input.flow,
    termsVersion: currentTermsVersion(),
    termsAccepted: Boolean(input.termsAccepted),
    accountType: input.accountType ?? 'consumer',
    returnPath: normalizeReturnPath(input.returnPath),
    nonce: randomBytes(24).toString('base64url'),
    issuedAt: new Date().toISOString(),
  }

  session.put(sessionKey(state.nonce), {
    provider: state.provider,
    flow: state.flow,
    termsVersion: state.termsVersion,
  })

  return encryption.encrypt(state, '15 minutes', EMAIL_AUTH_STATE_PURPOSE)
}

export function consumeEmailAuthorizationState(
  session: HttpContext['session'],
  provider: EmailAuthorizationProvider,
  encryptedState: unknown
): EmailAuthorizationState {
  if (typeof encryptedState !== 'string' || encryptedState.length === 0) {
    throw new Error('Missing OAuth state')
  }

  const state = encryption.decrypt<EmailAuthorizationState>(
    encryptedState,
    EMAIL_AUTH_STATE_PURPOSE
  )

  if (!state || state.provider !== provider) {
    throw new Error('Invalid OAuth state')
  }

  const issuedAt = Date.parse(state.issuedAt)
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_STATE_AGE_MS) {
    throw new Error('OAuth state expired')
  }

  const stored = session.get(sessionKey(state.nonce))
  session.forget(sessionKey(state.nonce))

  if (
    !stored ||
    typeof stored !== 'object' ||
    (stored as { provider?: unknown }).provider !== state.provider ||
    (stored as { flow?: unknown }).flow !== state.flow ||
    (stored as { termsVersion?: unknown }).termsVersion !== state.termsVersion
  ) {
    throw new Error('OAuth state could not be verified')
  }

  return state
}

export function buildEmailAuthorizationConsentText() {
  return 'I authorize Envoy to view my email, prepare local drafts, and send approved messages from my connected account.'
}
