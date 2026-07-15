import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import User from '#models/user'
import UserInboxConnection from '#models/user_inbox_connection'
import PasswordResetToken from '#models/password_reset_token'
import {
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resetPasswordValidator,
} from '#validators/auth_validator'
import { DateTime } from 'luxon'
import { sendPasswordResetLink } from '#services/password_reset_service'
import EntitlementService from '#services/entitlement_service'
import {
  buildEmailAuthorizationState,
  consumeEmailAuthorizationState,
  type EmailAuthorizationAccountType,
  type EmailAuthorizationFlow,
} from '#services/email_authorization_state_service'
import {
  completeEmailAuthorization,
  EmailAuthorizationCompletionError,
  type NormalizedEmailAuthorizationTokens,
} from '#services/email_authorization_completion_service'
import { setupEmailWatch, stopEmailWatch } from '#services/email_watch_service'
import OnboardingDraftService, {
  ONBOARDING_TOKEN_SESSION_KEY,
  OnboardingDraftError,
  isUuidV4,
} from '#services/onboarding_draft_service'
import UserRoleService from '#services/user_role_service'
import { safeError } from '#utils/safe_error'

const SOCIAL_AUTH_PROVIDERS = ['google', 'microsoft'] as const
type SocialAuthProvider = (typeof SOCIAL_AUTH_PROVIDERS)[number]

interface SocialAuthOption {
  provider: SocialAuthProvider
  label: string
  href: string
}

interface NormalizedSocialUser {
  provider: SocialAuthProvider
  providerUserId: string
  email: string
  fullName: string
  avatarUrl: string | null
  emailVerificationState: 'verified' | 'unverified' | 'unsupported'
}

const SOCIAL_AUTH_PROVIDER_LABELS: Record<SocialAuthProvider, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
}

const REQUIRED_MAIL_SCOPES: Record<SocialAuthProvider, string[]> = {
  google: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  microsoft: ['Mail.Read', 'Mail.Send'],
}

export function passwordAuthEnabled(): boolean {
  return env.get('PASSWORD_AUTH_ENABLED', false)
}

