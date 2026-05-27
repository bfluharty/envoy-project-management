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
import { getGoogleAuthUrl, getGoogleUser } from '#services/google_auth_service'
import { sendPasswordResetLink } from '#services/password_reset_service'
import UserInboxConnection from '#models/user_inbox_connection'

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
  private consumePostLoginRedirect(session: HttpContext['session']) {
    const intendedUrl = session.get('auth.intended_url')
    session.forget('auth.intended_url')

    return resolvePostLoginRedirect(intendedUrl)
  }

  /**
   * Show the login form
   */
  async showLogin({ inertia, session }: HttpContext) {
    return inertia.render('auth/login', {
      flashMessage:
        session.flashMessages.get('success') ?? session.flashMessages.get('error') ?? null,
      googleAuthAvailable: Boolean(env.get('GOOGLE_CLIENT_ID') && env.get('GOOGLE_CLIENT_SECRET')),
    })
  }

  /**
   * Handle login request
   */
  async login({ auth, request, response, session, inertia }: HttpContext) {
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
      })
    }
  }

  /**
   * Show the registration form
   */
  async showRegister({ inertia, session }: HttpContext) {
    const successMsg = session.flashMessages.get('success')
    const errorMsg = session.flashMessages.get('error')
    const flashMessage = successMsg
      ? { type: 'success' as const, message: successMsg }
      : errorMsg
        ? { type: 'error' as const, message: errorMsg }
        : null
    return inertia.render('auth/register', {
      flashMessage,
      googleAuthAvailable: Boolean(env.get('GOOGLE_CLIENT_ID') && env.get('GOOGLE_CLIENT_SECRET')),
    })
  }

  /**
   * Handle registration request
   */
  async register({ request, response, session, inertia }: HttpContext) {
    const data = await request.validateUsing(registerValidator)

    const googleAuthAvailable = Boolean(
      env.get('GOOGLE_CLIENT_ID') && env.get('GOOGLE_CLIENT_SECRET')
    )

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
      logger.error(error, 'Registration failed')
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return inertia.render('auth/register', {
          flashMessage: {
            type: 'error',
            message: 'An account with that email already exists. Try signing in instead.',
          },
          errors: { email: 'An account with this email already exists.' },
          googleAuthAvailable,
        })
      }
      return inertia.render('auth/register', {
        flashMessage: { type: 'error', message: 'Something went wrong. Please try again.' },
        googleAuthAvailable,
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
   * Redirect to Google OAuth consent screen
   */
  async googleRedirect({ response, session }: HttpContext) {
    try {
      const url = getGoogleAuthUrl()
      return response.redirect(url)
    } catch (error) {
      logger.error(error, 'Google OAuth redirect failed')
      session.flash('error', 'Google sign-in is not configured right now. Please try email login.')
      return response.redirect().toRoute('auth.login')
    }
  }

  /**
   * Handle Google OAuth callback
   */
  async googleCallback({ auth, request, response, session }: HttpContext) {
    const code = request.input('code')
    if (!code) {
      session.flash('error', 'Google authentication failed. Please try again.')
      return response.redirect().toRoute('auth.login')
    }

    try {
      const googleProfile = await getGoogleUser(code)

      // Try to find existing user by googleId or email
      let user = await User.findBy('googleId', googleProfile.googleId)
      if (!user) {
        user = await User.findBy('email', googleProfile.email)
      }

      if (user) {
        // Link Google ID if not already set
        if (!user.googleId) {
          user.googleId = googleProfile.googleId
        }
        user.googleAvatarUrl = googleProfile.picture
        await user.save()
      } else {
        // Create new user
        user = await User.create({
          fullName: googleProfile.fullName,
          email: googleProfile.email,
          googleId: googleProfile.googleId,
          googleAvatarUrl: googleProfile.picture,
          password: randomBytes(32).toString('hex'),
          entitlementId: 1,
          isActive: true,
        })
      }

      // Sync Gmail inbox connection
      await UserInboxConnection.updateOrCreate(
        { userUuid: user.uuid, provider: 'gmail', email: googleProfile.email },
        {
          accessToken: googleProfile.accessToken,
          refreshToken: googleProfile.refreshToken,
          accessTokenExpiresAt: googleProfile.expiresAt
            ? DateTime.fromJSDate(googleProfile.expiresAt)
            : null,
          scopes: googleProfile.scopes,
        }
      )

      await auth.use('web').login(user)
      session.put('auth.login_method', 'google')
      session.flash('success', 'Welcome!')

      const intendedUrl = this.consumePostLoginRedirect(session)
      if (intendedUrl) {
        return response.redirect(intendedUrl)
      }

      return response.redirect().toRoute('dashboard')
    } catch (error) {
      logger.error(error, 'Google OAuth callback failed')
      session.flash('error', 'Google authentication failed. Please try again.')
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
