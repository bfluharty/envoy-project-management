import UserInboxConnection from '#models/user_inbox_connection'
import Message from '#models/message'
import { sendMessage as gmailSendMessage } from './gmail_inbox_service.js'
import { sendMessage as msSendMessage } from './microsoft_inbox_service.js'

export interface SendReplyParams {
  to: string
  subject: string
  body: string
  inReplyTo?: string
  references?: string
}

/**
 * Send an email using the customer's connected inbox (so the reply appears from the customer).
 * Returns the provider message id if available (Gmail returns it; Microsoft sendMail does not).
 */
export async function sendReply(
  connection: UserInboxConnection,
  params: SendReplyParams
): Promise<string> {
  if (connection.provider === 'gmail') {
    return gmailSendMessage(connection, params)
  }
  if (connection.provider === 'microsoft') {
    return msSendMessage(connection, params)
  }
  throw new Error(`Unknown provider: ${connection.provider}`)
}

/**
 * Send a reply and persist a Message record in the given vendor conversation.
 */
export async function sendReplyAndRecord(
  connection: UserInboxConnection,
  vendorConversationUuid: string,
  params: SendReplyParams
): Promise<Message> {
  const id = await sendReply(connection, params)
  const systemUser = 'envoy-reply'
  const message = await Message.create({
    vendorConversationUuid,
    subject: params.subject,
    from: connection.email,
    to: params.to,
    body: params.body,
    createdBy: systemUser,
    modifiedBy: systemUser,
    sentTimestamp: new Date(),
    providerMessageId: id ? `${connection.provider}:${id}` : null,
  })
  return message
}
