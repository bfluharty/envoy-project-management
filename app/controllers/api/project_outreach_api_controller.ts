import type { HttpContext } from '@adonisjs/core/http'
import {
  cancelOutreachDraft,
  createOutreachDraft,
  getProjectOutreach,
  reviseThreadReply,
  reviseOutreachDraft,
  sendOutreachDraft,
  sendThreadReply,
  syncProjectOutreach,
} from '#services/project_outreach_service'
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
      return response.ok(await syncProjectOutreach(user, projectUuid))
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

  async reviseDraft({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { draftUuid } = await outreachDraftParamsValidator.validate(request.params())
    const payload = await request.validateUsing(reviseOutreachDraftValidator)

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

      return response.internalServerError({ error: message })
    }
  }

  async reviseReplyToThread({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { threadUuid } = await outreachThreadParamsValidator.validate(request.params())
    const payload = await request.validateUsing(reviseReplyToThreadValidator)

    try {
      return response.ok(
        await reviseThreadReply(user, projectUuid, threadUuid, payload.instructions, payload.body ?? '')
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
