import User from '#models/user'
import UserInboxConnection from '#models/user_inbox_connection'
import Vendor from '#models/vendor'
import { DateTime } from 'luxon'
import VendorConversation from '#models/vendor_conversation'
import Message from '#models/message'
import env from '#start/env'
import {
  listInboxMessages as emailServiceListMessages,
  getInboxMessage as emailServiceGetMessage,
} from './email_communication_service.js'
import { getOrCreateEmailCommunication } from './email_communication_context.js'
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

  const emailServiceUrl = env.get('EMAIL_SERVICE_URL')
  if (!emailServiceUrl) {
    throw new Error(
      'EMAIL_SERVICE_URL is not set. Inbox sync uses only envoy-email-service. Set EMAIL_SERVICE_URL in .env (e.g. http://127.0.0.1:3000).'
    )
  }
  logger.info(
    { provider: connection.provider, email: connection.email },
    'Calling email service POST /inbox/list'
  )
  const summaries = await emailServiceListMessages(connection, { maxResults: SYNC_MAX_MESSAGES })
  logger.info(
    { connectionId: connection.id, count: summaries.length },
    'Inbox sync: email service returned messages'
  )

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

    const detail = await emailServiceGetMessage(connection, summary.id)
    if (!detail) continue

    const communication = await getOrCreateEmailCommunication(user.uuid, vendor.uuid)
    if (!communication) {
      logger.warn(
        { vendorUuid: vendor.uuid, userUuid: user.uuid },
        'Inbox sync: vendor not on an active project for this user; skipping message'
      )
      continue
    }

    const systemUser = 'inbox-sync'
    await Message.create({
      communicationUuid: communication.uuid,
      vendorConversationUuid: conversation.uuid,
      subject: detail.subject,
      from: detail.from,
      to: detail.to,
      cc: detail.cc ?? undefined,
      body: detail.body || summary.snippet || '',
      createdBy: systemUser,
      sentTimestamp: DateTime.fromJSDate(detail.date),
      providerMessageId: `${connection.provider}:${summary.id}`,
      messageIdHeader: detail.messageId ?? null,
      referencesHeader: detail.references ?? null,
      providerThreadId: summary.threadId ?? null,
    })
    created++
  }

  if (summaries.length > 0 && created === 0) {
    logger.info(
      { connectionId: connection.id, processed: summaries.length },
      'Inbox sync: no messages matched a vendor (add vendors with sender emails to see them)'
    )
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
