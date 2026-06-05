import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import ProjectService from '#services/project_service'
import { ReasoningRequest } from '../../../../types/request.js'
import { chatProjectValidator, requestParamsValidator } from '#validators/projects_validator'
import ReasoningEngineService from '#services/reasoning_engine_service'
import ReasoningRequestContextService from '#services/reasoning_request_context_service'
import ProjectVendor from '#models/project_vendor'
import OutreachDraft from '#models/outreach_draft'
import Project from '#models/project'

export default class ConvoController {
  private async buildProjectContext(project: Project, projectUuid: string) {
    const projectVendors = await ProjectVendor.query()
      .where('project_uuid', projectUuid)
      .where('is_active', true)
      .preload('vendor', (q) => q.preload('vendorListing'))

    const projectVendorUuids = projectVendors.map((pv) => pv.uuid)
    const existingDrafts = projectVendorUuids.length
      ? await OutreachDraft.query()
          .whereIn('project_vendor_uuid', projectVendorUuids)
          .where('status', 'draft')
      : []

    const vendorEmailByPvUuid = new Map(
      projectVendors.map((pv) => [pv.uuid, pv.vendor.vendorListing.email ?? null])
    )

    return {
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
        name: pv.vendor.vendorListing.name,
        email: pv.vendor.vendorListing.email ?? null,
      })),
      existingDrafts: existingDrafts.map((d) => ({
        draftUuid: d.uuid,
        vendorEmail: vendorEmailByPvUuid.get(d.projectVendorUuid) ?? null,
        subject: d.subject,
      })),
    }
  }

  /**
   * Chat with reasoning engine about a project
   */
  async chat({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())
    const { prompt, variables } = await request.validateUsing(chatProjectValidator)

    try {
      const project = await ProjectService.getProjectWithConversations(user.uuid, projectUuid)
      const reasoningContext = await ReasoningRequestContextService.buildContext(
        projectUuid,
        project.conversations[0].uuid
      )

      const reasoningRequest: ReasoningRequest = {
        agentId: 'envoy-reasoning-agent-001',
        prompt,
        variables: variables ?? {},
        projectUuid,
        ...reasoningContext,
        projectContext: await this.buildProjectContext(project, projectUuid),
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

  /**
   * Generate an AI greeting for a fresh project conversation
   */
  async greeting({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())

    try {
      const project = await ProjectService.getProjectWithConversations(user.uuid, projectUuid)
      const prompt =
        'Ask a single concise opening question to help plan this project. Focus on the most important missing detail or most valuable next step. Do not summarize the project, do not describe what you retrieved, and do not explain what you are doing - just ask the question.'
      const reasoningContext = await ReasoningRequestContextService.buildContext(
        projectUuid,
        project.conversations[0].uuid
      )

      const reasoningRequest: ReasoningRequest = {
        agentId: 'envoy-reasoning-agent-001',
        prompt,
        variables: { context: 'PROJECT_SETUP' },
        projectUuid,
        ...reasoningContext,
        projectContext: await this.buildProjectContext(project, projectUuid),
      }

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
