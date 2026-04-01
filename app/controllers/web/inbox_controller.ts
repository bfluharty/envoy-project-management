import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import UserInboxConnection from '#models/user_inbox_connection'
import VendorConversation from '#models/vendor_conversation'
import {
  getAuthUrl,
  exchangeCode,
  decodeState,
  type InboxProvider,
} from '#services/inbox_connection_service'
import { syncConnection } from '#services/inbox_sync_service'
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
      return response.redirect().toRoute('inbox.settings')
    }

    if (!code || !state) {
      session.flash('error', 'Missing code or state.')
      return response.redirect().toRoute('inbox.settings')
    }

    const decoded = decodeState(state)
    if (!decoded || decoded.userUuid !== user.uuid) {
      session.flash('error', 'Invalid state. Please try connecting again.')
      return response.redirect().toRoute('inbox.settings')
    }

    try {
      const tokens = await exchangeCode(decoded.provider, code, state)
      const expiresAt = tokens.expiresAt !== null ? DateTime.fromJSDate(tokens.expiresAt) : null
      await UserInboxConnection.updateOrCreate(
        {
          userUuid: user.uuid,
          provider: decoded.provider,
          email: tokens.email,
        },
        {
          userUuid: user.uuid,
          provider: decoded.provider,
          email: tokens.email,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpiresAt: expiresAt,
          scopes: tokens.scopes,
        }
      )
      session.flash(
        'success',
        `${decoded.provider === 'gmail' ? 'Gmail' : 'Outlook'} connected. We'll listen for vendor emails.`
      )
      return response.redirect().toRoute('inbox.settings')
    } catch (err) {
      logger.error(err, 'Inbox callback: exchange failed')
      const message =
        err instanceof Error ? err.message : 'Could not connect inbox. Please try again.'
      session.flash('error', message)
      return response.redirect().toRoute('inbox.settings')
    }
  }

  /**
   * List vendor conversations and synced messages for the current user.
   * Syncs from connected inboxes by calling the email service POST /inbox/list (and /inbox/message for bodies).
   * Requires EMAIL_SERVICE_URL in .env and at least one connected inbox.
   */
  async emails({ auth, inertia, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const connections = await UserInboxConnection.query().where('user_uuid', user.uuid)
    let syncError: string | null = null
    for (const conn of connections) {
      try {
        await syncConnection(conn) // calls email service /inbox/list then /inbox/message per connection
      } catch (err) {
        logger.error(err, `Inbox sync failed for ${conn.provider}/${conn.email}`)
        syncError =
          err instanceof Error ? err.message : 'Inbox sync failed. Is the email service running?'
        session.flash('error', `Sync failed for ${conn.email}: ${syncError}`)
      }
    }
    const conversations = await VendorConversation.query()
      .where('user_id', user.id)
      .preload('vendor')
      .preload('messages', (q) => q.orderBy('sent_timestamp', 'asc'))
      .orderBy('id', 'desc')

    return inertia.render('inbox/emails', {
      hasConnections: connections.length > 0,
      syncError: syncError ?? undefined,
      conversations: conversations.map((c) => ({
        uuid: c.uuid,
        vendorName: c.vendor.name,
        vendorEmail: c.vendor.email,
        messages: c.messages.map((m) => ({
          uuid: m.uuid,
          subject: m.subject,
          from: m.from,
          to: m.to,
          body: m.body,
          sentAt:
            typeof m.sentTimestamp?.toISO === 'function'
              ? m.sentTimestamp.toISO()
              : m.sentTimestamp instanceof Date
                ? m.sentTimestamp.toISOString()
                : String(m.sentTimestamp ?? ''),
          messageId: m.messageIdHeader ?? undefined,
          references: m.referencesHeader ?? undefined,
          threadId: m.providerThreadId ?? undefined,
        })),
      })),
    })
  }

  /**
   * List connected inboxes for the current user.
   */
  async settings({ auth, inertia }: HttpContext) {
    const user = auth.getUserOrFail()
    const connections = await UserInboxConnection.query()
      .where('user_uuid', user.uuid)
      .orderBy('provider')
      .orderBy('email')

    return inertia.render('inbox/settings', {
      connections: connections.map((c) => ({
        id: c.id,
        provider: c.provider,
        email: c.email,
        createdAt: c.createdTimestamp.toISO(),
      })),
    })
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

    await connection.delete()
    session.flash('success', 'Inbox disconnected.')
    return response.redirect().back()
  }
}
