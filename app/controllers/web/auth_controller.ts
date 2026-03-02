import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import User from '#models/user'
import PasswordResetToken from '#models/password_reset_token'
import ResetPasswordMail from '#mails/reset_password_mail'
import {
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resetPasswordValidator,
} from '#validators/auth_validator'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'

export default class AuthController {
  /**
   * Show the login form
   */
  async showLogin({ inertia, session }: HttpContext) {
    return inertia.render('auth/login', {
      flashMessage:
        session.flashMessages.get('success') ?? session.flashMessages.get('error') ?? null,
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

      session.flash('success', 'Welcome back!')

      // Get intended URL from session and redirect there, or default to dashboard
      const intendedUrl = session.get('auth.intended_url')
      if (intendedUrl) {
        session.forget('auth.intended_url')
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
    return inertia.render('auth/register', {
      flashMessage:
        session.flashMessages.get('success') ?? session.flashMessages.get('error') ?? null,
    })
  }

  /**
   * Handle registration request
   */
  async register({ request, response, session }: HttpContext) {
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
        session.flash('error', 'Registration failed. Please check your details and try again.')
      } else {
        session.flash('error', 'Something went wrong. Please try again.')
      }
      return response.redirect().back()
    }
  }

  /**
   * Handle logout request
   */
  async logout({ auth, response, session }: HttpContext) {
    await auth.use('web').logout()
    session.flash('success', 'You have been logged out')
    return response.redirect().toRoute('landing')
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
    const token = randomBytes(32).toString('hex')
    const expiresAt = DateTime.utc().plus({ hours: 1 })
    await PasswordResetToken.create({
      userUuid: user.uuid,
      token,
      expiresAt,
      createdAt: DateTime.utc(),
    })
    const baseUrl = (env.get('APP_URL') ?? '').replace(/\/$/, '')
    if (!baseUrl && env.get('NODE_ENV') === 'production') {
      logger.error('APP_URL not set; cannot send password reset link')
      session.flash('error', 'Email is not configured. Please contact support.')
      return response.redirect().back()
    }
    const resetUrl = `${baseUrl}/reset-password?token=${token}`
    try {
      await mail.send(new ResetPasswordMail(user, resetUrl))
    } catch (err) {
      logger.error(err, 'Failed to send password reset email')
      if (env.get('NODE_ENV') === 'development') {
        logger.info('Dev fallback: reset link (valid 1h): %s', resetUrl)
      }
      session.flash('error', 'Failed to send reset email. Please try again later.')
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
