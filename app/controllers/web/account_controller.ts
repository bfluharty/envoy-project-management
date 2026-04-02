import type { HttpContext } from '@adonisjs/core/http'
import UserInboxConnection from '#models/user_inbox_connection'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import { changePasswordValidator } from '#validators/auth_validator'
import User from '#models/user'
import { sendPasswordResetLink } from '#services/password_reset_service'
import {
  buildUserAvatar,
  deleteUploadedAvatar,
  storeUploadedAvatar,
} from '#services/user_avatar_service'

export default class AccountController {
  private getSessionLoginMethod(session: HttpContext['session']): 'password' | 'google' | null {
    const loginMethod = session.get('auth.login_method')
    return loginMethod === 'password' || loginMethod === 'google' ? loginMethod : null
  }

  private canChangePasswordDirectly(
    user: User,
    sessionLoginMethod: 'password' | 'google' | null
  ): boolean {
    return !user.googleId || sessionLoginMethod === 'password'
  }

  private async buildPageProps(user: User, session: HttpContext['session']) {
    const connections = await UserInboxConnection.query()
      .where('user_uuid', user.uuid)
      .orderBy('provider')
      .orderBy('email')
    const sessionLoginMethod = this.getSessionLoginMethod(session)
    const canChangePasswordDirectly = this.canChangePasswordDirectly(user, sessionLoginMethod)

    return {
      account: {
        fullName: user.fullName,
        email: user.email,
        avatar: buildUserAvatar(user),
        googleConnected: Boolean(user.googleId),
        sessionLoginMethod,
        canChangePasswordDirectly,
        canSendPasswordSetupEmail: Boolean(user.googleId) && !canChangePasswordDirectly,
      },
      connections: connections.map((connection) => ({
        id: connection.id,
        provider: connection.provider,
        email: connection.email,
        createdAt: connection.createdTimestamp.toISO(),
      })),
    }
  }

  async show({ auth, inertia, session }: HttpContext) {
    const user = auth.getUserOrFail()
    return inertia.render('account', await this.buildPageProps(user, session))
  }

  async changePassword({ auth, request, response, session, inertia }: HttpContext) {
    const user = auth.getUserOrFail()
    const sessionLoginMethod = this.getSessionLoginMethod(session)
    if (!this.canChangePasswordDirectly(user, sessionLoginMethod)) {
      session.flash(
        'error',
        'Use the emailed password setup link to enable or update password sign-in for this account.'
      )
      return response.redirect().toRoute('account')
    }

    const { currentPassword, password } = await request.validateUsing(changePasswordValidator)

    const currentPasswordMatches = await hash.use('scrypt').verify(user.password, currentPassword)
    if (!currentPasswordMatches) {
      return inertia.render('account', {
        ...(await this.buildPageProps(user, session)),
        errors: {
          currentPassword: ['Current password is incorrect.'],
        },
      })
    }

    user.password = password
    await user.save()

    session.flash('success', 'Your password has been updated.')
    return response.redirect().toRoute('account')
  }

  async sendPasswordSetupEmail({ auth, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const sessionLoginMethod = this.getSessionLoginMethod(session)

    if (!user.googleId || this.canChangePasswordDirectly(user, sessionLoginMethod)) {
      session.flash('error', 'You can update your password directly from this page.')
      return response.redirect().toRoute('account')
    }

    try {
      await sendPasswordResetLink(user)
    } catch (error) {
      session.flash(
        'error',
        error instanceof Error ? error.message : 'Failed to send password setup email.'
      )
      return response.redirect().toRoute('account')
    }

    session.flash('success', 'Check your email for a password setup link.')
    return response.redirect().toRoute('account')
  }

  async uploadAvatar({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const avatar = request.file('avatar', {
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })

    if (!avatar) {
      session.flash('error', 'Choose an image to upload.')
      return response.redirect().toRoute('account')
    }

    if (!avatar.isValid) {
      session.flash('error', avatar.errors[0]?.message ?? 'Avatar upload failed.')
      return response.redirect().toRoute('account')
    }

    const previousUploadedAvatarPath = user.uploadedAvatarPath
    const { uploadedAvatarPath } = await storeUploadedAvatar(user, avatar)

    user.uploadedAvatarPath = uploadedAvatarPath
    await user.save()

    await deleteUploadedAvatar(previousUploadedAvatarPath)

    session.flash('success', 'Profile image updated.')
    return response.redirect().toRoute('account')
  }

  async removeAvatar({ auth, response, session }: HttpContext) {
    const user = auth.getUserOrFail()

    if (!user.uploadedAvatarPath) {
      session.flash('error', 'No uploaded profile image to remove.')
      return response.redirect().toRoute('account')
    }

    const uploadedAvatarPath = user.uploadedAvatarPath
    user.uploadedAvatarPath = null
    await user.save()

    await deleteUploadedAvatar(uploadedAvatarPath)

    session.flash('success', 'Uploaded profile image removed.')
    return response.redirect().toRoute('account')
  }

  async googleAvatar({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const googleAvatarUrl = user.googleAvatarUrl?.trim()

    if (!googleAvatarUrl) {
      return response.status(404).send('')
    }

    try {
      const upstream = await fetch(googleAvatarUrl, {
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      })

      if (!upstream.ok) {
        logger.warn({ status: upstream.status, userUuid: user.uuid }, 'Google avatar fetch failed')
        return response.status(404).send('')
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg'
      const cacheControl = upstream.headers.get('cache-control') || 'private, max-age=3600'
      const imageBuffer = Buffer.from(await upstream.arrayBuffer())

      response.header('Content-Type', contentType)
      response.header('Cache-Control', cacheControl)
      return response.send(imageBuffer)
    } catch (error) {
      logger.warn({ err: error, userUuid: user.uuid }, 'Google avatar fetch errored')
      return response.status(404).send('')
    }
  }
}
