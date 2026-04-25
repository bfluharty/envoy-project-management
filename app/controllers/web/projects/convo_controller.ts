import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import ProjectService from '#services/project_service'
import { ReasoningRequest } from '../../../../types/request.js'
import { chatProjectValidator, requestParamsValidator } from '#validators/projects_validator'
import ReasoningEngineService from '#services/reasoning_engine_service'
import ProjectVendor from '#models/project_vendor'

export default class ConvoController {
  /**
   * Chat with reasoning engine about a project
   */
  async chat({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { prompt, variables } = await request.validateUsing(chatProjectValidator)

    try {
      const project = await ProjectService.getProjectWithConversations(user.uuid, projectUuid)
      const pastConversationTurns =
        project.conversations
          .flatMap((conv) => conv.conversationTurns)
          ?.map((turn) => turn?.contents) || []

      const projectVendors = await ProjectVendor.query()
        .where('project_uuid', projectUuid)
        .where('is_active', true)
        .preload('vendor')

      const reasoningRequest: ReasoningRequest = {
        agentId: 'envoy-reasoning-agent-001',
        prompt,
        variables: variables ?? {},
        projectUuid,
        pastConversationTurns,
        projectContext: {
          uuid: project.uuid,
          name: project.title,
          description: project.description ?? null,
          location: project.location ?? null,
          startDate: project.startDate?.toISODate() ?? null,
          endDate: project.endDate?.toISODate() ?? null,
          deadline: project.deadline?.toISODate() ?? null,
          budgetAmount: project.budgetAmount ?? null,
          budgetCurrency: null,
          goals: project.goals ?? null,
          vendors: projectVendors.map((pv) => ({
            name: pv.vendor.name,
            email: pv.vendor.email ?? null,
          })),
        },
      }

      return await ReasoningEngineService.handleReasoningChat(reasoningRequest, project, response)
    } catch (error) {
      if (error.message === 'Project not found') {
        return response.abort({ error: 'Project not found' }, 404)
      }
      logger.error('Error preparing chat request:')
      logger.error(error)
      throw error
    }
  }
}
