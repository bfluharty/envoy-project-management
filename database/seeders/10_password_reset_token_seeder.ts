import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import PasswordResetToken from '#models/password_reset_token'

export default class extends BaseSeeder {
  async run() {
    await PasswordResetToken.updateOrCreateMany('token', [
      {
        userUuid: 'b7e1a2e2-1c3a-4b2e-8e7a-1f2b3c4d5e6f',
        token: 'seed-expired-reset-token-alice',
        expiresAt: DateTime.fromISO('2026-01-01T00:00:00.000Z'),
        createdAt: DateTime.fromISO('2025-12-31T23:00:00.000Z'),
      },
      {
        userUuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b4c',
        token: 'seed-expired-reset-token-bob',
        expiresAt: DateTime.fromISO('2026-01-01T00:00:00.000Z'),
        createdAt: DateTime.fromISO('2025-12-31T23:00:00.000Z'),
      },
    ])
  }
}
