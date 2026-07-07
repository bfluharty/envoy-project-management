import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import ProjectService from '#services/project_service'
import { ReasoningRequest } from '../../../../types/request.js'
import { chatProjectValidator, requestParamsValidator } from '#validators/projects_validator'
import ReasoningEngineService from '#services/reasoning_engine_service'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'
import ProjectReasoningWorkflowService from '#services/project_reasoning_workflow_service'
import {
  getClientIp,
  projectChatRateLimitRules,
  rejectWhenRateLimited,
} from '#utils/rate_limit_utils'

export default class ConvoController {
  /**
   * Chat with reasoning engine about a project
   */
  async chat({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { prompt } = await request.validateUsing(chatProjectValidator)
    const rateLimitResponse = await rejectWhenRateLimited(
      request,
      response,
      projectChatRateLimitRules({ userUuid: user.uuid, projectUuid, ip: getClientIp(request) })
    )
    if (rateLimitResponse) return rateLimitResponse

    try {
      const project = await ProjectService.getProjectWithConversations(user.uuid, projectUuid)
      const reasoningContext = await ReasoningRequestContextService.buildContext(
        projectUuid,
        project.conversations[0].uuid
      )
      const planningPromptData = await ProjectReasoningWorkflowService.ensurePlanningPromptData(
        project,
        user.uuid
      )
      const projectContext = await ReasoningRequestContextService.buildProjectContext(project)

      const reasoningRequest: ReasoningRequest =
        ProjectReasoningWorkflowService.buildPlanningRequest({
          project,
          user,
          prompt,
          promptData: planningPromptData,
          context: reasoningContext,
          projectContext,
        })

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

  /**
   * Generate an AI greeting for a fresh project conversation
   */
  async greeting({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const rateLimitResponse = await rejectWhenRateLimited(
      request,
      response,
      projectChatRateLimitRules({ userUuid: user.uuid, projectUuid, ip: getClientIp(request) })
    )
    if (rateLimitResponse) return rateLimitResponse

    try {
      const project = await ProjectService.getProjectWithConversations(user.uuid, projectUuid)
      const prompt =
        'Ask a single concise opening question to help plan this project. Focus on the most important missing detail or most valuable next step. Do not summarize the project, do not describe what you retrieved, and do not explain what you are doing - just ask the question.'
      const reasoningContext = await ReasoningRequestContextService.buildContext(
        projectUuid,
        project.conversations[0].uuid
      )
      const planningPromptData = await ProjectReasoningWorkflowService.ensurePlanningPromptData(
        project,
        user.uuid
      )
      const projectContext = await ReasoningRequestContextService.buildProjectContext(project)

      const reasoningRequest: ReasoningRequest =
        ProjectReasoningWorkflowService.buildPlanningRequest({
          project,
          user,
          prompt,
          promptData: planningPromptData,
          context: reasoningContext,
          projectContext,
        })

      return await ReasoningEngineService.handleReasoningChat(reasoningRequest, project, response, {
        saveToHistory: false,
      })
    } catch (error) {
      if (error.message === 'Project not found') {
        return response.abort({ error: 'Project not found' }, 404)
      }
      logger.error('Error preparing greeting request:')
      logger.error(error)
      throw error
    }
  }
}
