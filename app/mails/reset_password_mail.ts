import { BaseMail } from '@adonisjs/mail'
import type User from '#models/user'

export default class ResetPasswordMail extends BaseMail {
  constructor(
    private user: User,
    private resetUrl: string
  ) {
    super()
  }

  prepare() {
    this.message
      .to(this.user.email)
      .subject('Reset your password')
      .html(
        `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <p>Hi ${this.user.fullName},</p>
  <p>You requested a password reset. Click the link below to set a new password (valid for 1 hour):</p>
  <p><a href="${this.resetUrl}">${this.resetUrl}</a></p>
  <p>If you didn't request this, you can ignore this email.</p>
</body>
</html>`
      )
  }
}
