import { DateTime } from 'luxon'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import UserInboxConnection from '#models/user_inbox_connection'
import VendorConversation from '#models/vendor_conversation'
import Message from '#models/message'
import { sendOnBehalf } from './email_communication_service.js'
import { getOrCreateEmailCommunication } from './email_communication_context.js'

export interface SendReplyParams {
  to: string
  subject: string
  body: string
  inReplyTo?: string
  references?: string
  threadId?: string
}

/**
 * Send an email using the customer's connected inbox via envoy-email-service only.
 * Requires EMAIL_SERVICE_URL. Returns the provider message id if available (Gmail returns it; Microsoft sendMail does not).
 */
export async function sendReply(
  connection: UserInboxConnection,
  params: SendReplyParams
): Promise<string> {
  const emailServiceUrl = env.get('EMAIL_SERVICE_URL')
  if (!emailServiceUrl) {
    throw new Error(
      'EMAIL_SERVICE_URL is not set. Inbox replies are sent only via envoy-email-service. Set EMAIL_SERVICE_URL in .env (e.g. http://127.0.0.1:3000).'
    )
  }
  logger.info(
    { emailServiceUrl, to: params.to, provider: connection.provider },
    'Inbox reply: sending via envoy-email-service'
  )
  return sendOnBehalf(connection, params)
}

/**
 * Send a reply and persist a Message record in the given vendor conversation.
 */
export async function sendReplyAndRecord(
  connection: UserInboxConnection,
  vendorConversationUuid: string,
  params: SendReplyParams
): Promise<Message> {
  const vendorConversation = await VendorConversation.query()
    .where('uuid', vendorConversationUuid)
    .first()
  if (!vendorConversation) {
    throw new Error('Vendor conversation not found')
  }
  const communication = await getOrCreateEmailCommunication(
    connection.userUuid,
    vendorConversation.vendorUuid
  )
  if (!communication) {
    throw new Error(
      'This vendor is not linked to a project for your account. Add the vendor to a project first.'
    )
  }

  const id = await sendReply(connection, params)
  const systemUser = 'envoy-reply'
  const message = await Message.create({
    communicationUuid: communication.uuid,
    vendorConversationUuid,
    subject: params.subject,
    from: connection.email,
    to: params.to,
    body: params.body,
    createdBy: systemUser,
    sentTimestamp: DateTime.now(),
    providerMessageId: id ? `${connection.provider}:${id}` : null,
    providerThreadId: params.threadId ?? null,
  })
  return message
}
