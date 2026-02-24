import type { HttpContext } from '@adonisjs/core/http'
import UserInboxConnection from '#models/user_inbox_connection'
import VendorConversation from '#models/vendor_conversation'
import { sendReplyAndRecord } from '#services/inbox_reply_service'
import type { EmailAnalysis } from '#services/email_ai_service'
import {
  analyzeEmail as analyzeEmailAi,
  generateResponse as generateResponseAi,
  generateInitialEmail as generateInitialEmailAi,
} from '#services/email_ai_service'
import {
  analyzeEmailValidator,
  generateReplyValidator,
  generateInitialEmailValidator,
} from '#validators/inbox_validator'

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
    }

    const connectionId = body.connectionId
    const vendorConversationUuid = body.vendorConversationUuid
    const { to, subject, body: replyBody, inReplyTo, references } = body

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
        error: 'No inbox connected. Connect an inbox in Settings → Inbox.',
      })
    }

    let conversationUuid = vendorConversationUuid
    if (!conversationUuid) {
      return response.badRequest({ error: 'Missing vendorConversationUuid' })
    }

    const conversation = await VendorConversation.query()
      .where('uuid', conversationUuid)
      .where('user_id', user.id)
      .first()

    if (!conversation) {
      return response.notFound({ error: 'Vendor conversation not found' })
    }

    try {
      const message = await sendReplyAndRecord(connection, conversationUuid, {
        to,
        subject,
        body: replyBody,
        inReplyTo,
        references,
      })
      return response.ok({ message: { uuid: message.uuid } })
    } catch (err) {
      return response.internalServerError({ error: 'Failed to send reply' })
    }
  }

  /**
   * Analyze an email (intent, urgency, key points, response strategy).
   * Body: { subject, body, from, to, date, cc?, threadContext? }
   */
  async analyzeEmail({ request, response }: HttpContext) {
    const payload = await request.validateUsing(analyzeEmailValidator)
    const analysis = await analyzeEmailAi({
      subject: payload.subject,
      body: payload.body,
      from: payload.from,
      to: payload.to,
      date: payload.date,
      cc: payload.cc,
      threadContext: payload.threadContext,
    })
    if (analysis === null) {
      return response.serviceUnavailable({
        error: 'AI analysis unavailable. Set OPENAI_API_KEY to enable.',
      })
    }
    return response.ok({ analysis })
  }

  /**
   * Generate a suggested reply for an email. Optionally pass pre-computed analysis.
   * Body: { subject, body, from, to, date, cc?, threadContext?, analysis? }
   */
  async generateReply({ request, response }: HttpContext) {
    const payload = await request.validateUsing(generateReplyValidator)
    const result = await generateResponseAi(
      {
        subject: payload.subject,
        body: payload.body,
        from: payload.from,
        to: payload.to,
        date: payload.date,
        cc: payload.cc,
        threadContext: payload.threadContext,
      },
      (payload.analysis as EmailAnalysis | undefined) ?? null
    )
    if (result === null) {
      return response.serviceUnavailable({
        error: 'AI reply generation unavailable. Set OPENAI_API_KEY to enable.',
      })
    }
    return response.ok({
      emailResponse: result.emailResponse,
      metadata: result.metadata,
    })
  }

  /**
   * Generate initial email content (greeting, body, closing, signature) for a new thread.
   * Body: { recipients, subject, context }
   */
  async generateInitialEmail({ request, response }: HttpContext) {
    const payload = await request.validateUsing(generateInitialEmailValidator)
    const content = await generateInitialEmailAi({
      recipients: payload.recipients,
      subject: payload.subject,
      context: payload.context,
    })
    if (content === null) {
      return response.serviceUnavailable({
        error: 'AI email generation unavailable. Set OPENAI_API_KEY to enable.',
      })
    }
    return response.ok(content)
  }
}