function isSocialAuthProvider(provider: unknown): provider is SocialAuthProvider {
  return (
    typeof provider === 'string' && SOCIAL_AUTH_PROVIDERS.includes(provider as SocialAuthProvider)
  )
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function emailLocalPart(email: string): string {
  return email.split('@')[0] || email
}

function normalizeAccountType(value: unknown): EmailAuthorizationAccountType {
  return value === 'vendor' ? 'vendor' : 'consumer'
}

function normalizeAuthorizationFlow(value: unknown): EmailAuthorizationFlow {
  if (value === 'registration' || value === 'reauth') {
    return value
  }

  return 'login'
}

function getOauthTokenValue(token: Record<string, unknown>): string | null {
  return typeof token.token === 'string' && token.token.length > 0 ? token.token : null
}

function normalizeOauthScopes(token: Record<string, unknown>, fallbackScopes: string[]): string {
  if (Array.isArray(token.grantedScopes)) {
    return token.grantedScopes
      .filter((scope): scope is string => typeof scope === 'string')
      .join(' ')
  }

  if (Array.isArray(token.scope)) {
    return token.scope.filter((scope): scope is string => typeof scope === 'string').join(' ')
  }

  if (typeof token.scope === 'string' && token.scope.trim().length > 0) {
    return token.scope.trim()
  }

  return fallbackScopes.join(' ')
}

function scopeSet(scopes: string) {
  return new Set(scopes.split(/\s+/).filter(Boolean))
}

function assertMailScopesGranted(provider: SocialAuthProvider, scopes: string) {
  const grantedScopes = scopeSet(scopes)
  const missingScopes = REQUIRED_MAIL_SCOPES[provider].filter((scope) => !grantedScopes.has(scope))

  if (missingScopes.length > 0) {
    throw new Error(`Missing required email scopes: ${missingScopes.join(', ')}`)
  }
}

function normalizeSocialTokens(
  provider: SocialAuthProvider,
  rawSocialUser: unknown
): NormalizedEmailAuthorizationTokens {
  const socialUser =
    rawSocialUser && typeof rawSocialUser === 'object'
      ? (rawSocialUser as Record<string, unknown>)
      : {}
  const token =
    socialUser.token && typeof socialUser.token === 'object'
      ? (socialUser.token as Record<string, unknown>)
      : {}
  const accessToken = getOauthTokenValue(token)

  if (!accessToken) {
    throw new Error('Provider did not return an access token')
  }

  const refreshToken =
    typeof token.refreshToken === 'string' && token.refreshToken.length > 0
      ? token.refreshToken
      : null

  let expiresAt: Date | null = null
  if (token.expiresAt instanceof Date) {
    expiresAt = token.expiresAt
  } else if (typeof token.expiresAt === 'string' || typeof token.expiresAt === 'number') {
    const parsedExpiresAt = new Date(token.expiresAt)
    expiresAt = Number.isNaN(parsedExpiresAt.getTime()) ? null : parsedExpiresAt
  } else if (typeof token.expiresIn === 'number') {
    expiresAt = new Date(Date.now() + token.expiresIn * 1000)
  }

  const fallbackScopes =
    provider === 'google'
      ? ['openid', 'userinfo.email', 'userinfo.profile', ...REQUIRED_MAIL_SCOPES.google]
      : ['openid', 'profile', 'email', 'User.Read', ...REQUIRED_MAIL_SCOPES.microsoft]

  const scopes = normalizeOauthScopes(token, fallbackScopes)
  assertMailScopesGranted(provider, scopes)

  return {
    accessToken,
    refreshToken,
    expiresAt,
    scopes,
  }
}

export function normalizeSocialUser(
  provider: SocialAuthProvider,
  rawUser: unknown
): NormalizedSocialUser {
  const user = rawUser && typeof rawUser === 'object' ? (rawUser as Record<string, unknown>) : {}

  if (provider === 'google') {
    const providerUserId = nonEmptyString(user.id)
    const email = nonEmptyString(user.email)
    if (!providerUserId || !email) {
      throw new Error('Google did not return a usable profile')
    }

    const emailVerificationState =
      user.emailVerificationState === 'verified' || user.emailVerificationState === 'unverified'
        ? user.emailVerificationState
        : 'unsupported'

    return {
      provider,
      providerUserId,
      email,
      fullName: nonEmptyString(user.name) ?? emailLocalPart(email),
      avatarUrl: nonEmptyString(user.avatarUrl),
      emailVerificationState,
    }
  }

  const providerUserId = nonEmptyString(user.id)
  const email =
    nonEmptyString(user.mail) ??
    nonEmptyString(user.userPrincipalName) ??
    nonEmptyString(user.email)
  if (!providerUserId || !email) {
    throw new Error('Microsoft did not return a usable profile')
  }

  return {
    provider,
    providerUserId,
    email,
    fullName:
      nonEmptyString(user.displayName) ?? nonEmptyString(user.name) ?? emailLocalPart(email),
    avatarUrl: null,
    emailVerificationState: 'unsupported',
  }
}

export function resolvePostLoginRedirect(intendedUrl: unknown): string | null {
  if (typeof intendedUrl !== 'string' || intendedUrl.length === 0) {
    return null
  }

  const normalizedPath = intendedUrl.split(/[?#]/, 1)[0] ?? ''
  if (normalizedPath === '/account/avatar/google') {
    return null
  }

  return intendedUrl
}

export default class AuthController {
  private getFlashMessage(session: HttpContext['session']) {
    const successMessage = session.flashMessages.get('success')
    if (typeof successMessage === 'string') {
      return { type: 'success' as const, message: successMessage }
    }

    const errorMessage = session.flashMessages.get('error')
    if (typeof errorMessage === 'string') {
      return { type: 'error' as const, message: errorMessage }
    }

    return null
  }

  private isSocialAuthProviderConfigured(provider: SocialAuthProvider): boolean {
    if (provider === 'google') {
      return Boolean(env.get('GOOGLE_CLIENT_ID') && env.get('GOOGLE_CLIENT_SECRET'))
    }

    return Boolean(env.get('MICROSOFT_CLIENT_ID') && env.get('MICROSOFT_CLIENT_SECRET'))
  }

  private getSocialAuthOptions(
    input: {
      flow?: EmailAuthorizationFlow
      accountType?: EmailAuthorizationAccountType
      emailTermsAccepted?: boolean
    } = {}
  ): SocialAuthOption[] {
    const params = new URLSearchParams()
    if (input.flow) {
      params.set('flow', input.flow)
    }
    if (input.accountType) {
      params.set('accountType', input.accountType)
    }
    if (input.emailTermsAccepted) {
      params.set('emailTermsAccepted', '1')
    }
    const query = params.toString()

    return SOCIAL_AUTH_PROVIDERS.filter((provider) =>
      this.isSocialAuthProviderConfigured(provider)
    ).map((provider) => ({
      provider,
      label: SOCIAL_AUTH_PROVIDER_LABELS[provider],
      href: query ? `/auth/${provider}?${query}` : `/auth/${provider}`,
    }))
  }

  private getRegistrationFormProps(accountType: EmailAuthorizationAccountType) {
    return {
      socialAuthProviders: this.getSocialAuthOptions({
        flow: 'registration',
        accountType,
        emailTermsAccepted: true,
      }),
      passwordAuthEnabled: passwordAuthEnabled(),
      accountType,
    }
  }

  private consumePostLoginRedirect(session: HttpContext['session']) {
    const intendedUrl = session.get('auth.intended_url')
    session.forget('auth.intended_url')

    return resolvePostLoginRedirect(intendedUrl)
  }

  private getSessionOnboardingToken(session: HttpContext['session']) {
    const sessionToken = session.get(ONBOARDING_TOKEN_SESSION_KEY)
    return isUuidV4(sessionToken) ? sessionToken : null
  }

  private async associateOnboardingDraftForUser(
    token: string,
    userUuid: string,
    session: HttpContext['session']
  ) {
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

  private async resolveAuthenticatedUserRedirect(
    user: User,
    session: HttpContext['session'],
    returnPath?: string | null
  ) {
    const role = await UserRoleService.getCanonicalName(user)

    if (role === 'VENDOR') {
      session.forget(ONBOARDING_TOKEN_SESSION_KEY)
      session.forget('auth.intended_url')
      return user.vendorApprovalStatus === 'APPROVED' ? '/vendor/listing' : '/vendor/pending'
    }

    if (role === 'CONSUMER') {
      const onboardingToken = this.getSessionOnboardingToken(session)
      if (
        onboardingToken &&
        (await this.associateOnboardingDraftForUser(onboardingToken, user.uuid, session))
      ) {
        return '/onboarding/project'
      }
    } else {
      session.forget(ONBOARDING_TOKEN_SESSION_KEY)
    }

    const intendedUrl = this.consumePostLoginRedirect(session)
    if (intendedUrl) {
      return intendedUrl
    }

    return returnPath || '/dashboard'
  }

  /**
   * Show the login form
   */
  async showLogin({ inertia, session }: HttpContext) {
    return inertia.render('auth/login', {
      flashMessage: this.getFlashMessage(session),
      socialAuthProviders: this.getSocialAuthOptions(),
      passwordAuthEnabled: passwordAuthEnabled(),
    })
  }

  /**
   * Handle login request
   */
  async login({ auth, request, response, session, inertia }: HttpContext) {
    if (!passwordAuthEnabled()) {
      session.flash('error', 'Email and password sign-in is not available right now.')
      return response.redirect().toRoute('auth.login')
    }

    const { email, password } = await request.validateUsing(loginValidator)

    try {
      const user = await User.verifyCredentials(email, password)
      await auth.use('web').login(user)
      session.put('auth.login_method', 'password')

      session.flash('success', 'Welcome back!')
      return response.redirect(await this.resolveAuthenticatedUserRedirect(user, session))
    } catch (error) {
      // For Inertia requests, we need to return back to the login page with errors
      return inertia.render('auth/login', {
        flashMessage: { type: 'error', message: 'Invalid email or password' },
        errors: { email: ['Invalid credentials'] },
        socialAuthProviders: this.getSocialAuthOptions(),
        passwordAuthEnabled: passwordAuthEnabled(),
      })
    }
  }

  /**
   * Show the registration form
   */
  async showRegister({ inertia, request, session }: HttpContext) {
    const requestedAccountType = request.input('accountType')
    const accountType = requestedAccountType === 'vendor' ? 'vendor' : 'consumer'

    return inertia.render('auth/register', {
      flashMessage: this.getFlashMessage(session),
      ...this.getRegistrationFormProps(accountType),
    })
  }

  /**
   * Handle registration request
   */
  async register({ auth, request, response, session, inertia }: HttpContext) {
    if (!passwordAuthEnabled()) {
      session.flash('error', 'Email and password registration is not available right now.')
      const accountType = normalizeAccountType(request.input('accountType'))
      return response.redirect(`/register?accountType=${accountType}`)
    }

    const body = request.body()

    if (body.onboardingToken !== undefined && !isUuidV4(body.onboardingToken)) {
      return response.status(422).send({
        errors: {
          onboardingToken: ['The onboarding token must be a UUID v4.'],
        },
      })
    }

    const data = await registerValidator.validate(body)
    const accountType = data.accountType ?? 'consumer'
    const registrationFormProps = this.getRegistrationFormProps(accountType)

    try {
      const entitlementId = await EntitlementService.getIdByCanonicalName(
        accountType === 'vendor' ? 'VENDOR' : 'CONSUMER'
      )

      const user = await User.create({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        entitlementId,
        vendorApprovalStatus: accountType === 'vendor' ? 'PENDING' : null,
        isActive: true,
      })

      await auth.use('web').login(user)
      session.put('auth.login_method', 'password')
      session.flash('success', 'Welcome!')

      if (accountType === 'vendor') {
        session.forget(ONBOARDING_TOKEN_SESSION_KEY)
        session.forget('auth.intended_url')
        return response.redirect('/vendor/pending')
      }

      const onboardingToken = data.onboardingToken ?? this.getSessionOnboardingToken(session)
      if (
        onboardingToken &&
        (await this.associateOnboardingDraftForUser(onboardingToken, user.uuid, session))
      ) {
        return response.redirect('/onboarding/project')
      }

      return response.redirect().toRoute('dashboard')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return inertia.render('auth/register', {
          flashMessage: {
            type: 'error',
            message: 'An account with that email already exists. Try signing in instead.',
          },
          errors: { email: 'An account with this email already exists.' },
          ...registrationFormProps,
        })
      }
      logger.error(error, 'Registration failed')
      return inertia.render('auth/register', {
        flashMessage: { type: 'error', message: 'Something went wrong. Please try again.' },
        ...registrationFormProps,
      })
    }
  }

  /**
   * Handle logout request
   */
  async logout({ auth, response, session }: HttpContext) {
    await auth.use('web').logout()
    session.forget('auth.login_method')
    session.flash('success', 'You have been logged out')
    return response.redirect().toRoute('landing')
  }

  /**
   * Redirect to the selected social provider via Ally.
   */
  async socialRedirect({ ally, request, response, session }: HttpContext) {
    const provider = request.params().provider
    if (!isSocialAuthProvider(provider)) {
      session.flash('error', 'That sign-in provider is not supported.')
      return response.redirect().toRoute('auth.login')
    }

    if (!this.isSocialAuthProviderConfigured(provider)) {
      session.flash(
        'error',
        `${SOCIAL_AUTH_PROVIDER_LABELS[provider]} sign-in is not configured right now. Please try email login.`
      )
      return response.redirect().toRoute('auth.login')
    }

    const flow = normalizeAuthorizationFlow(request.input('flow'))
    const accountType = normalizeAccountType(request.input('accountType'))
    const termsAccepted = request.input('emailTermsAccepted') === '1'

    if (flow === 'registration' && !termsAccepted) {
      session.flash('error', 'You must accept email authorization before creating an account.')
      return response.redirect().toRoute('auth.register')
    }

    const state = buildEmailAuthorizationState(session, {
      provider,
      flow,
      termsAccepted,
      accountType,
      returnPath: request.input('returnTo') ?? session.get('auth.intended_url'),
    })

    session.put('redirect.previousUrl', flow === 'registration' ? '/register' : '/login')
    return ally
      .use(provider)
      .stateless()
      .redirect((redirectRequest) => {
        redirectRequest.param('state', state)
      })
  }

  /**
   * Handle a social provider callback via Ally.
   */
  async socialCallback({ ally, auth, request, response, session }: HttpContext) {
    const provider = request.params().provider
    if (!isSocialAuthProvider(provider)) {
      session.flash('error', 'That sign-in provider is not supported.')
      return response.redirect().toRoute('auth.login')
    }

    let emailAuthState: ReturnType<typeof consumeEmailAuthorizationState>
    try {
      emailAuthState = consumeEmailAuthorizationState(session, provider, request.input('state'))
    } catch (error) {
      logger.warn(
        { err: safeError(error), provider },
        'Social auth callback state validation failed'
      )
      session.flash('error', 'Sign-in could not be verified. Please try again.')
      return response.redirect().toRoute('auth.login')
    }

    const driver = ally.use(provider).stateless()
    const providerLabel = SOCIAL_AUTH_PROVIDER_LABELS[provider]
    const failureRoute =
      emailAuthState.flow === 'registration' || emailAuthState.flow === 'reauth'
        ? 'auth.register'
        : 'auth.login'

    if (driver.accessDenied()) {
      session.flash('error', `${providerLabel} authorization was cancelled.`)
      return response.redirect().toRoute(failureRoute)
    }

    if (driver.stateMisMatch()) {
      session.flash('error', `${providerLabel} sign-in could not be verified. Please try again.`)
      return response.redirect().toRoute(failureRoute)
    }

    if (driver.hasError()) {
      logger.warn({ provider, error: driver.getError() }, 'Social auth provider returned an error')
      session.flash('error', `${providerLabel} authentication failed. Please try again.`)
      return response.redirect().toRoute(failureRoute)
    }

    try {
      const socialUser = await driver.user()
      const socialProfile = normalizeSocialUser(provider, socialUser)
      const socialTokens = normalizeSocialTokens(provider, socialUser)

      if (socialProfile.emailVerificationState === 'unverified') {
        session.flash(
          'error',
          `${providerLabel} has not verified that email address. Please use another sign-in method.`
        )
        return response.redirect().toRoute(failureRoute)
      }

      const { user, connection, replacedConnectionIds } = await completeEmailAuthorization({
        profile: socialProfile,
        tokens: socialTokens,
        flow: emailAuthState.flow,
        accountType: emailAuthState.accountType,
        termsAccepted: emailAuthState.termsAccepted,
        termsVersion: emailAuthState.termsVersion,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
      })

      for (const connectionId of replacedConnectionIds) {
        const replacedConnection = await UserInboxConnection.find(connectionId)
        if (replacedConnection) {
          await stopEmailWatch(replacedConnection)
          replacedConnection.merge({
            isPrimary: false,
            status: 'disconnected',
            disconnectedAt: DateTime.utc(),
          })
          await replacedConnection.save()
        }
      }
      await setupEmailWatch(connection)
      await auth.use('web').login(user)
      session.put('auth.login_method', provider)
      session.flash('success', 'Welcome!')
      return response.redirect(
        await this.resolveAuthenticatedUserRedirect(user, session, emailAuthState.returnPath)
      )
    } catch (error) {
      logger.error({ err: safeError(error), provider }, 'Social auth callback failed')
      session.flash(
        'error',
        error instanceof EmailAuthorizationCompletionError
          ? error.message
          : `${providerLabel} authentication failed. Please try again.`
      )
      return response.redirect().toRoute(failureRoute)
    }
  }

  async showForgotPassword({ inertia, session }: HttpContext) {
    const flashMessage =
      session.flashMessages.get('success') ?? session.flashMessages.get('error') ?? null
    return inertia.render('auth/forgot_password', { flashMessage })
  }

  async forgotPassword({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)
    const user = await User.findBy('email', email)
    if (!user) {
      session.flash(
        'success',
        'If that email is registered, you will receive a reset link shortly.'
      )
      return response.redirect().back()
    }

    try {
      await sendPasswordResetLink(user)
    } catch (err) {
      session.flash('error', err instanceof Error ? err.message : 'Failed to send reset email.')
      return response.redirect().back()
    }
    session.flash('success', 'If that email is registered, you will receive a reset link shortly.')
    return response.redirect().back()
  }

  async showResetPassword({ inertia, request, session }: HttpContext) {
    const token = request.input('token', '')
    const flashMessage =
      session.flashMessages.get('success') ?? session.flashMessages.get('error') ?? null
    return inertia.render('auth/reset_password', { token, flashMessage })
  }

  async resetPassword({ request, response, session }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)
    const record = await PasswordResetToken.query()
      .where('token', token)
      .where('expires_at', '>', DateTime.utc().toSQL())
      .first()
    if (!record) {
      session.flash('error', 'This reset link is invalid or has expired. Please request a new one.')
      return response.redirect().toRoute('auth.forgotPassword')
    }
    const user = await User.findBy('uuid', record.userUuid)
    if (!user) {
      session.flash('error', 'This reset link is invalid. Please request a new one.')
      return response.redirect().toRoute('auth.forgotPassword')
    }
    user.password = password
    await user.save()
    await PasswordResetToken.query().where('token', token).delete()
    session.flash('success', 'Your password has been reset. You can now sign in.')
    return response.redirect().toRoute('auth.login')
  }
}
