import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import User from '#models/user'
import PasswordResetToken from '#models/password_reset_token'
import {
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resetPasswordValidator,
} from '#validators/auth_validator'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import { sendPasswordResetLink } from '#services/password_reset_service'

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

  private getSocialAuthOptions(): SocialAuthOption[] {
    return SOCIAL_AUTH_PROVIDERS.filter((provider) =>
      this.isSocialAuthProviderConfigured(provider)
    ).map((provider) => ({
      provider,
      label: SOCIAL_AUTH_PROVIDER_LABELS[provider],
      href: `/auth/${provider}`,
    }))
  }

  private consumePostLoginRedirect(session: HttpContext['session']) {
    const intendedUrl = session.get('auth.intended_url')
    session.forget('auth.intended_url')

    return resolvePostLoginRedirect(intendedUrl)
  }

  private async findUserBySocialProfile(profile: NormalizedSocialUser) {
    const userByProviderId = await User.findBy('providerId', profile.providerUserId)
    if (userByProviderId) {
      return userByProviderId
    }

    return User.findBy('email', profile.email)
  }

  private async upsertSocialUser(profile: NormalizedSocialUser) {
    const user = await this.findUserBySocialProfile(profile)

    if (!user) {
      return User.create({
        fullName: profile.fullName,
        email: profile.email,
        password: randomBytes(32).toString('hex'),
        providerId: profile.providerUserId,
        googleAvatarUrl: profile.provider === 'google' ? profile.avatarUrl : null,
        entitlementId: 1,
        isActive: true,
      })
    }

    if (profile.provider === 'google') {
      user.googleAvatarUrl = profile.avatarUrl
    }

    if (!user.providerId) {
      user.providerId = profile.providerUserId
    }

    await user.save()
    return user
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

      const intendedUrl = this.consumePostLoginRedirect(session)
      if (intendedUrl) {
        return response.redirect(intendedUrl)
      }

      return response.redirect().toRoute('dashboard')
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
  async showRegister({ inertia, session }: HttpContext) {
    return inertia.render('auth/register', {
      flashMessage: this.getFlashMessage(session),
      socialAuthProviders: this.getSocialAuthOptions(),
      passwordAuthEnabled: passwordAuthEnabled(),
    })
  }

  /**
   * Handle registration request
   */
  async register({ request, response, session, inertia }: HttpContext) {
    if (!passwordAuthEnabled()) {
      session.flash('error', 'Email and password registration is not available right now.')
      return response.redirect().toRoute('auth.register')
    }

    const data = await request.validateUsing(registerValidator)

    try {
      await User.create({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        entitlementId: 1, // Default to user entitlement (ID 1)
        isActive: true,
      })

      session.flash('success', 'Account created successfully! Please log in.')
      return response.redirect().toRoute('auth.login')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return inertia.render('auth/register', {
          flashMessage: {
            type: 'error',
            message: 'An account with that email already exists. Try signing in instead.',
          },
          errors: { email: 'An account with this email already exists.' },
          socialAuthProviders: this.getSocialAuthOptions(),
          passwordAuthEnabled: passwordAuthEnabled(),
        })
      }
      logger.error(error, 'Registration failed')
      return inertia.render('auth/register', {
        flashMessage: { type: 'error', message: 'Something went wrong. Please try again.' },
        socialAuthProviders: this.getSocialAuthOptions(),
        passwordAuthEnabled: passwordAuthEnabled(),
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

    session.put('redirect.previousUrl', '/login')
    return ally.use(provider).redirect()
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

    const driver = ally.use(provider)
    const providerLabel = SOCIAL_AUTH_PROVIDER_LABELS[provider]

    if (driver.accessDenied()) {
      session.flash('error', `${providerLabel} sign-in was cancelled.`)
      return response.redirect().toRoute('auth.login')
    }

    if (driver.stateMisMatch()) {
      session.flash('error', `${providerLabel} sign-in could not be verified. Please try again.`)
      return response.redirect().toRoute('auth.login')
    }

    if (driver.hasError()) {
      logger.warn({ provider, error: driver.getError() }, 'Social auth provider returned an error')
      session.flash('error', `${providerLabel} authentication failed. Please try again.`)
      return response.redirect().toRoute('auth.login')
    }

    try {
      const socialUser = await driver.user()
      const socialProfile = normalizeSocialUser(provider, socialUser)

      if (socialProfile.emailVerificationState === 'unverified') {
        session.flash(
          'error',
          `${providerLabel} has not verified that email address. Please use another sign-in method.`
        )
        return response.redirect().toRoute('auth.login')
      }

      const user = await this.upsertSocialUser(socialProfile)
      await auth.use('web').login(user)
      session.put('auth.login_method', provider)
      session.flash('success', 'Welcome!')

      const intendedUrl = this.consumePostLoginRedirect(session)
      if (intendedUrl) {
        return response.redirect(intendedUrl)
      }

      return response.redirect().toRoute('dashboard')
    } catch (error) {
      logger.error({ err: error, provider }, 'Social auth callback failed')
      session.flash('error', `${providerLabel} authentication failed. Please try again.`)
      return response.redirect().toRoute('auth.login')
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
