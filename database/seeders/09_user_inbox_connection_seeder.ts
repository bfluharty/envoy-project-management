import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import UserInboxConnection from '#models/user_inbox_connection'

export default class extends BaseSeeder {
  async run() {
    await UserInboxConnection.updateOrCreateMany(
      ['userUuid', 'provider', 'email'],
      [
        {
          userUuid: 'b7e1a2e2-1c3a-4b2e-8e7a-1f2b3c4d5e6f',
          provider: 'gmail',
          email: 'alice@example.com',
          accessToken: 'seed-access-token-alice',
          refreshToken: 'seed-refresh-token-alice',
          accessTokenExpiresAt: DateTime.fromISO('2026-12-31T23:59:59.000Z'),
          scopes:
            'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
        },
        {
          userUuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b41',
          provider: 'gmail',
          email: 'envoyryan@gmail.com',
          accessToken: 'seed-access-token-ryan',
          refreshToken: 'seed-refresh-token-ryan',
          accessTokenExpiresAt: DateTime.fromISO('2026-12-31T23:59:59.000Z'),
          scopes:
            'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
        },
      ]
    )
  }
}
