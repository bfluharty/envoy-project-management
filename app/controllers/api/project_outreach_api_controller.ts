import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import {
  cancelOutreachDraft,
  createOutreachDraft,
  getProjectOutreach,
  retryInitialOutreachDraft,
  reviseThreadReply,
  reviseOutreachDraft,
  sendOutreachDraft,
  sendThreadReply,
} from '#services/project_outreach_service'
import UserInboxConnection from '#models/user_inbox_connection'
import { buildManualBackfillEvent, enqueueEmailSyncEvent } from '#services/email_sync_event_service'
import { requestParamsValidator } from '#validators/projects_validator'
import {
  createOutreachDraftValidator,
  outreachDraftParamsValidator,
  outreachThreadParamsValidator,
  replyToThreadValidator,
  reviseReplyToThreadValidator,
  reviseOutreachDraftValidator,
  sendOutreachDraftValidator,
} from '#validators/outreach_validator'
import {
  getClientIp,
  outreachAiRevisionRateLimitRules,
  rejectWhenRateLimited,
} from '#utils/rate_limit_utils'
import { safeError } from '#utils/safe_error'

const ACTIVE_INBOX_REQUIRED_MESSAGE =
  'An active connected email account is required before sending outreach'

async function queueManualBackfillForActivePrimaryInboxes(userUuid: string) {
  const connections = await UserInboxConnection.query()
    .where('user_uuid', userUuid)
    .where('is_primary', true)
    .where('status', 'active')

  let queued = 0
  let skipped = 0
  let failed = 0

  for (const connection of connections) {
    try {
      const wasQueued = await enqueueEmailSyncEvent(buildManualBackfillEvent(connection))
      if (wasQueued) {
        queued += 1
      } else {
        skipped += 1
      }
    } catch (error) {
      failed += 1
      logger.warn(
        { err: safeError(error), connectionUuid: connection.uuid, provider: connection.provider },
        'Project outreach sync enqueue failed'
      )
    }
  }

  if (connections.length > 0 && queued === 0) {
    throw new Error(
      failed > 0 ? 'Failed to queue inbox sync' : 'Email sync queue is not configured'
    )
  }

  return {
    activeConnections: connections.length,
    queued,
    skipped,
    failed,
  }
}

export default class ProjectOutreachApiController {
  async cancelDraft({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { draftUuid } = await outreachDraftParamsValidator.validate(request.params())

    try {
      return response.ok(await cancelOutreachDraft(user.uuid, projectUuid, draftUuid))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel outreach draft'
      if (message === 'Project not found' || message === 'Draft not found') {
        return response.notFound({ error: message })
      }
      if (message === ACTIVE_INBOX_REQUIRED_MESSAGE) {
        return response
          .status(409)
          .send({ error: message, reconnectUrl: '/account#email-accounts' })
      }

      return response.internalServerError({ error: message })
    }
  }

  async createDraft({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const payload = await request.validateUsing(createOutreachDraftValidator)

    try {
      return response.ok(
        await createOutreachDraft(user.uuid, projectUuid, {
          projectVendorUuid: payload.projectVendorUuid,
          vendorUuid: payload.vendorUuid,
        })
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create outreach draft'
      if (message === 'Project not found' || message === 'Project contact not found') {
        return response.notFound({ error: message })
      }

      return response.internalServerError({ error: message })
    }
  }

  async getState({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())

    try {
      return response.ok(await getProjectOutreach(user.uuid, projectUuid))
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found') {
        return response.notFound({ error: error.message })
      }

      return response.internalServerError({ error: 'Failed to load outreach state' })
    }
  }

  async sync({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())

    try {
      const outreach = await getProjectOutreach(user.uuid, projectUuid)
      const sync = await queueManualBackfillForActivePrimaryInboxes(user.uuid)

      return response.ok({
        ...outreach,
        syncQueued: sync.queued > 0,
        sync,
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found') {
        return response.notFound({ error: error.message })
      }

      const message = error instanceof Error ? error.message : 'Failed to sync outreach'
      return response.internalServerError({ error: message })
    }
  }

  async sendDraft({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { draftUuid } = await outreachDraftParamsValidator.validate(request.params())
    const payload = await request.validateUsing(sendOutreachDraftValidator)

    try {
      return response.ok(await sendOutreachDraft(user, projectUuid, draftUuid, payload))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send outreach draft'
      if (message === 'Project not found' || message === 'Draft not found') {
        return response.notFound({ error: message })
      }

      return response.internalServerError({ error: message })
    }
  }

  async retryDraft({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { draftUuid } = await outreachDraftParamsValidator.validate(request.params())
    const rateLimitResponse = await rejectWhenRateLimited(
      request,
      response,
      outreachAiRevisionRateLimitRules({
        userUuid: user.uuid,
        projectUuid,
        ip: getClientIp(request),
      })
    )
    if (rateLimitResponse) return rateLimitResponse

    try {
      return response.ok(await retryInitialOutreachDraft(user, projectUuid, draftUuid))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retry outreach draft'
      if (
        message === 'Project not found' ||
        message === 'Draft not found' ||
        message === 'Project contact not found'
      ) {
        return response.notFound({ error: message })
      }
      if (message === 'Draft is not in a retryable error state') {
        return response.badRequest({ error: message })
      }

      return response.internalServerError({ error: message })
    }
  }

  async reviseDraft({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { draftUuid } = await outreachDraftParamsValidator.validate(request.params())
    const payload = await request.validateUsing(reviseOutreachDraftValidator)
    const rateLimitResponse = await rejectWhenRateLimited(
      request,
      response,
      outreachAiRevisionRateLimitRules({
        userUuid: user.uuid,
        projectUuid,
        ip: getClientIp(request),
      })
    )
    if (rateLimitResponse) return rateLimitResponse

    try {
      return response.ok(
        await reviseOutreachDraft(user, projectUuid, draftUuid, payload.instructions, {
          subject: payload.subject,
          body: payload.body,
        })
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revise outreach draft'
      if (message === 'Project not found' || message === 'Draft not found') {
        return response.notFound({ error: message })
      }

      return response.internalServerError({ error: message })
    }
  }

  async replyToThread({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { threadUuid } = await outreachThreadParamsValidator.validate(request.params())
    const payload = await request.validateUsing(replyToThreadValidator)

    try {
      return response.ok(await sendThreadReply(user, projectUuid, threadUuid, payload))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reply'
      if (message === 'Project not found' || message === 'Thread not found') {
        return response.notFound({ error: message })
      }
      if (message === ACTIVE_INBOX_REQUIRED_MESSAGE) {
        return response
          .status(409)
          .send({ error: message, reconnectUrl: '/account#email-accounts' })
      }

      return response.internalServerError({ error: message })
    }
  }

  async reviseReplyToThread({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { threadUuid } = await outreachThreadParamsValidator.validate(request.params())
    const payload = await request.validateUsing(reviseReplyToThreadValidator)
    const rateLimitResponse = await rejectWhenRateLimited(
      request,
      response,
      outreachAiRevisionRateLimitRules({
        userUuid: user.uuid,
        projectUuid,
        ip: getClientIp(request),
      })
    )
    if (rateLimitResponse) return rateLimitResponse

    try {
      return response.ok(
        await reviseThreadReply(
          user,
          projectUuid,
          threadUuid,
          payload.instructions,
          payload.body ?? ''
        )
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revise reply'
      if (message === 'Project not found' || message === 'Thread not found') {
        return response.notFound({ error: message })
      }

      return response.internalServerError({ error: message })
    }
  }
}
