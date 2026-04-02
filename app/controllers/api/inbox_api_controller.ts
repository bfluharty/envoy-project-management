import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import UserInboxConnection from '#models/user_inbox_connection'
import VendorConversation from '#models/vendor_conversation'
import { sendReplyAndRecord } from '#services/inbox_reply_service'

export default class InboxAPIController {
  /**
   * Send a reply to a vendor using the customer's connected inbox.
   * Body: { connectionId?, vendorConversationUuid, to, subject, body, inReplyTo?, references? }
   */
  async sendReply({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const body = request.body() as {
      connectionId?: number
      vendorConversationUuid?: string
      to: string
      subject: string
      body: string
      inReplyTo?: string
      references?: string
      threadId?: string
    }

    logger.info(
      {
        to: body.to,
        subject: body.subject,
        vendorConversationUuid: body.vendorConversationUuid,
        bodyLength: typeof body.body === 'string' ? body.body.length : 0,
      },
      'Inbox reply: received from frontend'
    )

    const connectionId = body.connectionId
    const vendorConversationUuid = body.vendorConversationUuid
    const { to, subject, body: replyBody, inReplyTo, references, threadId } = body

    if (!to || !subject || replyBody === undefined) {
      return response.badRequest({ error: 'Missing to, subject, or body' })
    }

    const connection = connectionId
      ? await UserInboxConnection.query()
          .where('id', connectionId)
          .where('user_uuid', user.uuid)
          .first()
      : await UserInboxConnection.query().where('user_uuid', user.uuid).first()

    if (!connection) {
      return response.badRequest({
        error: 'No inbox connected. Connect an inbox in Settings > Inbox.',
      })
    }

    if (!vendorConversationUuid) {
      return response.badRequest({ error: 'Missing vendorConversationUuid' })
    }

    const conversation = await VendorConversation.query()
      .where('uuid', vendorConversationUuid)
      .where('user_id', user.id)
      .first()

    if (!conversation) {
      return response.notFound({ error: 'Vendor conversation not found' })
    }

    logger.info(
      {
        to,
        subject,
        connectionEmail: connection.email,
        inReplyTo: !!inReplyTo,
        references: !!references,
      },
      'Inbox reply: sending via email service'
    )

    try {
      const message = await sendReplyAndRecord(connection, vendorConversationUuid, {
        to,
        subject,
        body: replyBody,
        inReplyTo,
        references,
        threadId,
      })
      return response.ok({ message: { uuid: message.uuid } })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reply'
      logger.error({ err, to, connectionEmail: connection.email }, 'Inbox reply failed')
      return response.internalServerError({ error: message })
    }
  }
}
