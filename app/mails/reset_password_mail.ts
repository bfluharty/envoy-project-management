import type User from '#models/user'
import { BaseMail } from '@adonisjs/mail'

export default class ResetPasswordMail extends BaseMail {
  subject = 'Reset your Envoy password'

  constructor(
    private user: User,
    private resetUrl: string
  ) {
    super()
  }

  prepare() {
    this.message
      .to(this.user.email)
      .subject(this.subject)
      .html(
        `
        <p>Hi ${this.user.fullName},</p>
        <p>You requested a password reset for your Envoy account.</p>
        <p>Click the link below to set a new password (this link expires in 1 hour):</p>
        <p><a href="${this.resetUrl}">${this.resetUrl}</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>— The Envoy Team</p>
      `
      )
      .text(
        `
Hi ${this.user.fullName},

You requested a password reset for your Envoy account.

Open this link in your browser to set a new password (expires in 1 hour):

${this.resetUrl}

If you didn't request this, you can safely ignore this email.

— The Envoy Team
      `.trim()
      )
  }
}
