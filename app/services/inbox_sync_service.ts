import User from '#models/user'
import UserInboxConnection from '#models/user_inbox_connection'
import Vendor from '#models/vendor'
import VendorConversation from '#models/vendor_conversation'
import Message from '#models/message'
import {
  listMessages as gmailListMessages,
  getMessage as gmailGetMessage,
} from './gmail_inbox_service.js'
import {
  listMessages as msListMessages,
  getMessage as msGetMessage,
} from './microsoft_inbox_service.js'
import logger from '@adonisjs/core/services/logger'

const SYNC_MAX_MESSAGES = 50

/**
 * Extract email address from "From" header (e.g. "Name <a@b.com>" or "a@b.com").
 */
function parseEmailFromHeader(from: string): string {
  const match = from.match(/<([^>]+)>/)
  if (match) return match[1].trim().toLowerCase()
  return from.trim().toLowerCase()
}

/**
 * Sync inbox for one connection: fetch recent messages, match senders to vendors, create Message records.
 */
export async function syncConnection(
  connection: UserInboxConnection
): Promise<{ processed: number; created: number }> {
  const user = await User.findBy('uuid', connection.userUuid)
  if (!user) {
    logger.warn({ userUuid: connection.userUuid }, 'Inbox sync: user not found')
    return { processed: 0, created: 0 }
  }

  let summaries: Array<{ id: string; from: string; to: string; subject: string; date: string }>
  if (connection.provider === 'gmail') {
    summaries = await gmailListMessages(connection, { maxResults: SYNC_MAX_MESSAGES })
  } else if (connection.provider === 'microsoft') {
    summaries = await msListMessages(connection, { maxResults: SYNC_MAX_MESSAGES })
  } else {
    return { processed: 0, created: 0 }
  }

  let created = 0
  for (const summary of summaries) {
    const existing = await Message.query()
      .where('provider_message_id', `${connection.provider}:${summary.id}`)
      .first()
    if (existing) continue

    const senderEmail = parseEmailFromHeader(summary.from)
    const vendor = await Vendor.query().where('email', senderEmail).first()
    if (!vendor) continue

    let conversation = await VendorConversation.query()
      .where('user_id', user.id)
      .where('vendor_uuid', vendor.uuid)
      .first()

    if (!conversation) {
      conversation = await VendorConversation.create({
        channel: 'email',
        userId: user.id,
        vendorUuid: vendor.uuid,
      })
    }

    const getDetail = connection.provider === 'gmail' ? gmailGetMessage : msGetMessage
    const detail = await getDetail(connection, summary.id)
    if (!detail) continue

    const systemUser = 'inbox-sync'
    await Message.create({
      vendorConversationUuid: conversation.uuid,
      subject: detail.subject,
      from: detail.from,
      to: detail.to,
      cc: detail.cc || null,
      body: detail.body || summary.snippet || '',
      createdBy: systemUser,
      modifiedBy: systemUser,
      sentTimestamp: detail.date,
      providerMessageId: `${connection.provider}:${summary.id}`,
    })
    created++
  }

  return { processed: summaries.length, created }
}

/**
 * Sync all connected inboxes.
 */
export async function syncAllConnections(): Promise<{ connections: number; totalCreated: number }> {
  const connections = await UserInboxConnection.query()
  let totalCreated = 0
  for (const conn of connections) {
    try {
      const { created } = await syncConnection(conn)
      totalCreated += created
    } catch (err) {
      logger.error(
        err,
        `Inbox sync failed for connection ${conn.id} (${conn.provider}/${conn.email})`
      )
    }
  }
  return { connections: connections.length, totalCreated }
}
