import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import User from '#models/user'
import PasswordResetToken from '#models/password_reset_token'
import ResetPasswordMail from '#mails/reset_password_mail'

export async function sendPasswordResetLink(user: User): Promise<string> {
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
    throw new Error('Email is not configured. Please contact support.')
  }

  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  try {
    await mail.send(new ResetPasswordMail(user, resetUrl))
  } catch (error) {
    logger.error(error, 'Failed to send password reset email')
    if (env.get('NODE_ENV') === 'development') {
      logger.info('Dev fallback: reset link (valid 1h): %s', resetUrl)
    }
    throw new Error('Failed to send reset email. Please try again later.')
  }

  return resetUrl
}
