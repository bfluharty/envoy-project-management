import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import UserInboxConnection from '#models/user_inbox_connection'
import {
  getAuthUrl,
  exchangeCode,
  decodeState,
  type InboxProvider,
} from '#services/inbox_connection_service'
import {
  encryptOauthToken,
  OAUTH_TOKEN_ENCRYPTION_VERSION,
} from '#services/oauth_token_encryption_service'
import { setupEmailWatch, stopEmailWatch } from '#services/email_watch_service'
import logger from '@adonisjs/core/services/logger'

export default class InboxController {
  /**
   * Redirect to provider OAuth. Query: provider=gmail|microsoft
   */
  async connect({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const provider = request.input('provider') as string
    if (provider !== 'gmail' && provider !== 'microsoft') {
      return response.badRequest('Invalid provider. Use gmail or microsoft.')
    }
    try {
      const url = getAuthUrl(provider as InboxProvider, user.uuid)
      return response.redirect(url)
    } catch (err) {
      logger.error(err, 'Inbox connect: getAuthUrl failed')
      const message =
        err instanceof Error ? err.message : 'Could not start sign-in. Check server logs.'
      session.flash('error', message)
      return response.redirect().back()
    }
  }

  /**
   * OAuth callback: exchange code, save connection, redirect to inbox settings.
   */
  async callback({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const code = request.input('code')
    const state = request.input('state')
    const error = request.input('error')

    if (error) {
      session.flash('error', `Inbox connection failed: ${error}`)
      return response.redirect().toPath('/account#email-accounts')
    }

    if (!code || !state) {
      session.flash('error', 'Missing code or state.')
      return response.redirect().toPath('/account#email-accounts')
    }

    const decoded = decodeState(state)
    if (!decoded || decoded.userUuid !== user.uuid) {
      session.flash('error', 'Invalid state. Please try connecting again.')
      return response.redirect().toPath('/account#email-accounts')
    }
    try {
      const tokens = await exchangeCode(decoded.provider, code, state)
      const expiresAt = tokens.expiresAt !== null ? DateTime.fromJSDate(tokens.expiresAt) : null
      const existing = await UserInboxConnection.query()
        .where('user_uuid', user.uuid)
        .where('provider', decoded.provider)
        .where('email', tokens.email)
        .first()

      if (!tokens.refreshToken && !existing?.refreshToken) {
        throw new Error(
          'The email provider did not return offline access. Please try again and approve mailbox access.'
        )
      }

      let otherPrimaryQuery = UserInboxConnection.query()
        .where('user_uuid', user.uuid)
        .where('is_primary', true)
        .whereIn('status', ['active', 'reauth_required'])

      if (existing) {
        otherPrimaryQuery = otherPrimaryQuery.whereNot('id', existing.id)
      }

      await otherPrimaryQuery.update({
        is_primary: false,
        status: 'disconnected',
        disconnected_at: DateTime.utc().toSQL(),
      })

      const connection = existing ?? new UserInboxConnection()
      connection.merge({
        userUuid: user.uuid,
        provider: decoded.provider,
        email: tokens.email,
        accessToken: encryptOauthToken(tokens.accessToken),
        refreshToken: tokens.refreshToken
          ? encryptOauthToken(tokens.refreshToken)
          : (existing?.refreshToken ?? null),
        accessTokenExpiresAt: expiresAt,
        scopes: tokens.scopes,
        status: 'active',
        isPrimary: true,
        tokenEncryptionVersion: OAUTH_TOKEN_ENCRYPTION_VERSION,
        reauthReason: null,
        reauthRequiredAt: null,
        disconnectedAt: null,
      })
      await connection.save()
      await setupEmailWatch(connection)

      const label = decoded.provider === 'gmail' ? 'Gmail' : 'Microsoft'
      session.flash(
        'success',
        `${label} connected. Envoy will use it for outreach and replies when available.`
      )
      return response.redirect().toPath('/account#email-accounts')
    } catch (err) {
      logger.error(err, 'Inbox callback: exchange failed')
      const message =
        err instanceof Error ? err.message : 'Could not connect inbox. Please try again.'
      session.flash('error', message)
      return response.redirect().toPath('/account#email-accounts')
    }
  }

  /**
   * List vendor conversations and synced messages for the current user.
   * Syncs from connected inboxes by calling the email service POST /inbox/list (and /inbox/message for bodies).
   * Requires EMAIL_SERVICE_URL in .env and at least one connected inbox.
   */
  async emails({ auth, inertia, session }: HttpContext) {
    auth.getUserOrFail()
    session.flash('success', "Inbox now lives in each project's Outreach tab.")
    return inertia.location('/dashboard')
  }

  /**
   * List connected inboxes for the current user.
   */
  async settings({ auth, inertia }: HttpContext) {
    auth.getUserOrFail()
    return inertia.location('/account#email-accounts')
  }

  /**
   * Remove a connected inbox. Query or body: id (connection id).
   */
  async disconnect({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail() as User
    const id = request.input('id')
    if (id === undefined || id === null) {
      session.flash('error', 'Missing connection id.')
      return response.redirect().back()
    }
    const connection = await UserInboxConnection.query()
      .where('id', id)
      .where('user_uuid', user.uuid)
      .first()

    if (!connection) {
      session.flash('error', 'Connection not found.')
      return response.redirect().back()
    }

    await stopEmailWatch(connection)
    await connection.delete()
    session.flash('success', 'Inbox disconnected.')
    return response.redirect().back()
  }
}
